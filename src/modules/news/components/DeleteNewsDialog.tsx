import { useT } from "@/hooks/useT";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface DeleteNewsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function DeleteNewsDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: DeleteNewsDialogProps) {
  const t = useT("modules/news");

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={t("deleteDialog.title")}
      description={t("deleteDialog.description")}
      confirmLabel={t("deleteDialog.confirm")}
      cancelLabel={t("deleteDialog.cancel")}
      isDestructive
      isPending={isPending}
    />
  );
}