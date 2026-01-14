import { useState } from "react";
import type { ConfirmationState } from "../types";

export type { ConfirmationState };

/**
 * Hook pour gérer l'état d'un dialogue de confirmation
 * Mutualise la logique des ConfirmationState d'InviteMemberDialog et MemberManagementDialog
 */
export function useConfirmationDialog() {
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    open: false,
    title: "",
    description: "",
    action: () => {},
  });

  const showConfirmation = (config: Omit<ConfirmationState, "open">) => {
    setConfirmation({ ...config, open: true });
  };

  const hideConfirmation = () => {
    setConfirmation(prev => ({ ...prev, open: false }));
  };

  const executeAction = () => {
    confirmation.action();
    hideConfirmation();
  };

  return {
    confirmation,
    showConfirmation,
    hideConfirmation,
    executeAction,
  };
}