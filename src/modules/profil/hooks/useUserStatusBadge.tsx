import { useT } from "@/hooks/useT";
import { Badge } from "@/components/ui/badge";
import { isOrganization, isProject, isEvent, isUser } from "@/lib/getTypedEntity";
import type { User, Organization, EntityTypes } from "@communecter/cocolight-api-client";
import { Crown, User as UserIcon, Mail, Clock } from "lucide-react";

/**
 * Hook pour obtenir le badge de statut d'un utilisateur
 * Basé sur getUserStatusBadge d'InviteMemberDialog avec design responsive
 */
export function useUserStatusBadge() {
  const t = useT("modules/profil");

  const getUserStatusBadge = (user: User | Organization, entity: EntityTypes | null) => {
    if (!entity || !isUser(user)) return null;

    // États spécifiques selon le type d'entité
    if (isOrganization(entity)) {
      if (user.isAdmin?.()) {
        return (
          <Badge variant="default">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.admin")}</span>
            <Crown className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isMember?.()) {
        return (
          <Badge variant="secondary">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.member")}</span>
            <UserIcon className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isInvitingAdmin?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.adminInvitationPending")}</span>
            <Crown className="sm:hidden w-3 h-3 animate-pulse" />
          </Badge>
        );
      }
      if (user.isAdminPending?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.adminRequestPending")}</span>
            <Clock className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isInviting?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.invitationPending")}</span>
            <Mail className="sm:hidden w-3 h-3 animate-pulse" />
          </Badge>
        );
      }
      if (user.isToBeValidated?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.validationPending")}</span>
            <Clock className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
    } else if (isProject(entity)) {
      if (user.isAdmin?.()) {
        return (
          <Badge variant="default">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.admin")}</span>
            <Crown className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isContributor?.()) {
        return (
          <Badge variant="secondary">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.contributor")}</span>
            <UserIcon className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isInvitingAdmin?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.adminInvitationPending")}</span>
            <Crown className="sm:hidden w-3 h-3 animate-pulse" />
          </Badge>
        );
      }
      if (user.isAdminPending?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.adminRequestPending")}</span>
            <Clock className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isInviting?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.invitationPending")}</span>
            <Mail className="sm:hidden w-3 h-3 animate-pulse" />
          </Badge>
        );
      }
      if (user.isToBeValidated?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.validationPending")}</span>
            <Clock className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
    } else if (isEvent(entity)) {
      if (user.isAttendee?.()) {
        return (
          <Badge variant="secondary">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.participant")}</span>
            <UserIcon className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
      if (user.isInviting?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.invitationPending")}</span>
            <Mail className="sm:hidden w-3 h-3 animate-pulse" />
          </Badge>
        );
      }
      if (user.isToBeValidated?.()) {
        return (
          <Badge variant="outline">
            <span className="hidden sm:inline">{t("InviteMemberDialog.badges.validationPending")}</span>
            <Clock className="sm:hidden w-3 h-3" />
          </Badge>
        );
      }
    }

    return null;
  };

  return { getUserStatusBadge };
}