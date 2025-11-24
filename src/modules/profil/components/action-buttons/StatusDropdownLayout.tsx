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

  // Séparer les actions follow/unfollow des actions membership/leave
  const followActions = actions.filter((a) => a.type === "follow" || a.type === "unfollow");
  const membershipActions = actions.filter((a) => a.type === "join" || a.type === "leave");
  const needsSeparator = followActions.length > 0 && membershipActions.length > 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={statusVariant} className="px-5 py-2.5 h-auto text-sm font-medium gap-2">
            {statusIcon}
            {statusLabel}
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

          {/* Séparateur si nécessaire */}
          {needsSeparator && <DropdownMenuSeparator />}

          {/* Actions Membership/Leave */}
          {membershipActions.filter((a) => a.show).map((action) => (
            <DropdownMenuItem
              key={action.id}
              onClick={() => handleActionClick(action)}
              className={
                action.isDestructive
                  ? "text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                  : undefined
              }
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
