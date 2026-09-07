/**
 * Champ coform « liste de dépenses / paliers » — `tpls.forms.ocecoform.newDepenseList`.
 *
 * **Piloté par react-hook-form**, comme tous les autres champs du module : la
 * valeur `answers.<étape>.depense[]` est la source de vérité, chaque geste
 * (ajout, modification, clôture, suppression) la modifie localement, et le
 * submit la persiste avec le reste de la réponse.
 *
 * Ce n'était pas le cas avant, et cela coûtait deux défauts :
 *
 *  1. le champ refusait toute saisie tant que la réponse n'existait pas
 *     (`if (!answerId)` → « enregistrez d'abord »), puisque chaque geste partait
 *     directement au serveur ;
 *  2. plus grave, la valeur RHF n'était JAMAIS réécrite alors que `depense` est
 *     bien déclaré au schéma Zod, donc soumis. Le backend remplaçant la clé en
 *     bloc (`SaveAnswerAction` : `$mergedAnswers[$step][$input] = $inputValue`),
 *     ajouter une dépense puis soumettre le formulaire **effaçait l'ajout**.
 *
 * **Projection vers le projet.** La copie des paliers sur l'entité projet
 * (`oceco.milestones[]`) n'est pas décorative : `useOrganizationProjectsWithAnswers`
 * filtre les projets sur `oceco.milestones.0.$exists`. Un commun sans palier côté
 * projet disparaît de la vue cagnotte. Elle est donc conservée — en queue de
 * chaque geste, quand un projet est résolu (donc jamais sur une réponse neuve,
 * où il n'y en a pas encore). C'est une projection **best-effort** : son échec
 * ne doit pas empêcher la saisie, la source de vérité restant la réponse.
 *
 * Volontairement HORS scope : le financement (contributions, cofinanceurs) et
 * les actions/objectifs — gérés par `CommunFinancingCard` et `CommunActionsSection`.
 */
import { useMemo, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { ChevronDown, Plus, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolightOptional } from "@/hooks/useCocolight";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MilestoneManageActions } from "@/modules/cagnotte/components/sections/MilestoneManageActions";
import { formatCurrency } from "@/modules/cagnotte/utils/format";
import { toSafeInt, asRecord, buildItemsFromRawDepenses } from "@/modules/cagnotte/utils/dataTransform";
import { generateMilestoneId } from "@/modules/cagnotte/utils/idGeneration";
import { useCagnottePermissions } from "@/modules/cagnotte/hooks/useCagnottePermissions";
import {
  appendProjectMilestone,
  updateProjectMilestoneFields,
  deleteProjectMilestoneAtIndex,
} from "@/modules/cagnotte/lib/actionMilestonePathUpdates";
import type { Project } from "@communecter/cocolight-api-client";
import type { FundingMilestone as Milestone, CagnotteFundableItem } from "@/modules/cagnotte/types";
import type { AacLog } from "@/modules/aac/types";
import { useAacFundingResource } from "@/modules/aac/hooks/useAacFundingResource";
import type { MilestoneCardPermissions } from "@/modules/aac/lib/objectiveHelpers";
import { FieldError, HintText } from "./FormFields";
import { DepenseFormDialog, type DepenseFormValues } from "./DepenseFormDialog";
import {
  addDepense,
  normalizeDepenseValue,
  removeDepense,
  setDepenseOpen,
  updateDepense,
  type DepenseEntry,
} from "../utils/depense";
import type { FormFieldMapping } from "../types";

interface MilestoneListFieldProps {
  field: FormFieldMapping;
  errors: FieldErrors;
  value?: DepenseEntry[];
  onChange?: (value: DepenseEntry[]) => void;
  /** Réponse en cours d'édition. Absente ⇒ réponse neuve : saisie locale seule. */
  answerId?: string;
  readOnly?: boolean;
}

/** Repartit les paliers entre actifs et clotures, en conservant l'ordre
 *  relatif de chaque groupe — les clotures s'affichent en dernier, repliés. */
function splitMilestoneItemsByStatus(
  items: CagnotteFundableItem[],
): { openItems: CagnotteFundableItem[]; closedItems: CagnotteFundableItem[] } {
  const openItems: CagnotteFundableItem[] = [];
  const closedItems: CagnotteFundableItem[] = [];
  for (const item of items) {
    if (item?.status === "close") {
      closedItems.push(item);
    } else {
      openItems.push(item);
    }
  }
  return { openItems, closedItems };
}

function DepenseFieldLabel({ field }: { field: FormFieldMapping }) {
  return (
    <div className="block text-sm font-medium">
      {field.label}
      {field.isRequired && <span className="text-destructive ml-1">*</span>}
    </div>
  );
}

/**
 * Sous-ensemble de `MilestoneCardPermissions` réellement consommé par une ligne.
 * Les cinq verbes d'action de l'interface complète n'y sont jamais appelés :
 * les déléguer ne produirait que du code mort.
 */
type SaisiePermissions = Pick<
  MilestoneCardPermissions,
  "canEditMilestone" | "canCloseMilestone" | "canDeleteMilestone"
>;

/**
 * Permissions de SAISIE d'une ligne — distinctes de celles de la cagnotte.
 *
 * Ce champ est un input de formulaire : le droit d'y écrire est celui de la
 * RÉPONSE (porté par `readOnly` / `lockedFields`, résolus en amont), pas celui
 * du projet. Le portage initial consommait `useCagnottePermissions`, dont tous
 * les verbes valent `isAdmin` sur l'entité HÔTE DU SITE (`CocolightProvider`
 * résout `entity` par le slug du site) : il fallait donc être admin de
 * l'organisation porteuse pour saisir une dépense dans sa propre réponse, alors
 * que le legacy (`newDepenseList.php`) rend le bouton d'ajout sans condition.
 *
 * Ne subsistent que les invariants d'ÉTAT de la ligne : une ligne clôturée ne
 * s'édite pas, une ligne déjà financée ne se supprime pas. Ils ne dépendent de
 * rien d'autre que la ligne elle-même, d'où une constante de module — les
 * mémoïser serait du bruit, `MilestoneRow` n'étant pas mémoïsé.
 *
 * Les gestes qui touchent à l'argent réel (financer, actions) restent, eux,
 * gouvernés par `useCagnottePermissions` là où ils sont rendus.
 */
const PERMISSIONS_SAISIE: SaisiePermissions = {
  canEditMilestone: ({ status }) => status !== "close",
  canCloseMilestone: ({ status }) => status === "open",
  canDeleteMilestone: ({ hasTransactions }) => hasTransactions !== true,
};

function MilestoneRow({
  index,
  item,
  history,
  onEdit,
  onClose,
  onRestore,
  onDelete,
  permissions,
  disabled,
}: {
  index: number;
  item: CagnotteFundableItem;
  history: AacLog[];
  onEdit: (item: CagnotteFundableItem) => void;
  onClose: (item: CagnotteFundableItem) => void;
  onRestore: (item: CagnotteFundableItem) => void;
  onDelete: (item: CagnotteFundableItem) => void;
  permissions: SaisiePermissions;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `depense-historique-${index}-panel`;

  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");
  const tc = useT("modules/cagnotte");

  // `CagnotteFundableItem.status` est un `string` générique côté source ;
  // les permissions/`Milestone` attendent l'union restreinte du domaine.
  const status = item.status as Milestone["status"];

  const isFunded = toSafeInt(item.currentFunding) > 0;
  const canDeleteThisMilestone = !disabled && permissions.canDeleteMilestone({
    status,
    hasTransactions: isFunded,
  });
  const canEditThisMilestone = !disabled && permissions.canEditMilestone({ status });
  const hasOpenActions = (item.actions ?? []).some((action) => action.status !== "done");

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden group">
      <div className="w-full p-4 sm:p-5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="min-w-0 flex-1 text-left flex items-center gap-3 cursor-pointer"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              {String(t("detail.objectives.milestone", undefined, { number: index + 1 }))}
            </div>
            <h4 className="font-display font-bold truncate">{item.name}</h4>
          </div>
          <div className="shrink-0 font-display font-bold tabular-nums">
            {formatCurrency(toSafeInt(item.price))}
          </div>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div id={panelId} className="px-4 sm:px-5 pb-4 pt-1 bg-background/30 border-t border-border">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground mt-3 mb-2">
            <History className="size-3.5" />
            {String(t("detail.objectives.milestoneField.history"))}
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {String(t("detail.objectives.milestoneField.historyEmpty"))}
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {history.map((entry, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-sm p-2.5 rounded-md border border-border">
                  <span className="text-muted-foreground">
                    {entry.quand ? new Date(entry.quand).toLocaleString("fr-FR") : ""}
                  </span>
                  <span className="tabular-nums font-medium">
                    {formatCurrency(toSafeInt(entry.avant))} → {formatCurrency(toSafeInt(entry.apres))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isFunded && !disabled && (
        <div className="px-4 sm:px-5 pb-3 text-xs text-destructive">
          {String(tc("milestone.errors.cannotDeleteIfFunded"))}
        </div>
      )}

      {canEditThisMilestone || canDeleteThisMilestone ? (
        <div className="grid grid-rows-[0fr] opacity-0 group-hover:grid-rows-[1fr] group-hover:opacity-100 focus-within:grid-rows-[1fr] focus-within:opacity-100 transition-all duration-300 ease-in-out">
          <div className="overflow-hidden">
            <div className="px-1 pb-3">
              <MilestoneManageActions
                onEdit={() => onEdit(item)}
                onClose={() => onClose(item)}
                onDelete={() => onDelete(item)}
                onRestore={() => onRestore(item)}
                isDeleting={false}
                isClosing={false}
                isRestoring={false}
                closeDisabled={status === "close" || hasOpenActions}
                canEdit={canEditThisMilestone}
                canClose={canEditThisMilestone && permissions.canCloseMilestone({ status })}
                canDelete={canDeleteThisMilestone}
                isClosed={status === "close"}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MilestoneListField({
  field,
  errors,
  value,
  onChange,
  answerId,
  readOnly,
}: MilestoneListFieldProps) {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");
  const tf = useT("modules/coform");

  // Variante TOLÉRANTE : `CoFormReadOnly` se rend hors `CocolightProvider`.
  // Sans API, la projection vers le projet est simplement inopérante — la
  // saisie et l'affichage, eux, ne dépendent que de la valeur RHF.
  const cocolight = useCocolightOptional();
  const api = cocolight?.api ?? null;
  const entity = cocolight?.entity ?? null;

  // Sans `hostEntity` : ce champ se rend dans le formulaire, où l'on n'a que
  // l'`answerId` — pas le document réponse dont se déduit le contexte du commun (cf.
  // `useCommunFundingContext`), et pas nécessairement un `CocolightProvider` complet.
  // Conséquence assumée : sur un commun déposé sur un AUTRE appel, l'enveloppe du
  // site ne le porte pas, `projectId` reste vide et la projection vers le projet
  // ci-dessous ne fait rien — elle est best-effort par conception, la réponse restant
  // la source de vérité. La fiche, elle, résout bien ce contexte.
  const { targetResource } = useAacFundingResource(answerId);
  const projectId = targetResource?.projectId ?? "";


  // Une seule passe pour les trois dérivations liées (norme : ne pas empiler des
  // `useMemo` qui refont la même boucle).
  const { list, items, openItems, closedItems } = useMemo(() => {
    const l = normalizeDepenseValue(value);
    const it = buildItemsFromRawDepenses(l, targetResource?.items ?? []);
    return { list: l, items: it, ...splitMilestoneItemsByStatus(it) };
  }, [value, targetResource?.items]);

  const perms = useCagnottePermissions(entity, {
    hasActiveItems: openItems.length > 0,
    resourceId: projectId,
  });

  const [showClosed, setShowClosed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  /** Index de la ligne en cours d'édition ; `null` = ajout. */
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CagnotteFundableItem | null>(null);

  const disabled = Boolean(readOnly);


  /**
   * Projection best-effort d'un geste vers l'entité projet.
   *
   * Silencieuse par conception : la source de vérité est la réponse, déjà mise à
   * jour côté RHF quand on arrive ici. Un projet absent (réponse neuve) ou une
   * écriture en échec ne doit ni bloquer la saisie ni annuler le geste.
   */
  const projeterSurProjet = async (
    appliquer: (project: Project, milestones: Record<string, unknown>[]) => Promise<void>,
  ) => {
      if (!api || !projectId) return;
      try {
        const project = await api.project({ id: projectId });
        const brut = asRecord(asRecord(project.serverData).oceco).milestones;
        const milestones = Array.isArray(brut) ? brut.map(asRecord) : [];
        await appliquer(project, milestones);
    } catch {
      // best-effort : cf. le JSDoc de ce champ.
    }
  };

  const indexProjetDe = (milestones: Record<string, unknown>[], milestoneId: string) =>
    milestones.findIndex((m) => String(m.milestoneId ?? "") === milestoneId);

  const ouvrirAjout = () => {
    setEditIndex(null);
    setDialogOpen(true);
  };

  const ouvrirEdition = (item: CagnotteFundableItem) => {
    const idx = typeof item.depenseIndex === "number" ? item.depenseIndex : -1;
    if (idx < 0) return;
    setEditIndex(idx);
    setDialogOpen(true);
  };

  /** Ajout ET modification passent par ici — un seul chemin d'écriture. */
  const soumettreDialogue = (values: DepenseFormValues) => {
    if (editIndex === null) {
      const milestoneId = generateMilestoneId(
        list.map((d) => String(d.milestone ?? "")).filter(Boolean),
      );
      onChange?.(
        addDepense(list, {
          poste: values.name,
          price: values.targetAmount,
          description: values.description,
          milestone: milestoneId,
          user: perms.currentUserId,
          date: new Date().toISOString(),
        }),
      );
      void projeterSurProjet(async (project) => {
        await appendProjectMilestone({
          project,
          milestone: {
            milestoneId,
            name: values.name,
            description: values.description,
            status: "open",
          },
        });
      });
      return;
    }

    const cible = list[editIndex];
    onChange?.(
      updateDepense(list, editIndex, {
        poste: values.name,
        price: values.targetAmount,
        description: values.description,
      }),
    );
    const milestoneId = String(cible?.milestone ?? "");
    if (!milestoneId) return;
    void projeterSurProjet(async (project, milestones) => {
      const idx = indexProjetDe(milestones, milestoneId);
      if (idx < 0) return;
      await updateProjectMilestoneFields({
        project,
        index: idx,
        fields: { name: values.name, description: values.description },
      });
    });
  };

  const basculerOuverture = (item: CagnotteFundableItem, ouvert: boolean) => {
    const idx = typeof item.depenseIndex === "number" ? item.depenseIndex : -1;
    if (idx < 0) return;
    onChange?.(setDepenseOpen(list, idx, ouvert));
    const milestoneId = String(list[idx]?.milestone ?? "");
    if (!milestoneId) return;
    void projeterSurProjet(async (project, milestones) => {
      const i = indexProjetDe(milestones, milestoneId);
      if (i < 0) return;
      await updateProjectMilestoneFields({
        project,
        index: i,
        fields: { status: ouvert ? "open" : "close" },
      });
    });
  };

  const confirmerSuppression = () => {
    const item = pendingDelete;
    setPendingDelete(null);
    if (!item) return;
    const idx = typeof item.depenseIndex === "number" ? item.depenseIndex : -1;
    if (idx < 0) return;
    const milestoneId = String(list[idx]?.milestone ?? "");
    onChange?.(removeDepense(list, idx));
    if (!milestoneId) return;
    void projeterSurProjet(async (project, milestones) => {
      const i = indexProjetDe(milestones, milestoneId);
      if (i < 0) return;
      await deleteProjectMilestoneAtIndex({ project, index: i });
    });
  };

  const historyFor = (item: CagnotteFundableItem): AacLog[] => {
    const idx = typeof item.depenseIndex === "number" ? item.depenseIndex : -1;
    const raw = idx >= 0 ? asRecord(list[idx]).historique : undefined;
    return Array.isArray(raw) ? (raw as AacLog[]) : [];
  };

  const valeursInitiales: DepenseFormValues | undefined =
    editIndex !== null && list[editIndex]
      ? {
          name: String(list[editIndex].poste ?? ""),
          description: String(list[editIndex].description ?? ""),
          targetAmount: toSafeInt(list[editIndex].price),
        }
      : undefined;

  return (
    <div className={cn("space-y-3", field.width || "col-span-12")}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <DepenseFieldLabel field={field} />
          {field.info && <HintText text={field.info} />}
        </div>
        {!disabled ? (
          <Button
            type="button"
            size="sm"
            className="h-7 text-[11px] gap-1 px-2 bg-primary hover:bg-primary/90"
            onClick={ouvrirAjout}
          >
            <Plus className="h-3 w-3" /> {String(t("detail.objectives.addMilestone"))}
          </Button>
        ) : null}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          {tf("coform.depense.empty", "Aucune dépense pour l'instant.")}
        </p>
      )}

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          title={String(t("detail.objectives.deleteMilestoneConfirm.title"))}
          description={String(
            t("detail.objectives.deleteMilestoneConfirm.description", undefined, {
              name: pendingDelete.name,
            }),
          )}
          confirmLabel={String(t("detail.objectives.deleteMilestoneConfirm.confirm"))}
          cancelLabel={String(t("detail.objectives.deleteMilestoneConfirm.cancel"))}
          isDestructive
          onConfirm={confirmerSuppression}
        />
      )}

      <div className="grid gap-3">
        {openItems.map((o, i) => (
          <MilestoneRow
            key={o.milestoneId || `open-${i}`}
            index={i}
            item={o}
            history={historyFor(o)}
            onEdit={ouvrirEdition}
            onClose={(item) => basculerOuverture(item, false)}
            onRestore={(item) => basculerOuverture(item, true)}
            onDelete={setPendingDelete}
            permissions={PERMISSIONS_SAISIE}
            disabled={disabled}
          />
        ))}
        {closedItems.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowClosed((o) => !o)}
            aria-expanded={showClosed}
            className="w-full flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground px-1 pt-2 hover:text-foreground transition-colors cursor-pointer"
          >
            {String(t("detail.objectives.archivedMilestones", undefined, { count: closedItems.length }))}
            <ChevronDown className={cn("size-3.5 transition-transform", showClosed && "rotate-180")} />
          </button>
        ) : null}
        {showClosed &&
          closedItems.map((o, i) => (
            <MilestoneRow
              key={o.milestoneId || `closed-${i}`}
              index={openItems.length + i}
              item={o}
              history={historyFor(o)}
              onEdit={ouvrirEdition}
              onClose={(item) => basculerOuverture(item, false)}
              onRestore={(item) => basculerOuverture(item, true)}
              onDelete={setPendingDelete}
              permissions={PERMISSIONS_SAISIE}
              disabled={disabled}
            />
          ))}
      </div>

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />

      {dialogOpen && (
        <DepenseFormDialog
          open
          onOpenChange={setDialogOpen}
          initial={valeursInitiales}
          onSubmit={soumettreDialogue}
          inputIdPrefix={`depense-${field.name}`}
        />
      )}
    </div>
  );
}

export default MilestoneListField;
