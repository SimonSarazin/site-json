import { useState, type ReactNode } from "react";
import type { Api } from "@communecter/cocolight-api-client";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useT } from "@/hooks/useT";
import { useSaveChooseProposal } from "@/modules/coform/actions/mutations/selection";
import { buildChooseEntry } from "@/modules/coform/utils/chooseProposal";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";

/**
 * Publier un commun dans l'annuaire, ou l'en retirer : l'écriture, sa confirmation et son état.
 * Le déclencheur appartient à la barre de la fiche (`CommunActionBar`) — un bouton tant que le
 * commun attend, une entrée de « ⋯ » une fois sélectionné.
 *
 * Sélectionner, c'est publier le commun dans l'annuaire DE CET AAC. Le choix est donc indexé par
 * CONTEXTE — l'organisation porteuse de l'appel — et pas par réponse : un même commun peut être
 * retenu par un appel et pas par un autre. Mesuré en base : 8 réponses du formulaire « Appel à
 * commun des tiers lieux » portent une entrée pour le contexte « Fédération des CAE », ce sont
 * exactement les communs étrangers visibles dans l'annuaire des CAE.
 *
 * ⚠️ `contextId` DOIT être celui de l'annuaire (`useAacDirectoryContext`), qui est l'organisation
 * parente du formulaire de l'AAC — c'est la clé sur laquelle le filtre de l'annuaire porte
 * (`aacQueryParams`). Écrire sous une autre clé (par exemple l'entité du slug du site, ce
 * qu'utilise `ChooseProposalField`) enregistrerait sans erreur un choix que l'annuaire n'irait
 * jamais lire : « j'ai cliqué, rien ne change ».
 *
 * ⚠️ Le gate `isAdmin` est un gate d'AFFICHAGE, pas une sécurité : le backend
 * (`UpdatePathValuedAction`) ne vérifie que la connexion. Cf. BACKLOG.
 */
export interface CommunSelectionActionOptions {
  api: Api | null;
  /** Admin de l'AAC courant — seul à pouvoir écrire. */
  isAdmin: boolean;
  /**
   * `null` ⇒ statut INDÉCIDABLE : aucune question `choose` résolue, ou aucun contexte identifié.
   * Une réponse sans étape d'évaluation n'est PAS ce cas-là — l'absence d'entrée vaut « non
   * sélectionné », donc `false`.
   */
  isSelected: boolean | null;
  /** Organisation porteuse de l'appel. Sans elle, on ne sait pas où écrire. */
  contextId: string | null;
  contextType?: string | null;
  contextName?: string | null;
  /** Étape portant l'input `choose` (résolue par la config, jamais en dur). */
  subFormId: string | null;
  /** Formulaire servant à construire l'entité — celui de la réponse. */
  formId: string | null;
  answerId: string | null;
  onDone?: () => void;
}

export interface CommunSelectionAction {
  /** Le droit d'écrire, ET la clé sous laquelle écrire. Sinon, seul le statut s'affiche. */
  canWrite: boolean;
  isSelected: boolean;
  isPending: boolean;
  /** Ouvre la confirmation — sélection ou retrait, selon l'état du commun. */
  request: () => void;
  /** La confirmation, à rendre HORS du menu : le contenu d'un menu est démonté à sa fermeture. */
  dialog: ReactNode;
}

export function useCommunSelectionAction({
  api,
  isAdmin,
  isSelected,
  contextId,
  contextType,
  contextName,
  subFormId,
  formId,
  answerId,
  onDone,
}: CommunSelectionActionOptions): CommunSelectionAction {
  const t = useT("modules/aac");
  const [open, setOpen] = useState(false);

  // Les invalidations de l'annuaire vivent sur la MUTATION, pas dans le `onSuccess` par appel :
  // React Query saute ces callbacks-là dès que l'observateur n'a plus d'abonné. Un admin qui
  // confirme puis revient à l'annuaire avant la réponse verrait sinon la liste d'avant pendant
  // tout le `staleTime`, alors même que le toast lui annonce l'enregistrement.
  const save = useSaveChooseProposal({
    api,
    formId: formId ?? "",
    answerId: answerId ?? undefined,
    extraInvalidate: [
      AAC_QUERY_KEYS.COMMUNS_PREFIX(),
      AAC_QUERY_KEYS.COUNT_PREFIX(),
      AAC_QUERY_KEYS.FACETS_PREFIX(),
    ],
  });

  // Le statut se lit toujours ; seule l'ÉCRITURE exige de savoir sous quelle clé écrire.
  const canWrite = isAdmin && Boolean(contextId) && Boolean(subFormId) && Boolean(answerId);
  const selectionne = isSelected === true;
  const prefixe = selectionne ? "confirmDeselect" : "confirmSelect";

  const confirmer = () => {
    if (!canWrite || !contextId || !subFormId) return;
    save.mutate(
      {
        subFormId,
        contextId,
        entry: buildChooseEntry({ id: contextId, type: contextType ?? null, name: contextName ?? null }, !selectionne),
      },
      {
        onSuccess: () => {
          setOpen(false);
          onDone?.();
        },
      }
    );
  };

  const dialog = canWrite ? (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      onConfirm={confirmer}
      title={String(t(`detail.selection.${prefixe}.title`))}
      // Un contexte SANS nom n'est pas un cas théorique : le legacy écrit `parent[<id>] = {id, type}`
      // sans `name` (`FormTemplate::createFormFromTemplate`), et `moveFormToParent` DÉTRUIT un
      // `name` existant. Le repli « {{name}} » vide produirait « l'annuaire de « » ». On bascule
      // alors sur une phrase sans nom — plutôt que d'exiger `contextName` dans `canWrite`, ce qui
      // masquerait une action dont l'écriture est parfaitement valide.
      description={String(
        contextName
          ? t(`detail.selection.${prefixe}.description`, undefined, { name: contextName })
          : t(`detail.selection.descriptionNoName.${prefixe}`)
      )}
      confirmLabel={String(t(`detail.selection.${prefixe}.confirm`))}
      cancelLabel={String(t("detail.selection.cancel"))}
      // Désélectionner retire le commun de l'annuaire : c'est la branche qui fait disparaître
      // quelque chose, donc la branche destructive.
      isDestructive={selectionne}
      isPending={save.isPending}
    />
  ) : null;

  return {
    canWrite,
    isSelected: selectionne,
    isPending: save.isPending,
    request: () => setOpen(true),
    dialog,
  };
}
