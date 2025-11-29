import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  isDestructive?: boolean;
}

/**
 * Dialogue de confirmation réutilisable
 * Utilisé pour confirmer les actions importantes (unfollow, quitter, etc.)
 */
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  isDestructive = false,
}: ConfirmationDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      isDestructive={isDestructive}
    />
  );
}
