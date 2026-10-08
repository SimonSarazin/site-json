import { useState } from "react";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TagsInput } from "@/components/form/TagsInput";
import { Loader2, Tag } from "lucide-react";
import { useSetMemberRoles } from "../../actions/mutations/member";
import { rolesDuMembre, rolesExistantsDeLEntite } from "../../lib/memberRoles";

interface ManageRolesDialogProps {
  entity: EntityTypes | null;
  /** Membre dont on édite les rôles ; `null` = dialogue fermé (pas de `member` sans `open`). */
  member: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Édite les rôles d'un membre DÉJÀ LIÉ (`User.setRoles`, `LINK_SET_ROLES`) — un `TagsInput` édite
 * directement la liste COMPLÈTE, cohérent avec le remplacement intégral côté SDK (pas d'ajout/retrait
 * séparé possible). Pré-rempli depuis `rolesDuMembre` (lien du membre, repli sur celui de l'entité).
 */
export function ManageRolesDialog({ entity, member, open, onOpenChange }: ManageRolesDialogProps) {
  const t = useT("modules/profil");
  const setRoles = useSetMemberRoles(entity);

  const liensEntite = entity?.serverData?.links as Record<string, unknown> | undefined;
  const rolesInitiaux = rolesDuMembre(
    member?.serverData?.links as Record<string, unknown> | undefined,
    entity?.id,
    liensEntite,
    member?.id,
  );
  const rolesSuggeres = rolesExistantsDeLEntite(liensEntite);

  // Reset PENDANT le rendu (pas un effet) dès que le membre ciblé change — même pattern que
  // `usePagedFeedNav` : évite un rendu intermédiaire avec les rôles du membre précédent.
  const [draft, setDraft] = useState<string[]>(rolesInitiaux);
  const [prevMemberId, setPrevMemberId] = useState(member?.id ?? null);
  if ((member?.id ?? null) !== prevMemberId) {
    setPrevMemberId(member?.id ?? null);
    setDraft(rolesInitiaux);
  }

  const handleClose = (next: boolean) => {
    if (!next) onOpenChange(false);
  };

  const handleSave = () => {
    if (!member) return;
    setRoles.mutate(
      { user: member, roles: draft },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            <span>{t("ManageRolesDialog.title")}</span>
          </DialogTitle>
          <DialogDescription>
            {t("ManageRolesDialog.description", undefined, { name: member.serverData?.name || "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("InviteMemberDialog.rolesLabel")}</Label>
          <TagsInput
            tags={draft}
            onTagsChange={setDraft}
            searchable={false}
            suggestions={rolesSuggeres}
            texts={{ placeholder: t("InviteMemberDialog.rolesPlaceholder") }}
          />
          <p className="text-xs text-muted-foreground">{t("InviteMemberDialog.rolesHint")}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={setRoles.isPending}>
            {setRoles.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("ManageRolesDialog.saving")}
              </>
            ) : (
              t("ManageRolesDialog.save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export default ManageRolesDialog;
