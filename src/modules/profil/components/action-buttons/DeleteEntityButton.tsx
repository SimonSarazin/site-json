import { useState } from "react";
import { useNavigate } from "react-router";
import { Trash2 } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { isEvent } from "@/lib/getTypedEntity";
import { useProfilPermissions } from "../../hooks/useProfilPermissions";
import { useDeleteEvent } from "../../actions/mutations/deletion";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface DeleteEntityButtonProps {
  entity: EntityTypes | null;
  /** Masque le libellé sous `sm`, comme le bouton Éditer voisin. */
  compactLabel?: boolean;
}

/**
 * Bouton « Supprimer » d'une page de profil, posé à côté d'« Éditer ».
 *
 * Réservé aux ÉVÉNEMENTS : c'est le seul type pour lequel l'écran existe (cf. `useDeleteEvent`).
 * Même droit que l'édition (`canEditProfile` : auteur, admin de l'organisation ou du projet
 * organisateur, admin du costum) — le backend reste la source de vérité.
 *
 * La suppression est définitive : confirmation obligatoire, puis retour à l'accueil, car la page
 * de l'entité n'existe plus (l'instance lib est vidée et refuse toute opération ultérieure).
 */
export function DeleteEntityButton({ entity, compactLabel = false }: DeleteEntityButtonProps) {
  const t = useT("modules/profil");
  const navigate = useNavigate();
  const { canEditProfile } = useProfilPermissions(entity);
  const deleteMutation = useDeleteEvent(entity);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!entity || !isEvent(entity) || !canEditProfile) return null;

  const name = typeof entity.serverData?.name === "string" ? entity.serverData.name : "";

  return (
    <>
      <Button
        variant="outline"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={deleteMutation.isPending}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 />
        <span className={compactLabel ? "hidden sm:inline" : undefined}>
          {t("ProfileTemplateDefault.deleteEvent")}
        </span>
      </Button>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("ProfileTemplateDefault.deleteEventDialog.title")}
        description={t("ProfileTemplateDefault.deleteEventDialog.description", undefined, { name })}
        confirmLabel={t("ProfileTemplateDefault.deleteEventDialog.confirm")}
        cancelLabel={t("ProfileTemplateDefault.deleteEventDialog.cancel")}
        isDestructive
        onConfirm={() =>
          deleteMutation.mutate(undefined, {
            // La page courante porte le slug supprimé : y rester afficherait une fiche fantôme.
            onSuccess: () => navigate("/"),
          })
        }
      />
    </>
  );
}
