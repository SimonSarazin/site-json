import { useT } from "@/hooks/useT";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { ConfirmationState } from "../../hooks/useConfirmationDialog";

interface ConfirmationDialogProps {
  confirmation: ConfirmationState;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Composant AlertDialog de confirmation réutilisable
 * Mutualise le code identique d'InviteMemberDialog et MemberManagementDialog
 */
export function ConfirmationDialog({ confirmation, onOpenChange, onConfirm }: ConfirmationDialogProps) {
  const t = useT("modules/profil");

  return (
    <ConfirmDialog
      open={confirmation.open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={confirmation.title}
      description={confirmation.description}
      confirmLabel={t("common.confirm")}
      cancelLabel={t("common.cancel")}
      isDestructive={confirmation.isDestructive}
    />
  );
}