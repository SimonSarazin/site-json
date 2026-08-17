/**
 * Champ coform "liste de paliers/dépenses" — `tpls.forms.ocecoform.newDepenseList`.
 *
 * Contrairement aux autres champs complexes (`SimpleTableField`…), ce champ
 * n'est PAS piloté par react-hook-form : chaque action (ajout/édition/clôture/
 * suppression) est persistée immédiatement côté serveur via les mutations
 * paliers de `cagnotte` (mêmes mutations que `CommunFinancingSection` sur la
 * page détail — synchronisation garantie avec l'affichage post-soumission).
 * La valeur RHF `depense` reste donc telle que chargée en `defaultValues` ;
 * elle n'est jamais réécrite depuis ce champ (inoffensif : la resoumission du
 * form renvoie une valeur déjà à jour côté backend).
 *
 * Volontairement HORS scope de ce champ : le financement (contributions,
 * cofinanceurs) et les actions/objectifs — gérés ailleurs (`CommunFinancingCard`,
 * `CommunActionsSection`). On expose seulement les paliers (CRUD) + un
 * historique des modifications de montant (`depense.historique[]`).
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MilestoneManageActions } from "@/modules/cagnotte/components/sections/MilestoneManageActions";
import { MilestoneEditDialog } from "@/modules/cagnotte/components/sections/parts/MilestoneEditDialog";
import CreateMilestoneDialog from "@/modules/cagnotte/components/sections/CreateMilestoneDialog";
import { formatCurrency } from "@/modules/cagnotte/utils/format";
import { toSafeInt, asRecord, buildItemsFromRawDepenses } from "@/modules/cagnotte/utils/dataTransform";
import type { FundingMilestone as Milestone, CagnotteFundableItem } from "@/modules/cagnotte/types";
import type { CoFormAnswer } from "@/modules/coform/types";
import type { AacLog } from "@/modules/aac/types";
import { useAacFundingResource } from "@/modules/aac/hooks/useAacFundingResource";
import { useCommunObjectivesController } from "@/modules/aac/hooks/useCommunObjectivesController";
import { useCommunRawDepenses } from "@/modules/aac/hooks/useCommunRawDepenses";
import type { MilestoneCardPermissions } from "@/modules/aac/lib/objectiveHelpers";
import { HintText } from "./FormFields";
import type { FormFieldMapping } from "../types";

interface MilestoneListFieldProps {
  field: FormFieldMapping;
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

function FieldLabel({ field }: { field: FormFieldMapping }) {
  return (
    <div className="block text-sm font-medium">
      {field.label}
      {field.isRequired && <span className="text-destructive ml-1">*</span>}
    </div>
  );
}

function MilestoneRow({
  index,
  item,
  history,
  openEditMilestoneModal,
  onMilestoneClose,
  onMilestoneRestore,
  onMilestoneDelete,
  permissions,
  loadingIds,
  disabled,
}: {
  index: number;
  item: CagnotteFundableItem;
  history: AacLog[];
  openEditMilestoneModal: (milestone: Milestone) => void;
  onMilestoneClose: (itemId: string, milestone: Milestone) => void;
  onMilestoneRestore: (itemId: string, milestone: Milestone) => void;
  onMilestoneDelete: (itemId: string, milestone: Milestone) => void;
  permissions: MilestoneCardPermissions;
  loadingIds: { deletingItemId: string; closingItemId: string; restoringItemId: string };
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

  const milestoneOf = (): Milestone => ({
    id: item.milestoneId,
    title: item.name,
    description: item.description ?? "",
    status: status ?? "open",
    date_start: undefined,
    date_end: undefined,
    targetAmount: Number(item.price ?? 0),
    transactions: [],
    actions: item.actions ?? [],
    answerDepenseIndex: typeof item.depenseIndex === "number" ? item.depenseIndex : undefined,
  });

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
                onEdit={() => openEditMilestoneModal(milestoneOf())}
                onClose={() => onMilestoneClose(item.itemId, milestoneOf())}
                onDelete={() => onMilestoneDelete(item.itemId, milestoneOf())}
                onRestore={() => onMilestoneRestore(item.itemId, milestoneOf())}
                isDeleting={loadingIds.deletingItemId === item.itemId}
                isClosing={loadingIds.closingItemId === item.itemId}
                isRestoring={loadingIds.restoringItemId === item.itemId}
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

export function MilestoneListField({ field, answerId, readOnly }: MilestoneListFieldProps) {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");
  const { targetResource } = useAacFundingResource(answerId);

  const answerStub = answerId ? ({ id: answerId } as unknown as CoFormAnswer) : null;
  const ctrl = useCommunObjectivesController({ answerQuery: answerStub, funding: targetResource });

  // Historique des montants (`depense.historique[]`) — lecture directe et
  // légère de la réponse brute, indépendante du pipeline funding envelope
  // (hors scope de ce champ, cf. commentaire de fichier).
  const { data: depenses, refetch: refetchDepenses } = useCommunRawDepenses(answerId);

  // Clôture/restauration/suppression passent par les handlers internes de
  // `ctrl` (fire-and-forget, pas de promesse exploitable ici) — on détecte
  // la fin de mutation via le retour à vide de `loadingIds` pour rafraîchir
  // la dépense brute (source d'affichage de ce champ, cf. plus haut).
  const prevLoadingIdsRef = useRef(ctrl.loadingIds);
  useEffect(() => {
    const prev = prevLoadingIdsRef.current;
    const justSettled =
      (prev.closingItemId && !ctrl.loadingIds.closingItemId) ||
      (prev.deletingItemId && !ctrl.loadingIds.deletingItemId) ||
      (prev.restoringItemId && !ctrl.loadingIds.restoringItemId);
    prevLoadingIdsRef.current = ctrl.loadingIds;
    if (justSettled) refetchDepenses();
  }, [ctrl.loadingIds, refetchDepenses]);

  const items = buildItemsFromRawDepenses(depenses ?? [], targetResource?.items ?? []);
  const { openItems, closedItems } = splitMilestoneItemsByStatus(items);
  const [showClosed, setShowClosed] = useState(false);

  const disabled = Boolean(readOnly);

  if (!answerId) {
    return (
      <div className={cn("space-y-2", field.width || "col-span-12")}>
        <FieldLabel field={field} />
        {field.info && <HintText text={field.info} />}
        <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border p-4">
          {String(t("detail.objectives.milestoneField.saveFirst"))}
        </p>
      </div>
    );
  }

  const historyFor = (item: CagnotteFundableItem): AacLog[] => {
    const depenseIndex = typeof item.depenseIndex === "number" ? item.depenseIndex : -1;
    const entry = depenseIndex >= 0 ? depenses?.[depenseIndex] : undefined;
    const raw = asRecord(entry).historique;
    return Array.isArray(raw) ? (raw as AacLog[]) : [];
  };

  const pendingDeleteHasActions = (ctrl.pendingDeleteMilestone?.milestone?.actions?.length ?? 0) > 0;
  const deleteDescription = ctrl.pendingDeleteMilestone
    ? pendingDeleteHasActions
      ? String(t("detail.objectives.milestoneField.deleteWithActionsWarning", undefined, {
          name: ctrl.pendingDeleteMilestone.milestone.title,
          count: ctrl.pendingDeleteMilestone.milestone.actions.length,
        }))
      : String(t("detail.objectives.deleteMilestoneConfirm.description", undefined, { name: ctrl.pendingDeleteMilestone.milestone.title }))
    : "";

  return (
    <div className={cn("space-y-3", field.width || "col-span-12")}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <FieldLabel field={field} />
          {field.info && <HintText text={field.info} />}
        </div>
        {!disabled && ctrl.cagnottePerms.canCreateMilestone ? (
          <Button type="button" size="sm" className="h-7 text-[11px] gap-1 px-2 bg-primary hover:bg-primary/90" onClick={ctrl.openCreateMilestoneModal}>
            <Plus className="h-3 w-3" /> {String(t("detail.objectives.addMilestone"))}
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={!!ctrl.pendingDeleteMilestone}
        onOpenChange={(open) => {
          if (!open) ctrl.cancelDeleteMilestone();
        }}
        title={String(t("detail.objectives.deleteMilestoneConfirm.title"))}
        description={deleteDescription}
        confirmLabel={String(t("detail.objectives.deleteMilestoneConfirm.confirm"))}
        cancelLabel={String(t("detail.objectives.deleteMilestoneConfirm.cancel"))}
        isDestructive
        isPending={
          !!ctrl.pendingDeleteMilestone &&
          ctrl.loadingIds.deletingItemId === ctrl.pendingDeleteMilestone.itemId
        }
        onConfirm={ctrl.confirmDeleteMilestone}
      />

      <div className="grid gap-3">
        {openItems.map((o, i) => (
          <MilestoneRow
            key={i}
            index={i}
            item={o}
            history={historyFor(o)}
            openEditMilestoneModal={ctrl.openEditMilestoneModal}
            onMilestoneClose={ctrl.handleCloseMilestone}
            onMilestoneRestore={ctrl.handleRestoreMilestone}
            onMilestoneDelete={ctrl.handleDeleteMilestone}
            permissions={ctrl.cagnottePerms as unknown as MilestoneCardPermissions}
            loadingIds={ctrl.loadingIds}
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
        {showClosed && closedItems.map((o, i) => (
          <MilestoneRow
            key={openItems.length + i}
            index={openItems.length + i}
            item={o}
            history={historyFor(o)}
            openEditMilestoneModal={ctrl.openEditMilestoneModal}
            onMilestoneClose={ctrl.handleCloseMilestone}
            onMilestoneRestore={ctrl.handleRestoreMilestone}
            onMilestoneDelete={ctrl.handleDeleteMilestone}
            permissions={ctrl.cagnottePerms as unknown as MilestoneCardPermissions}
            loadingIds={ctrl.loadingIds}
            disabled={disabled}
          />
        ))}
      </div>

      {ctrl.selectedMilestone && ctrl.milestoneEditInitialValues ? (
        <MilestoneEditDialog
          open={ctrl.isEditMilestoneOpen}
          onOpenChange={(open) => {
            ctrl.setIsEditMilestoneOpen(open);
            if (!open) ctrl.setSelectedMilestone(null);
          }}
          initialValues={ctrl.milestoneEditInitialValues}
          milestoneId={ctrl.selectedMilestone.id}
          answerDepenseIndex={ctrl.selectedMilestone.answerDepenseIndex}
          mutation={ctrl.activeEditMilestoneMutation as unknown as import("@tanstack/react-query").UseMutationResult<void, Error, import("@/modules/cagnotte/actions/mutations/milestone").EditMilestoneParams>}
          apiErrorFallbackKey="ActionsSection.errors.milestoneEditFailed"
          onSuccess={async () => {
            await ctrl.handleMilestoneEditSuccess();
            await refetchDepenses();
          }}
        />
      ) : null}

      <CreateMilestoneDialog
        open={ctrl.isCreateMilestoneOpen}
        onOpenChange={ctrl.setIsCreateMilestoneOpen}
        selectedProjectId={ctrl.resolvedProjectId}
        answerId={ctrl.resolvedAnswerId}
        currentUserId={ctrl.currentUserId || ""}
        existingMilestoneIds={ctrl.existingMilestoneIds}
        isConnected={ctrl.isConnected}
        inputIdPrefix="aac-milestone-field"
        onCreated={async () => {
          await ctrl.refetchFundingEnvelope();
        }}
        onRefetch={async () => {
          await ctrl.refetchFundingEnvelope();
          await refetchDepenses();
        }}
      />
    </div>
  );
}
