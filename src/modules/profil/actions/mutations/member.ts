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
import { useQueryClient } from "@tanstack/react-query";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { createUserMutation, invalidateMemberQueries } from "./core";

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

/**
 * Hook pour définir les rôles d'un membre déjà lié (`User.setRoles`, remplacement intégral —
 * cf. le JSDoc de la méthode SDK). Variables `{ user, roles }` : `createUserMutation` ne porte que
 * `User`, insuffisant ici — mutation écrite directement sur `useMutationWithToast`, même structure
 * (invalidation des queries membres, toast paramétré par le nom).
 */
export function useSetMemberRoles(parentEntity: EntityTypes | null) {
  const queryClient = useQueryClient();

  return useMutationWithToast<void, { user: User; roles: string[] }>({
    // Sans garde : le SDK est épinglé `^1.0.196` (`package.json`), qui expose `setRoles` — une
    // garde `if (user.setRoles)` aurait fait réussir la mutation EN SILENCE sur un SDK antérieur
    // (toast « rôles mis à jour » sans rien avoir écrit), au lieu de laisser l'erreur remonter.
    mutationFn: async ({ user, roles }) => {
      await user.setRoles(roles);
    },
    namespace: "modules/profil",
    successKey: "toast.members.setRolesSuccess",
    errorKey: "toast.members.setRolesError",
    getSuccessParams: (_, { user }) => ({ name: user.serverData?.name || "" }),
    getErrorParams: (_, { user }) => ({ name: user.serverData?.name || "" }),
    onSuccessCallback: () => {
      if (parentEntity) {
        invalidateMemberQueries(queryClient, parentEntity);
      }
    },
    invalidateQueries: [],
  });
}

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

type InviteWithRolesVariables = { user: User; roles: string[]; admin?: boolean };

/** Mutation partagée par `useInviteMemberWithRoles`/`useInviteAdminWithRoles` — seul le message de
 *  toast (`successKey`/`errorKey`, cf. ces deux hooks) distingue les deux. */
function inviteWithRolesConfig(
  parentEntity: EntityTypes | null,
  queryClient: ReturnType<typeof useQueryClient>,
  keys: { successKey: string; errorKey: string },
) {
  return {
    // Sans garde, même raison que `useSetMemberRoles` : le SDK épinglé `^1.0.196` expose déjà
    // `sendRequestToJoinParent`.
    mutationFn: async ({ user, roles, admin }: InviteWithRolesVariables) => {
      await user.sendRequestToJoinParent({ admin, ...(roles.length > 0 ? { roles } : {}) });
    },
    namespace: "modules/profil",
    ...keys,
    getSuccessParams: (_: void, { user }: InviteWithRolesVariables) => ({ name: user.serverData?.name || "" }),
    getErrorParams: (_: Error, { user }: InviteWithRolesVariables) => ({ name: user.serverData?.name || "" }),
    onSuccessCallback: () => {
      if (parentEntity) {
        invalidateMemberQueries(queryClient, parentEntity);
      }
    },
    invalidateQueries: [],
  };
}

/**
 * Hook pour inviter un utilisateur (recherché, pas par e-mail) AVEC des rôles, comme MEMBRE —
 * onglet « users » d'`InviteMemberDialog`. Variables `{ user, roles, admin }`, pas juste `User` :
 * `useInviteMember`/`useInviteAdmin` ci-dessous (sans rôles) restent utilisés ailleurs (ex.
 * `MemberListRenderer`, qui n'a pas de saisie de rôles), donc conservés tels quels plutôt que
 * remplacés. `successKey` reste STATIQUE (pas une fonction, cf. `useMutationWithToast`) — scindé en
 * deux hooks avec `useInviteAdminWithRoles` plutôt qu'un message unique, pour ne pas régresser le
 * toast « invitation d'administrateur » (constat de revue : un seul hook au message figé sur
 * « invitation envoyée » perdait la distinction admin/membre).
 */
export function useInviteMemberWithRoles(parentEntity: EntityTypes | null) {
  const queryClient = useQueryClient();
  return useMutationWithToast<void, InviteWithRolesVariables>(
    inviteWithRolesConfig(parentEntity, queryClient, {
      successKey: "toast.members.inviteSuccess",
      errorKey: "toast.members.inviteError",
    }),
  );
}

/** Même mutation que `useInviteMemberWithRoles`, message « invitation d'administrateur » — à
 *  appeler quand `admin` vaut `true` (cf. `InviteMemberDialog`, `runAction`). */
export function useInviteAdminWithRoles(parentEntity: EntityTypes | null) {
  const queryClient = useQueryClient();
  return useMutationWithToast<void, InviteWithRolesVariables>(
    inviteWithRolesConfig(parentEntity, queryClient, {
      successKey: "toast.members.inviteAdminSuccess",
      errorKey: "toast.members.inviteAdminError",
    }),
  );
}

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
