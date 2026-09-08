/**
 * Calculateur de permissions AAC.
 *
 * Sémantique (parité legacy, cf. doc/34 §6) :
 *  - admin = admin de l'entité OU admin du costum (bypass TOTAL, cf. `isCostumAdmin`)
 *  - dépôt PAS ouvert par défaut : active + CONNECTÉ + gate communauté/rôles +
 *    unicité (`oneAnswerPerPers`) — les gardes de `Coform::getFormAccessInfo`
 *  - lecture publique, sauf `onlyMemberAccess` (membres + admins)
 *  - modification : auteur OU admin, OU tout connecté si `anyOnewithLinkCanAnswer`
 *  - financement gardé par le gate MAÎTRE `coremu` (OFF ⇒ jamais, admin compris)
 *  - tolère l'auteur temporaire (answer sans `userId`)
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
    // Un dépôt exige un compte. Il n'existe pas de clé `standalone` : c'était un
    // mode de REQUÊTE legacy (`.standalone.true`, `filters.formStandalone`), pas
    // une option du form — le gate qu'on en dérivait valait toujours `false`. La
    // seule dispense de compte du legacy est `temporarymembercanreply` (compte
    // temporaire par email, `Coform::getFormAccessInfo`), non portée ici.
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
        : !isConnected
          ? "User not connected"
          : "Insufficient membership/role";

  // 2. Lire les communs — publics, sauf appel réservé à sa communauté
  // (`Form.php:1869` : `onlymemberaccess` faux OU membre). Il n'existe pas de
  // clé `annuaire` ; la restriction de LISTING (`onlyAdminCanSeeList`) est
  // appliquée par le backend, cf. doc/34 §13.5.
  const canReadCommuns = isAdmin || isCommunityMember || !gates.onlyMemberAccess;

  // 3. Modifier un commun — auteur OU admin (tolère l'auteur temporaire sans userId).
  // `anyOnewithLinkCanAnswer` (« avoir le lien suffit pour répondre ») ouvre
  // l'édition à tout CONNECTÉ, sans lien au contexte : c'est ce que fait le
  // legacy sur une réponse existante (`IndexAction.php:237`, sous
  // `session['userId']`). Jamais un anonyme — ce n'est pas un dépôt sans compte.
  const canEditCommun = (commun?: AacCommunLike | null): boolean => {
    if (isAdmin) return true;
    if (!commun || !currentUserId) return false;
    if (gates.anyOnewithLinkCanAnswer && isConnected) return true;
    return commun.authorId === currentUserId;
  };

  // 4. Participer aux actions.
  const canParticipateActions = isConnected;

  // 5. Financement — gate MAÎTRE `coremu` (`form.coremu`, préconfiguration
  // « Système de coremuneration »). OFF ⇒ le legacy masque l'onglet
  // Contributions à tout le monde, admin compris (`detailProposal.php:105`) :
  // `canViewFunding` en est la traduction d'AFFICHAGE. Contribuer exige en plus
  // un compte — le legacy ne conditionne pas l'affichage à la connexion.
  const canViewFunding = Boolean(gates.coremu);
  const canContributeFunding = canViewFunding && isConnected;
  const canContributeFundingReason = canContributeFunding
    ? undefined
    : !canViewFunding
      ? "Co-funding disabled (master gate)"
      : "User not connected";

  // 6. Publier / retirer un commun de l'annuaire — administration de l'appel.
  // Affichage seulement : le chemin d'écriture backend n'exige que la connexion.
  const canSelectCommun = isAdmin;

  return {
    canCreateCommun,
    canCreateCommunReason,
    canReadCommuns,
    canEditCommun,
    canParticipateActions,
    canViewFunding,
    canContributeFunding,
    canContributeFundingReason,
    canSelectCommun,
    isConnected,
    isAdmin,
    currentUserId,
  };
}
