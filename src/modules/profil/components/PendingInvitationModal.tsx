import { Mail, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/hooks/useT";
import { useAcceptInvitation, useRejectInvitation } from "../actions/mutations/relationship";
import { usePendingSiteInvitation } from "../hooks/usePendingSiteInvitation";

/**
 * Modale globale d'invitation en attente — à monter une seule fois dans le
 * layout racine (RootLayout/SiteShell), même principe que DiscourseGlobalModal
 * (modules/interop) : si l'utilisateur connecté est invité à rejoindre (ou
 * administrer) l'entité du site courant, on le lui propose sans qu'il ait à
 * aller chercher le bouton de statut sur la page profil de l'entité.
 */
export default function PendingInvitationModal() {
  const { open, setOpen, entity, entityType, isInvitingAdmin } = usePendingSiteInvitation();
  const t = useT("modules/profil");

  const acceptMutation = useAcceptInvitation(entity);
  const rejectMutation = useRejectInvitation(entity);

  const name = entity?.serverData?.name ?? "";
  const isOrganization = entityType === "organization";

  const handleAccept = () => {
    acceptMutation.mutate(undefined, { onSuccess: () => setOpen(false) });
  };

  const handleDecline = () => {
    rejectMutation.mutate(undefined, { onSuccess: () => setOpen(false) });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        // Modale à réponse obligatoire : l'utilisateur doit accepter ou refuser
        // l'invitation, pas la faire disparaître sans y répondre (pas de croix,
        // Échap et clic extérieur neutralisés). Seuls handleAccept/handleDecline
        // appellent setOpen(false) via le onSuccess de la mutation.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 uppercase tracking-wide text-sm font-bold">
            <Mail className="h-4 w-4 text-primary" />
            {isInvitingAdmin
              ? t("PendingInvitationModal.titleAdmin")
              : t("PendingInvitationModal.title")}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {isInvitingAdmin
            ? isOrganization
              ? t("PendingInvitationModal.descriptionOrganizationAdmin", undefined, { name })
              : t("PendingInvitationModal.descriptionProjectAdmin", undefined, { name })
            : isOrganization
              ? t("PendingInvitationModal.descriptionOrganization", undefined, { name })
              : t("PendingInvitationModal.descriptionProject", undefined, { name })}
        </p>

        <div className="flex justify-end gap-2 mt-2">
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={rejectMutation.isPending}
          >
            <X className="h-4 w-4 mr-1" />
            {t("PendingInvitationModal.decline")}
          </Button>
          <Button onClick={handleAccept} disabled={acceptMutation.isPending}>
            <Check className="h-4 w-4 mr-1" />
            {t("PendingInvitationModal.accept")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
