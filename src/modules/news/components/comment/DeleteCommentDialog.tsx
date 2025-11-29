import { useT } from "@/hooks/useT";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface DeleteCommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function DeleteCommentDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: DeleteCommentDialogProps) {
  const t = useT("modules/news");

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={t("comments.deleteDialog.title")}
      description={t("comments.deleteDialog.description")}
      confirmLabel={t("comments.deleteDialog.confirm")}
      cancelLabel={t("comments.deleteDialog.cancel")}
      isDestructive
      isPending={isPending}
    />
  );
}