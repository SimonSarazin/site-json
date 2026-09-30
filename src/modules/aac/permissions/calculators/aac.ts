/**
 * Calculateur de permissions AAC.
 *
 * Sémantique (parité legacy, cf. doc/34 §6) :
 *  - admin = admin de l'entité OU admin du costum (bypass TOTAL, cf. `isCostumAdmin`)
 *  - dépôt PAS ouvert par défaut : active + CONNECTÉ + gate communauté/rôles +
 *    unicité (`oneAnswerPerPers`) — les gardes de `Coform::getFormAccessInfo`
 *  - lecture publique, sauf `onlyMemberAccess` (membres + admins)
 *  - modification : auteur OU admin OU contributeur à l'édition (`links.canEdit`), OU tout
 *    connecté si `anyOnewithLinkCanAnswer` ; le bouton qui gère la liste des contributeurs est
 *    réservé à l'auteur et à l'admin (la question « Référent » reliée à la liste, elle, reste
 *    modifiable par tout éditeur — parité legacy, doc/34 §3.4)
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
  //
  // Les contributeurs à l'édition (`links.canEdit`, ajoutés depuis la fiche ou par la question
  // « Référent du commun ») passent aussi — c'est ce que `Coform::canAdminAnswer` accepte à
  // l'enregistrement. Connectés seulement, comme tout le reste de ce droit.
  const canEditCommun = (commun?: AacCommunLike | null): boolean => {
    if (isAdmin) return true;
    if (!commun || !currentUserId) return false;
    if (gates.anyOnewithLinkCanAnswer && isConnected) return true;
    if (isConnected && commun.editorIds?.includes(currentUserId)) return true;
    return commun.authorId === currentUserId;
  };

  // 3 bis. Le bouton « Contributeurs à l'édition » — auteur OU admin, et eux seuls : ni
  // `anyOnewithLinkCanAnswer` ni la liste elle-même n'y ouvrent (arbitrage du 29/09). Garde
  // d'AFFICHAGE, pas frontière de droit : quand une question finder alimente `links.canEdit`
  // (`addToLinks`), tout éditeur change la liste par elle — parité legacy, assumée le 30/09.
  // Même garde que la suppression, mais un droit à part : les deux n'ont pas à évoluer ensemble.
  const canManageEditors = (commun?: AacCommunLike | null): boolean => {
    if (isAdmin) return true;
    if (!commun || !currentUserId) return false;
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

  // 7. Supprimer un commun — auteur OU admin, parité des deux gates legacy qui convergent :
  // l'annuaire (`federationDesCae_index.js:479-484`) et la fiche (`campDetail.php:2590`).
  //
  // Surtout pas `canEditCommun`, qui ouvre l'édition à tout connecté sous
  // `anyOnewithLinkCanAnswer` : il montrerait « Supprimer » à n'importe quel visiteur, pour un
  // droit qu'aucune branche d'`Answer::canEdit` n'accorde.
  const canDeleteCommun = (commun?: AacCommunLike | null): boolean => {
    if (isAdmin) return true;
    if (!commun || !currentUserId) return false;
    return commun.authorId === currentUserId;
  };

  return {
    canCreateCommun,
    canCreateCommunReason,
    canReadCommuns,
    canEditCommun,
    canManageEditors,
    canParticipateActions,
    canViewFunding,
    canContributeFunding,
    canContributeFundingReason,
    canSelectCommun,
    canDeleteCommun,
    isConnected,
    isAdmin,
    currentUserId,
  };
}
