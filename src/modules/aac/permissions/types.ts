/**
 * Types de permissions du module AAC.
 *
 * 5 dimensions (spec métier) :
 *  1. accès formulaire (déposer un commun)
 *  2. lecture des réponses/communs
 *  3. modification d'une réponse
 *  4. participation aux actions
 *  5. contribution financière
 *
 * + bypass admin-org TOTAL (résolu centralement par `usePermissions` via
 *   `isCostumAdmin`) ; + le financement suit l'ÉTAPE de financement de l'appel
 *   (`hasFundingStep`), pas `coremu` ; + gate dépôt 3 modes (ouvert / membres /
 *   rôles), toujours connecté ; + tolérance compte temporaire (answer sans
 *   `userId`).
 */

/**
 * Les gates tels que le calculateur les consomme — un sous-ensemble de
 * `AacGates` (types.ts), tous optionnels : absents, ils valent « fermé ».
 */
export interface AacGateFlags {
  active?: boolean;
  onlyMemberAccess?: boolean;
  oneAnswerPerPers?: boolean;
  /**
   * Corémunération (`form.coremu`, préconfiguration « Système de coremuneration »).
   *
   * ⚠️ Ne garde PAS le financement : côté legacy il ne masque que l'onglet
   * `#proposition-contribution` (`detailProposal.php:105`), pas
   * `#proposition-funding` (l.100-104) dont les blocs de la fiche sont la
   * traduction. Résolu et exposé, mais aucun bloc de site-json n'en dépend tant
   * que la corémunération n'est pas portée.
   */
  coremu?: boolean;
  /**
   * « Avoir le lien suffit pour répondre » : un CONNECTÉ peut modifier une
   * réponse sans lien au contexte. Ne dispense jamais de la connexion.
   */
  anyOnewithLinkCanAnswer?: boolean;
  /** Restreindre le dépôt à certains rôles (liste). */
  restrictRoles?: string[];
}

export interface AacPermissionData {
  /** Flags de config (gates) résolus par `useAacConfig`. */
  gates?: AacGateFlags;
  /** L'utilisateur a-t-il déjà un commun sur cet AAC (pour oneAnswerPerPers) ? */
  hasOwnCommun?: boolean;
  /** L'utilisateur est-il membre de la communauté de l'élément hôte ? */
  isCommunityMember?: boolean;
  /** Rôles de l'utilisateur sur l'élément hôte. */
  userRoles?: string[];
  /**
   * L'appel porte-t-il une étape de financement ? (`roles.financementStepKey`,
   * l'étape de l'input `financer` — `aapStep3` dans le gabarit legacy.)
   * Gate d'affichage des blocs financement, parité `#proposition-funding`.
   */
  hasFundingStep?: boolean;
}

export interface AacCommunLike {
  /** Id de l'auteur (peut être absent en standalone : compte temporaire email). */
  authorId?: string;
}

export interface AacPermissions {
  /** 1. Déposer un commun (active + connecté + gate 3 modes + unicité). */
  canCreateCommun: boolean;
  canCreateCommunReason?: string;
  /** 2. Lire les communs (public, sauf `onlyMemberAccess` : membres et admins). */
  canReadCommuns: boolean;
  /** 3. Modifier un commun (auteur OU admin, OU tout connecté si `anyOnewithLinkCanAnswer`). */
  canEditCommun: (commun?: AacCommunLike | null) => boolean;
  /** 4. Participer aux actions (connecté ; détail par action ailleurs). */
  canParticipateActions: boolean;
  /**
   * 5a. Voir le financement d'un commun — l'appel a une étape de financement
   * (`hasFundingStep`), sans condition de compte ni d'admin : c'est ce que fait
   * le legacy avec l'onglet `#proposition-funding` (`detailProposal.php:100-104`).
   * Gate d'AFFICHAGE des blocs financement de la fiche.
   */
  canViewFunding: boolean;
  /** 5b. Contribuer financièrement (`canViewFunding` + connexion). */
  canContributeFunding: boolean;
  canContributeFundingReason?: string;
  /**
   * 6. Publier / retirer un commun de l'annuaire de CET appel.
   *
   * Booléen et non fonction : le droit ne dépend pas du commun visé — la
   * sélection s'écrit sous le contexte de l'appel, pas sous la réponse.
   *
   * ⚠️ Gate d'AFFICHAGE. Le backend n'exige que d'être connecté sur ce chemin
   * d'écriture (`UpdatePathValuedAction`) : ne jamais le présenter comme une
   * sécurité. Durcissement au BACKLOG.
   */
  canSelectCommun: boolean;

  isConnected: boolean;
  isAdmin: boolean;
  currentUserId: string;
}
