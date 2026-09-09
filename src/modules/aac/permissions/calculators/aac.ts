/**
 * Calculateur de permissions AAC.
 *
 * Sémantique (parité legacy, cf. doc/34 §6) :
 *  - admin = admin de l'entité OU admin du costum (bypass TOTAL, cf. `isCostumAdmin`)
 *  - dépôt PAS ouvert par défaut : active + CONNECTÉ + gate communauté/rôles +
 *    unicité (`oneAnswerPerPers`) — les gardes de `Coform::getFormAccessInfo`
 *  - lecture publique, sauf `onlyMemberAccess` (membres + admins)
 *  - modification : auteur OU admin, OU tout connecté si `anyOnewithLinkCanAnswer`
 *  - financement affiché si l'appel a une étape de financement (`aapStep3`),
 *    jamais gardé par `coremu` — qui ne garde que la corémunération (§6)
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

  // 5. Financement — l'appel a-t-il une ÉTAPE de financement ?
  //
  // `detailProposal.php` porte DEUX onglets, et un seul est gaté par `coremu` :
  //  - `#proposition-funding` (l.100-104) — les paliers et leurs financeurs —
  //    n'est masqué que si l'étape `aapStep3` est désactivée ou cachée ;
  //  - `#proposition-contribution` (l.105-108) — la corémunération — est le seul
  //    que `form.coremu` garde, et site-json ne le porte pas.
  //
  // Le gate d'affichage suit donc le PREMIER : `hasFundingStep`, résolu par
  // `roles.financementStepKey` (l'étape qui porte l'input `financer`). Brancher
  // les blocs financement sur `coremu` éteignait la fiche de tout appel qui ne
  // fait pas de corémunération — dont celui de la Fédération des CAE, où 500 €
  // déjà collectés devenaient invisibles.
  //
  // Contribuer exige en plus un compte — le legacy ne conditionne pas
  // l'affichage à la connexion.
  const canViewFunding = Boolean(data?.hasFundingStep);
  const canContributeFunding = canViewFunding && isConnected;
  const canContributeFundingReason = canContributeFunding
    ? undefined
    : !canViewFunding
      ? "No funding step on this call"
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
