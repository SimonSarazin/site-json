import { Mail, Check, X } from "lucide-react";
import { useNavigate } from "react-router";
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
  const navigate = useNavigate();

  const name = entity?.serverData?.name ?? "";
  const isOrganization = entityType === "organization";

  // Réponse donnée → on quitte la page courante, quelle qu'elle soit. La modale s'ouvre partout, y compris
  // par-dessus la page du lien Accepter/Refuser du mail (AcceptInvitationPage), dont elle masque le
  // bouton : l'invitation une fois tranchée ici, cette page n'a plus d'objet. Acceptée → la fiche
  // rejointe (comme « Continuer » sur AcceptInvitationPage) ; refusée, ou fiche sans slug → l'accueil.
  const slug = entity?.slug;
  const onRepondu = (destination: string) => () => {
    setOpen(false);
    navigate(destination);
  };

  const handleAccept = () => {
    acceptMutation.mutate(undefined, { onSuccess: onRepondu(slug ? `/profil/${encodeURIComponent(slug)}` : "/") });
  };

  const handleDecline = () => {
    rejectMutation.mutate(undefined, { onSuccess: onRepondu("/") });
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
