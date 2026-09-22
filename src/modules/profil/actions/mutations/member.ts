/**
 * Mutations pour la gestion des membres (admin actions)
 * Remplace useMemberMutations.tsx et useInviteMutations.tsx
 *
 * Ces actions peuvent notifier par e-mail (validation d'une demande de membre/admin, promotion,
 * retrait) : l'e-mail n'est brandé du costum que si la requête porte `costumSlug`. Ce contexte est
 * posé UNE fois sur le client API (`applySiteCostum` → `setSiteCostum`, cf. lib/siteCostum.ts) et
 * injecté par la lib sur les endpoints marqués — RIEN à faire ici ni dans `createUserMutation`
 * (core.ts explique pourquoi on n'y pose PAS de `setCostumScope`).
 */
import { createUserMutation } from "./core";

// =====================================================
// ADMIN MANAGEMENT
// =====================================================

/**
 * Hook pour promouvoir un membre en admin
 */
export const usePromoteMember = createUserMutation({
  action: async (user) => {
    if (user.promoteToAdmin) {
      await user.promoteToAdmin();
    }
  },
  i18n: {
    successKey: "toast.members.promoteSuccess",
    errorKey: "toast.members.promoteError",
  },
});

/**
 * Hook pour rétrograder un admin en membre
 */
export const useDemoteMember = createUserMutation({
  action: async (user) => {
    if (user.demoteFromAdmin) {
      await user.demoteFromAdmin();
    }
  },
  i18n: {
    successKey: "toast.members.demoteSuccess",
    errorKey: "toast.members.demoteError",
  },
});

/**
 * Hook pour retirer un membre
 */
export const useRemoveMember = createUserMutation({
  action: async (user) => {
    if (user.removeFromParent) {
      await user.removeFromParent();
    }
  },
  i18n: {
    successKey: "toast.members.removeSuccess",
    errorKey: "toast.members.removeError",
  },
});

// =====================================================
// VALIDATION
// =====================================================

/**
 * Hook pour valider une demande de membre
 */
export const useValidateMember = createUserMutation({
  action: async (user) => {
    if (user.validateMemberRequest) {
      await user.validateMemberRequest();
    }
  },
  i18n: {
    successKey: "toast.members.validateSuccess",
    errorKey: "toast.members.validateError",
  },
});

/**
 * Hook pour valider une demande d'admin
 */
export const useValidateAdmin = createUserMutation({
  action: async (user) => {
    if (user.validateAdminRequest) {
      await user.validateAdminRequest();
    }
  },
  i18n: {
    successKey: "toast.members.validateAdminSuccess",
    errorKey: "toast.members.validateAdminError",
  },
});

/**
 * Hook pour rejeter une demande de membre
 */
export const useRejectMember = createUserMutation({
  action: async (user) => {
    if (user.removeFromParent) {
      await user.removeFromParent();
    }
  },
  i18n: {
    successKey: "toast.members.removeSuccess",
    errorKey: "toast.members.removeError",
  },
});

// =====================================================
// INVITATIONS
// =====================================================

/**
 * Hook pour inviter un utilisateur comme membre
 */
export const useInviteMember = createUserMutation({
  action: async (user) => {
    if (user.sendRequestToJoinParent) {
      await user.sendRequestToJoinParent();
    }
  },
  i18n: {
    successKey: "toast.members.inviteSuccess",
    errorKey: "toast.members.inviteError",
  },
});

/**
 * Hook pour inviter un utilisateur comme admin
 */
export const useInviteAdmin = createUserMutation({
  action: async (user) => {
    if (user.sendRequestToJoinParent) {
      await user.sendRequestToJoinParent({ admin: true });
    }
  },
  i18n: {
    successKey: "toast.members.inviteAdminSuccess",
    errorKey: "toast.members.inviteAdminError",
  },
});
