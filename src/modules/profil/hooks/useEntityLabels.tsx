import { useT } from "@/hooks/useT";
import { isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import type { EntityTypes } from "@communecter/cocolight-api-client";

/**
 * Hook pour obtenir les labels spécifiques selon le type d'entité
 * Mutualise la logique des getEntityLabels() de ProfileMembers, MemberManagementDialog et InviteMemberDialog
 */
export function useEntityLabels(entity: EntityTypes | null) {
  const t = useT("modules/profil");

  if (!entity) {
    return {
      title: t("ProfileMembers.title"),
      member: t("ProfileMembers.member"),
      members: t("ProfileMembers.members"),
      admin: t("ProfileMembers.admin"),
      pending: t("ProfileMembers.pending"),
      invite: t("ProfileMembers.invite"),
      // Labels pour les dialogues
      managementTitle: t("MemberManagementDialog.title"),
      inviteTitle: t("InviteMemberDialog.title"),
      description: t("InviteMemberDialog.description"),
    };
  }

  // Déterminer les labels selon le type d'entité
  if (isOrganization(entity)) {
    return {
      title: t("ProfileMembers.organization.title"),
      member: t("ProfileMembers.organization.member"),
      members: t("ProfileMembers.organization.members"),
      admin: t("ProfileMembers.organization.admin"),
      pending: t("ProfileMembers.organization.pending"),
      invite: t("ProfileMembers.organization.invite"),
      // Labels pour les dialogues
      managementTitle: t("MemberManagementDialog.organization.title"),
      inviteTitle: t("InviteMemberDialog.organization.title"),
      description: t("InviteMemberDialog.organization.description"),
    };
  } else if (isProject(entity)) {
    return {
      title: t("ProfileMembers.project.title"),
      member: t("ProfileMembers.project.contributor"),
      members: t("ProfileMembers.project.contributors"),
      admin: t("ProfileMembers.project.admin"),
      pending: t("ProfileMembers.project.pending"),
      invite: t("ProfileMembers.project.invite"),
      // Labels pour les dialogues
      managementTitle: t("MemberManagementDialog.project.title"),
      inviteTitle: t("InviteMemberDialog.project.title"),
      description: t("InviteMemberDialog.project.description"),
    };
  } else if (isEvent(entity)) {
    return {
      title: t("ProfileMembers.event.title"),
      member: t("ProfileMembers.event.participant"),
      members: t("ProfileMembers.event.participants"),
      admin: t("ProfileMembers.event.author"),
      pending: t("ProfileMembers.event.pending"),
      invite: t("ProfileMembers.event.invite"),
      // Labels pour les dialogues
      managementTitle: t("MemberManagementDialog.event.title"),
      inviteTitle: t("InviteMemberDialog.event.title"),
      description: t("InviteMemberDialog.event.description"),
    };
  }

  // Fallback
  return {
    title: t("ProfileMembers.title"),
    member: t("ProfileMembers.member"),
    members: t("ProfileMembers.members"),
    admin: t("ProfileMembers.admin"),
    pending: t("ProfileMembers.pending"),
    invite: t("ProfileMembers.invite"),
    // Labels pour les dialogues
    managementTitle: t("MemberManagementDialog.title"),
    inviteTitle: t("InviteMemberDialog.title"),
    description: t("InviteMemberDialog.description"),
  };
}