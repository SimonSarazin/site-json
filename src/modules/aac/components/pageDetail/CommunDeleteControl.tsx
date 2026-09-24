import { useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import type { Api } from "@communecter/cocolight-api-client";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { cn } from "@/lib/utils";
import type { CagnotteResource } from "@/modules/cagnotte/types";
import { useDeleteCommun } from "../../hooks/useDeleteCommun";
import { resolveCommunDeletionPlan } from "../../lib/communDeletion";
import { CommunDeleteDialog } from "./CommunDeleteDialog";

/**
 * Bouton « Supprimer le commun » de la fiche — parité du geste legacy (`campDetail.php:971`,
 * gate `:2590`).
 *
 * À ne pas confondre avec `CommunSelectionControl` et son « Retirer de l'annuaire », juste à
 * côté et réversible : d'où un libellé qui dit « le commun », et une confirmation qui énumère
 * ce qui disparaît.
 */
export interface CommunDeleteControlProps {
  api: Api | null;
  /**
   * Auteur du commun ou admin de l'appel (`perms.canDeleteCommun`). Gate
   * d'AFFICHAGE seulement : le backend reste la source de vérité
   * (`Authorisation::canDeleteElement`).
   */
  canDelete: boolean;
  answerId: string | null;
  /** Titre affiché dans la confirmation. Absent, une phrase sans titre prend le relais. */
  communTitle?: string | null;
  /**
   * Enveloppe de financement du commun — la fiche l'a DÉJÀ résolue
   * (`useAacFundingResource`), on ne la recharge pas. C'est elle qui dit s'il y
   * a eu des versements, et ce que la cascade emporterait.
   */
  resource?: CagnotteResource | null;
  /** L'enveloppe est en vol : sans elle, on ignore si de l'argent a été versé. */
  isResourceLoading?: boolean;
  /** Appelé après une suppression réussie — la fiche n'a plus lieu d'être affichée. */
  onDeleted?: () => void;
  className?: string;
}

export function CommunDeleteControl({
  api,
  canDelete,
  answerId,
  communTitle,
  resource,
  isResourceLoading,
  onDeleted,
  className,
}: CommunDeleteControlProps) {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const plan = useMemo(() => resolveCommunDeletionPlan(resource), [resource]);

  const suppression = useDeleteCommun({ api, onDeleted });

  // Rien à montrer sans le droit — contrairement à la sélection, dont le badge
  // de statut reste une information utile au visiteur. Une suppression dont on
  // n'a pas le droit n'a pas d'état à afficher.
  if (!canDelete || !answerId) return null;

  const confirmer = (withProject: boolean) => {
    suppression.mutate(
      {
        answerId,
        withProject,
        projectId: plan.projectId,
        actionIds: plan.actionIds,
      },
      { onSuccess: () => setConfirmOpen(false) }
    );
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          // Bouton `outline` teinté plutôt que `destructive` plein : il siège
          // dans une barre d'actions ordinaires (Modifier, Sélectionner), et un
          // aplat rouge y attirerait l'œil avant elles. Le rouge plein est
          // réservé à la confirmation, où il porte la décision.
          "gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
          className
        )}
        onClick={() => setConfirmOpen(true)}
        disabled={suppression.isPending}
      >
        {suppression.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
        {String(t("delete.cta"))}
      </Button>

      <CommunDeleteDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          // Ne pas lâcher le dialogue pendant l'appel : la suppression en vol
          // doit garder son état de progression sous les yeux.
          if (!open && suppression.isPending) return;
          setConfirmOpen(open);
        }}
        communTitle={communTitle}
        plan={plan}
        isPlanLoading={isResourceLoading}
        isPending={suppression.isPending}
        onConfirm={confirmer}
      />
    </>
  );
}
