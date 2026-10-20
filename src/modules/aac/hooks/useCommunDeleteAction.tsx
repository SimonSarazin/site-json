import { useMemo, useState, type ReactNode } from "react";
import type { Api } from "@communecter/cocolight-api-client";
import type { CagnotteResource } from "@/modules/cagnotte/types";
import { useDeleteCommun } from "./useDeleteCommun";
import { resolveCommunDeletionPlan } from "../lib/communDeletion";
import { CommunDeleteDialog } from "../components/pageDetail/CommunDeleteDialog";

/**
 * « Supprimer le commun » — parité du geste legacy (`campDetail.php:971`, gate `:2590`) :
 * l'écriture, sa confirmation et son état. Le déclencheur est une entrée de « ⋯ », à l'écart des
 * actions courantes (`CommunActionBar`).
 *
 * À ne pas confondre avec « Retirer de l'annuaire », réversible, rangé juste au-dessus dans le
 * même menu : d'où un libellé qui dit « le commun », et une confirmation qui énumère ce qui
 * disparaît.
 */
export interface CommunDeleteActionOptions {
  api: Api | null;
  /**
   * Auteur du commun ou admin de l'appel (`perms.canDeleteCommun`). Gate d'AFFICHAGE seulement :
   * le backend reste la source de vérité (`Authorisation::canDeleteElement`).
   */
  canDelete: boolean;
  answerId: string | null;
  /** Titre affiché dans la confirmation. Absent, une phrase sans titre prend le relais. */
  communTitle?: string | null;
  /**
   * Enveloppe de financement du commun — la fiche l'a DÉJÀ résolue (`useAacFundingResource`), on
   * ne la recharge pas. C'est elle qui dit s'il y a eu des versements, et ce que la cascade
   * emporterait.
   */
  resource?: CagnotteResource | null;
  /** L'enveloppe est en vol : sans elle, on ignore si de l'argent a été versé. */
  isResourceLoading?: boolean;
  /** Appelé après une suppression réussie — la fiche n'a plus lieu d'être affichée. */
  onDeleted?: () => void;
}

export interface CommunDeleteAction {
  canDelete: boolean;
  isPending: boolean;
  request: () => void;
  /** La confirmation, à rendre HORS du menu : le contenu d'un menu est démonté à sa fermeture. */
  dialog: ReactNode;
}

export function useCommunDeleteAction({
  api,
  canDelete,
  answerId,
  communTitle,
  resource,
  isResourceLoading,
  onDeleted,
}: CommunDeleteActionOptions): CommunDeleteAction {
  const [open, setOpen] = useState(false);
  const plan = useMemo(() => resolveCommunDeletionPlan(resource), [resource]);
  const suppression = useDeleteCommun({ api, onDeleted });

  // Rien à proposer sans le droit — contrairement à la sélection, dont le statut reste une
  // information utile au visiteur, une suppression interdite n'a pas d'état à afficher.
  const peutSupprimer = canDelete && Boolean(answerId);

  const confirmer = (withProject: boolean) => {
    if (!answerId) return;
    suppression.mutate(
      {
        answerId,
        withProject,
        projectId: plan.projectId,
        actionIds: plan.actionIds,
      },
      { onSuccess: () => setOpen(false) }
    );
  };

  const dialog = peutSupprimer ? (
    <CommunDeleteDialog
      open={open}
      onOpenChange={(ouvert) => {
        // Ne pas lâcher le dialogue pendant l'appel : la suppression en vol doit garder son état
        // de progression sous les yeux.
        if (!ouvert && suppression.isPending) return;
        setOpen(ouvert);
      }}
      communTitle={communTitle}
      plan={plan}
      isPlanLoading={isResourceLoading}
      isPending={suppression.isPending}
      onConfirm={confirmer}
    />
  ) : null;

  return {
    canDelete: peutSupprimer,
    isPending: suppression.isPending,
    request: () => setOpen(true),
    dialog,
  };
}
