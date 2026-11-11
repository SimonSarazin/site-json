import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DangerNotice } from "@/modules/kanban/components/ui/FailureNotice";

export interface RoleDeleteDialogProps {
  open: boolean;
  role: string;
  /** Porteurs RÉELS du rôle : la confirmation dit « retiré de N membres ». */
  holderCount: number;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirmation de « Supprimer ce rôle » (D29) : le rôle est retiré de chacun de ses porteurs,
 * des deux côtés du lien, puis de la liste déclarée de l'élément — irréversible, et la phrase
 * compte les membres touchés. Sans porteur, la colonne disparaît, et la phrase le dit sans
 * bandeau d'alerte.
 */
export function RoleDeleteDialog({ open, role, holderCount, onConfirm, onClose }: RoleDeleteDialogProps) {
  const { t } = useTranslation("modules/kanban");
  const message = t("views.roles.deleteRoleConfirm", { role, count: holderCount });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("views.roles.deleteRole")}</DialogTitle>
          <DialogDescription>{role}</DialogDescription>
        </DialogHeader>
        {holderCount > 0 ? <DangerNotice>{message}</DangerNotice> : <p className="text-sm text-foreground">{message}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            <Trash2 aria-hidden />
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
