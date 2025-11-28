import { useT } from "@/hooks/useT";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    <AlertDialog open={confirmation.open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmation.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={confirmation.isDestructive ? "bg-red-600 hover:bg-red-700" : ""}
          >
            {t("common.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}