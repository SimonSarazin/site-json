/**
 * Calculateur de permissions AAC.
 *
 * Sémantique :
 *  - admin = admin de l'entité OU admin du costum (bypass TOTAL, cf. `isCostumAdmin`)
 *  - dépôt PAS ouvert par défaut : active + (standalone OU connecté) + gate
 *    communauté/rôles + unicité (`oneAnswerPerPers`)
 *  - financement gardé par le gate MAÎTRE `coRemuneration` (OFF ⇒ jamais)
 *  - tolère l'auteur temporaire standalone (answer sans `userId`)
 */
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import type { AacCommunLike, AacPermissionData, AacPermissions } from "../types";
import { DEFAULT_AAC_PERMISSIONS } from "../defaults";

type EntityWithRoles = EntityTypes & { isAdmin?: () => boolean };

function safeIsAdmin(entity: EntityTypes | null | undefined): boolean {
  if (!entity) return false;
  const e = entity as EntityWithRoles;
  try {
    return typeof e.isAdmin === "function" ? Boolean(e.isAdmin()) : false;
  } catch {
    return false;
  }
}

/**
 * @param isCostumAdmin droit-parapluie costum-admin (résolu par `usePermissions`).
 */
export function calculateAacPermissions(
  entity: EntityTypes | null,
  me: User | null,
  data?: AacPermissionData,
  isCostumAdmin = false
): AacPermissions {
  const isConnected = Boolean(me?.isConnected);
  const currentUserId = me?.id?.trim() || "";
  const gates = data?.gates ?? {};

  // Admin = admin de l'entité OU admin du costum (bypass TOTAL).
  const isAdmin = isCostumAdmin || safeIsAdmin(entity);

  if (!entity) {
    return { ...DEFAULT_AAC_PERMISSIONS, isConnected, isAdmin, currentUserId };
  }

  const active = gates.active !== false; // actif par défaut si non renseigné
  const restrictRoles = gates.restrictRoles ?? [];
  const userRoles = data?.userRoles ?? [];
  const hasRequiredRole =
    restrictRoles.length === 0 || restrictRoles.some((r) => userRoles.includes(r));
  const isCommunityMember = data?.isCommunityMember ?? false;

  // 1. Déposer un commun.
  const canCreateCommun = (() => {
    if (isAdmin) return active;
    if (!active) return false;
    if (gates.oneAnswerPerPers && data?.hasOwnCommun) return false;
    if (gates.standalone) return true; // réponse possible (avec/sans compte)
    if (!isConnected) return false;
    if (gates.onlyMemberAccess && !isCommunityMember) return false;
    if (!hasRequiredRole) return false;
    return true;
  })();

  const canCreateCommunReason = canCreateCommun
    ? undefined
    : !active
      ? "AAC inactive"
      : gates.oneAnswerPerPers && data?.hasOwnCommun
        ? "Already answered (one per person)"
        : !isConnected && !gates.standalone
          ? "User not connected"
          : "Insufficient membership/role";

  // 2. Lire les communs.
  const canReadCommuns = isAdmin || Boolean(gates.annuaire) || isCommunityMember;

  // 3. Modifier un commun — auteur OU admin (tolère l'auteur temporaire sans userId).
  const canEditCommun = (commun?: AacCommunLike | null): boolean => {
    if (isAdmin) return true;
    if (!commun || !currentUserId) return false;
    return commun.authorId === currentUserId;
  };

  // 4. Participer aux actions.
  const canParticipateActions = isConnected;

  // 5. Contribuer financièrement — gate MAÎTRE corénumération obligatoire.
  const canContributeFunding = Boolean(gates.coRemuneration) && isConnected;
  const canContributeFundingReason = canContributeFunding
    ? undefined
    : !gates.coRemuneration
      ? "Co-funding disabled (master gate)"
      : "User not connected";

  return {
    canCreateCommun,
    canCreateCommunReason,
    canReadCommuns,
    canEditCommun,
    canParticipateActions,
    canContributeFunding,
    canContributeFundingReason,
    isConnected,
    isAdmin,
    currentUserId,
  };
}
