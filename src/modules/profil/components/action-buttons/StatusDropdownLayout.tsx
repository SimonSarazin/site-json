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
import type { EntityAction } from "../../hooks/useEntityActions";

interface StatusDropdownLayoutProps {
  actions: EntityAction[];
  statusLabel: string;
  statusIcon: React.ReactNode;
  statusVariant: "default" | "outline";
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
}: StatusDropdownLayoutProps) {
  const [confirmationAction, setConfirmationAction] = useState<EntityAction | null>(null);

  if (actions.length === 0) return null;

  const handleActionClick = (action: EntityAction) => {
    if (action.requiresConfirmation) {
      setConfirmationAction(action);
    } else {
      action.onClick();
    }
  };

  const handleConfirm = () => {
    if (confirmationAction) {
      confirmationAction.onClick();
      setConfirmationAction(null);
    }
  };

  // Séparer les actions par catégorie
  const followActions = actions.filter((a) => a.type === "follow" || a.type === "unfollow");
  const membershipActions = actions.filter((a) => a.type === "join" || a.type === "leave");
  const invitationActions = actions.filter((a) => a.type === "accept" || a.type === "reject");
  const pendingActions = actions.filter((a) => a.type === "pending");

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
        <DropdownMenuContent align="end" className="w-56">
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
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogue de confirmation */}
      {confirmationAction && (
        <ConfirmationDialog
          open={!!confirmationAction}
          onOpenChange={(open) => !open && setConfirmationAction(null)}
          title={confirmationAction.confirmationTitle || ""}
          description={confirmationAction.confirmationDescription || ""}
          confirmLabel={confirmationAction.confirmationConfirm || "Confirmer"}
          cancelLabel={confirmationAction.confirmationCancel || "Annuler"}
          onConfirm={handleConfirm}
          isDestructive={confirmationAction.isDestructive}
        />
      )}
    </>
  );
}
