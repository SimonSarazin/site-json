import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { formatAacAmount } from "../../lib/aacDisplay";
import type { CommunDeletionPlan } from "../../lib/communDeletion";

/**
 * Confirmation de suppression d'un commun, partagée par la fiche et l'annuaire. Trois états :
 *
 *  1. enveloppe en vol → pas de validation possible : sans le plan, on ignore si de l'argent a
 *     été versé ;
 *  2. versements existants → suppression interdite, motif chiffré, et aucun bouton de
 *     validation — un bouton désactivé laisse chercher ce qui le débloquerait ;
 *  3. rien versé → confirmation, et si un projet est lié, la possibilité de l'emporter.
 */
export interface CommunDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Titre du commun ; vide ou absent, une phrase sans titre prend le relais. */
  communTitle?: string | null;
  /** Ce que la suppression emporterait, résolu par `resolveCommunDeletionPlan`. */
  plan: CommunDeletionPlan;
  /** L'enveloppe est en vol : le plan n'est pas encore digne de confiance. */
  isPlanLoading?: boolean;
  isPending?: boolean;
  /** `withProject` dit si l'utilisateur a demandé d'emporter le projet et ses actions. */
  onConfirm: (withProject: boolean) => void;
}

export function CommunDeleteDialog({
  open,
  onOpenChange,
  communTitle,
  plan,
  isPlanLoading,
  isPending,
  onConfirm,
}: CommunDeleteDialogProps) {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");

  // Décoché par défaut : emporter le projet est un SECOND geste destructif, il
  // se demande, il ne se subit pas.
  const [withProject, setWithProject] = useState(false);

  // Chaque ouverture repart du défaut : dans l'annuaire, le dialogue est partagé par toutes
  // les cartes, et la case cochée pour un commun resterait cochée pour le suivant.
  // Ajustement pendant le RENDU, pas en effet, qui l'afficherait cochée une frame.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setWithProject(false);
  }

  const titre = communTitle?.trim();
  const aUnProjet = plan.projectId !== null;

  const description = titre
    ? String(t("delete.confirm.description", undefined, { title: titre }))
    : String(t("delete.confirm.descriptionNoTitle"));

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {String(t(plan.isBlocked ? "delete.blocked.title" : "delete.confirm.title"))}
          </AlertDialogTitle>

          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {isPlanLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  {String(t("delete.checking"))}
                </span>
              ) : plan.isBlocked ? (
                <>
                  <span className="block">
                    {String(
                      t("delete.blocked.description", undefined, {
                        amount: formatAacAmount(plan.paymentAmount),
                        count: String(plan.paymentCount),
                      })
                    )}
                  </span>
                  {/* Un refus nomme le geste réversible qui répond au même besoin. */}
                  <span className="block">{String(t("delete.blocked.hint"))}</span>
                </>
              ) : (
                <span className="block">{description}</span>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* L'option de cascade ne s'affiche que sur un commun supprimable ET
            porteur d'un projet — la proposer ailleurs serait sans objet. */}
        {!isPlanLoading && !plan.isBlocked && aUnProjet && (
          <label className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <Checkbox
              checked={withProject}
              onCheckedChange={(v) => setWithProject(v === true)}
              disabled={isPending}
              className="mt-0.5"
            />
            <span className="space-y-1">
              <span className="block font-medium">
                {String(
                  t("delete.withProject.label", undefined, {
                    count: String(plan.actionIds.length),
                  })
                )}
              </span>
              <span className="text-muted-foreground block">
                {String(
                  t(
                    withProject
                      ? "delete.withProject.checkedHint"
                      : "delete.withProject.uncheckedHint"
                  )
                )}
              </span>
            </span>
          </label>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {String(t(plan.isBlocked ? "delete.blocked.close" : "delete.cancel"))}
          </AlertDialogCancel>

          {/* Aucun bouton de validation quand c'est refusé, ni tant que le plan
              n'est pas connu : on ne fait pas cliquer sur ce qu'on ne sait pas. */}
          {!plan.isBlocked && !isPlanLoading && (
            <AlertDialogAction
              onClick={(e) => {
                // Le dialogue reste ouvert : la mutation le ferme au succès, sinon
                // l'état de chargement du bouton ne serait jamais visible.
                e.preventDefault();
                onConfirm(withProject);
              }}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mr-2 size-4" aria-hidden="true" />
              )}
              {String(
                t(withProject ? "delete.confirm.confirmWithProject" : "delete.confirm.confirm")
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
