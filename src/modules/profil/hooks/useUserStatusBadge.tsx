import { useT } from "@/hooks/useT";
import { Badge } from "@/components/ui/badge";
import type { User, Organization, EntityTypes } from "@communecter/cocolight-api-client";
import { Crown, User as UserIcon, Mail, Clock } from "lucide-react";
import { useCocolight } from "@/hooks/useCocolight";

export function useUserStatusBadge() {
  const t = useT("modules/profil");
  const { me } = useCocolight();

  const getUserStatusBadge = (user: User | Organization, entity: EntityTypes | null) => {
    if (!entity || !me?.isConnected || !entity?.isConnected) {
      return null;
    }

    const userObj = user as User;
    if (user.getEntityType?.() !== "citoyens" || !userObj?.userContext) {
      return null;
    }

    const entityType = entity.getEntityType?.();

    if (entityType === "organizations") {
      if (user.isAdmin?.()) {
        return (
          <Badge variant="default" className="text-xs">
            <Crown className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">{t("badges.admin")}</span>
            <span className="sm:hidden">Admin</span>
          </Badge>
        );
      }
      if (user.isMember?.()) {
        return (
          <Badge variant="secondary" className="text-xs">
            <UserIcon className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">{t("badges.member")}</span>
            <span className="sm:hidden">Membre</span>
          </Badge>
        );
      }
      if (user.isInvitingAdmin?.()) {
        return (
          <Badge variant="outline" className="text-xs">
            <Crown className="w-3 h-3 mr-1 animate-pulse" />
            <span className="hidden sm:inline">{t("badges.adminInvitationPending")}</span>
            <span className="sm:hidden">Inv. Admin</span>
          </Badge>
        );
      }
      if (user.isAdminPending?.()) {
        return (
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">{t("badges.adminRequestPending")}</span>
            <span className="sm:hidden">Dem. Admin</span>
          </Badge>
        );
      }
      if (user.isInviting?.()) {
        return (
          <Badge variant="outline" className="text-xs">
            <Mail className="w-3 h-3 mr-1 animate-pulse" />
            <span className="hidden sm:inline">{t("badges.invitationPending")}</span>
            <span className="sm:hidden">Invité</span>
          </Badge>
        );
      }
      if (user.isToBeValidated?.()) {
        return (
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">{t("badges.validationPending")}</span>
            <span className="sm:hidden">En attente</span>
          </Badge>
        );
      }
    }

    if (entityType === "projects") {
      if (user.isAdmin?.()) {
        return (
          <Badge variant="default" className="text-xs">
            <Crown className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">{t("badges.admin")}</span>
            <span className="sm:hidden">Admin</span>
          </Badge>
        );
      }
      if (user.isContributor?.()) {
        return (
          <Badge variant="secondary" className="text-xs">
            <UserIcon className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">{t("badges.contributor")}</span>
            <span className="sm:hidden">Contrib.</span>
          </Badge>
        );
      }
      if (user.isInvitingAdmin?.()) {
        return (
          <Badge variant="outline" className="text-xs">
            <Crown className="w-3 h-3 mr-1 animate-pulse" />
            <span className="hidden sm:inline">{t("badges.adminInvitationPending")}</span>
            <span className="sm:hidden">Inv. Admin</span>
          </Badge>
        );
      }
      if (user.isInviting?.()) {
        return (
          <Badge variant="outline" className="text-xs">
            <Mail className="w-3 h-3 mr-1 animate-pulse" />
            <span className="hidden sm:inline">{t("badges.invitationPending")}</span>
            <span className="sm:hidden">Invité</span>
          </Badge>
        );
      }
      if (user.isToBeValidated?.()) {
        return (
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">{t("badges.validationPending")}</span>
            <span className="sm:hidden">En attente</span>
          </Badge>
        );
      }
    }

    if (entityType === "events") {
      if (user.isAttendee?.()) {
        return (
          <Badge variant="secondary" className="text-xs">
            <UserIcon className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">{t("badges.participant")}</span>
            <span className="sm:hidden">Participant</span>
          </Badge>
        );
      }
      if (user.isInviting?.()) {
        return (
          <Badge variant="outline" className="text-xs">
            <Mail className="w-3 h-3 mr-1 animate-pulse" />
            <span className="hidden sm:inline">{t("badges.invitationPending")}</span>
            <span className="sm:hidden">Invité</span>
          </Badge>
        );
      }
      if (user.isToBeValidated?.()) {
        return (
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">{t("badges.validationPending")}</span>
            <span className="sm:hidden">En attente</span>
          </Badge>
        );
      }
    }

    return null;
  };

  return { getUserStatusBadge };
}
