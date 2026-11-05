import { Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAnnouncer } from "@/modules/kanban/components/board/useAnnouncer";
import { ChoiceRow } from "@/modules/kanban/components/ui/ChoiceRow";
import { kanbanErrorText } from "@/modules/kanban/lib/kanbanErrors";
import type { RoleEntry, RoleMember } from "@/modules/kanban/types";
import { memberHoldsRole, roleWriteRefusedMessage } from "./rolesBoard";

export interface RoleAssignmentDialogProps {
  open: boolean;
  /** Le membre TEL QUE LA LISTE LE SERT à chaque rendu : les cases suivent le cache optimiste. */
  member: RoleMember;
  roles: readonly RoleEntry[];
  /**
   * Écritures : la PROMESSE de la mutation (`mutateAsync`), rejetée au refus. Le hook a déjà
   * reposé le cache et notifié la raison ; la boîte s'en sert pour que sa ligne de statut dise
   * la vérité.
   */
  onAssign: (role: string) => Promise<unknown>;
  onUnassign: (role: string) => Promise<unknown>;
  onClose: () => void;
  /** Où rendre le focus à la fermeture : la boîte s'ouvre depuis un menu déjà disparu. */
  returnFocus?: () => HTMLElement | null;
}

/**
 * Boîte « Rôles de … » — l'ALTERNATIVE au glisser, au clavier et au doigt : une case par rôle,
 * cocher attribue, décocher retire, et chaque changement part aussitôt (un appel par case, D29).
 *
 * La ligne de statut, visible et vivante (montée dès le premier rendu), suit l'ÉTAT RÉEL du
 * cache : si le serveur refuse, le retour arrière repose la case et la ligne le redit, avec la
 * raison — sans quoi elle affirmerait une attribution qui n'a pas eu lieu.
 */
export function RoleAssignmentDialog({ open, member, roles, onAssign, onUnassign, onClose, returnFocus }: RoleAssignmentDialogProps) {
  const { t } = useTranslation("modules/kanban");
  const [status, announce] = useAnnouncer();
  const title = t("views.roles.rolesOf", { name: member.name });

  async function toggle(role: RoleEntry, checked: boolean) {
    announce(t(checked ? "views.roles.assigned" : "views.roles.removed", { role: role.name, name: member.name }));
    try {
      await (checked ? onAssign(role.name) : onUnassign(role.name));
    } catch (error) {
      const message = roleWriteRefusedMessage(checked ? "assign" : "unassign", member.name, role.name, kanbanErrorText(t, error));
      announce(t(message.key, message.values));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(event) => {
          const target = returnFocus?.();
          if (!target) return;
          // Radix rendrait le focus à l'élément actif à l'ouverture : l'item du menu, déjà retiré.
          event.preventDefault();
          target.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("views.roles.rolesDialogHint")}</DialogDescription>
        </DialogHeader>
        {roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("views.roles.noRolesYet")}</p>
        ) : (
          <fieldset className="min-w-0">
            <legend className="sr-only">{title}</legend>
            <ul className="flex max-h-[50dvh] flex-col gap-1 overflow-y-auto pr-1">
              {roles.map((role) => (
                <li key={role.name}>
                  <ChoiceRow
                    checked={memberHoldsRole(member, role.name)}
                    onChange={(event) => void toggle(role, event.target.checked)}
                    leading={<Tag aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />}
                    trailing={t("views.roles.holderCount", { count: role.memberIds.length })}
                  >
                    <span className="block truncate">{role.name}</span>
                  </ChoiceRow>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        {/* Région vivante MONTÉE EN PERMANENCE : un conteneur qui apparaît avec son texte n'est
            pas annoncé par tous les lecteurs. */}
        <p role="status" aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
          {status}
        </p>
        <DialogFooter>
          <Button onClick={onClose}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
