import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "./ConfirmationDialog";
import type { EntityAction } from "../../types";

interface StatusDropdownLayoutProps {
  actions: EntityAction[];
  statusLabel: string;
  statusIcon: React.ReactNode;
  statusVariant: "default" | "outline";
  /**
   * Action à confirmer dès l'arrivée, portée par l'URL (`?participer`) — choisie par l'appelant,
   * qui seul sait quelle entité et quelle action elle vise. Ouverte tant qu'elle est fournie :
   * c'est `onUrlActionDone` (appelé à la fermeture, confirmée ou non) qui retire le paramètre.
   */
  urlAction?: EntityAction | null;
  onUrlActionDone?: () => void;
}

/**
 * Layout avec menu déroulant et bouton de statut
 * Utilisé pour les organisations (affiche Admin/Membre/Suivi)
 */
export function StatusDropdownLayout({
  actions,
  statusLabel,
  statusIcon,
  statusVariant,
  urlAction = null,
  onUrlActionDone,
}: StatusDropdownLayoutProps) {
  const [confirmationAction, setConfirmationAction] = useState<EntityAction | null>(null);
  // L'ouverture est DÉRIVÉE (clic de l'utilisateur, sinon URL), jamais posée par un effet.
  const openAction = confirmationAction ?? urlAction;

  if (actions.length === 0) return null;

  const closeConfirmation = () => {
    setConfirmationAction(null);
    if (urlAction) onUrlActionDone?.();
  };

  const handleActionClick = (action: EntityAction) => {
    if (action.requiresConfirmation) {
      setConfirmationAction(action);
    } else {
      action.onClick();
    }
  };

  // Pas de `closeConfirmation()` ici : `AlertDialogAction` referme le dialogue de lui-même, et
  // c'est `onOpenChange(false)` qui consomme l'intention URL — une seule fois.
  const handleConfirm = () => {
    if (openAction) {
      openAction.onClick();
      setConfirmationAction(null);
    }
  };

  // Séparer les actions par catégorie
  const followActions = actions.filter((a) => a.type === "follow" || a.type === "unfollow");
  const membershipActions = actions.filter((a) => a.type === "join" || a.type === "leave");
  const invitationActions = actions.filter((a) => a.type === "accept" || a.type === "reject");
  const pendingActions = actions.filter((a) => a.type === "pending");
  // Suppression de la fiche : toujours en DERNIER et derrière un séparateur, pour qu'elle ne se
  // confonde pas avec les actions de lien (quitter, ne plus suivre) qui, elles, sont réversibles.
  const dangerActions = actions.filter((a) => a.type === "delete");

  // Calcul des séparateurs nécessaires
  const hasFollow = followActions.length > 0;
  const hasMembership = membershipActions.length > 0;
  const hasInvitation = invitationActions.length > 0;
  const hasPending = pendingActions.length > 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={statusVariant} className="gap-2">
            {statusIcon}
            <span className="hidden sm:inline">{statusLabel}</span>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        {/* z au-dessus de CustomDrawer (z-99999) : sinon le menu portalé (défaut
            shadcn z-50) sort SOUS le panneau du drawer quand l'aperçu event est
            ouvert (Participer/Suivre invisibles). */}
        <DropdownMenuContent align="end" className="z-[100000] w-56">
          {/* Actions Follow/Unfollow */}
          {followActions.filter((a) => a.show).map((action) => (
            <DropdownMenuItem key={action.id} onClick={() => handleActionClick(action)}>
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}

          {/* Séparateur après follow si autres actions */}
          {hasFollow && (hasMembership || hasInvitation || hasPending) && <DropdownMenuSeparator />}

          {/* Actions d'invitation (Accepter/Refuser) */}
          {invitationActions.filter((a) => a.show).map((action) => (
            <DropdownMenuItem
              key={action.id}
              onClick={() => handleActionClick(action)}
              variant={action.type === "reject" ? "destructive" : "default"}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}

          {/* Séparateur après invitation si autres actions */}
          {hasInvitation && (hasMembership || hasPending) && <DropdownMenuSeparator />}

          {/* Badges en attente (non cliquables) */}
          {pendingActions.filter((a) => a.show).map((action) => (
            <DropdownMenuItem
              key={action.id}
              disabled
              className="opacity-70 cursor-default"
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}

          {/* Séparateur après pending si membership */}
          {hasPending && hasMembership && <DropdownMenuSeparator />}

          {/* Actions Membership/Leave */}
          {membershipActions.filter((a) => a.show).map((action) => (
            <DropdownMenuItem
              key={action.id}
              onClick={() => handleActionClick(action)}
              variant={action.isDestructive ? "destructive" : "default"}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}

          {/* Suppression définitive de la fiche (séparée du reste) */}
          {dangerActions.filter((a) => a.show).length > 0 && <DropdownMenuSeparator />}
          {dangerActions.filter((a) => a.show).map((action) => (
            <DropdownMenuItem
              key={action.id}
              onClick={() => handleActionClick(action)}
              variant="destructive"
              disabled={action.isPending}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogue de confirmation */}
      {openAction && (
        <ConfirmationDialog
          open
          onOpenChange={(open) => !open && closeConfirmation()}
          title={openAction.confirmationTitle || ""}
          description={openAction.confirmationDescription || ""}
          confirmLabel={openAction.confirmationConfirm || "Confirmer"}
          cancelLabel={openAction.confirmationCancel || "Annuler"}
          onConfirm={handleConfirm}
          isDestructive={openAction.isDestructive}
        />
      )}
    </>
  );
}
