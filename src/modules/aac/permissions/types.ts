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
 *   `isCostumAdmin`) ; + gate MAÎTRE corénumération (OFF ⇒ pas de financement) ;
 *   + gate dépôt 3 modes (ouvert / membres / rôles) ; + tolérance compte
 *   temporaire standalone (answer sans `userId`).
 */

export interface AacGateFlags {
  active?: boolean;
  onlyMemberAccess?: boolean;
  oneAnswerPerPers?: boolean;
  standalone?: boolean;
  /** Gate MAÎTRE : OFF ⇒ pas de financeur / objet finançable / paiement. */
  coRemuneration?: boolean;
  /** Répertoire/annuaire : gate visibilité du listing. */
  annuaire?: boolean;
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
}

export interface AacCommunLike {
  /** Id de l'auteur (peut être absent en standalone : compte temporaire email). */
  authorId?: string;
}

export interface AacPermissions {
  /** 1. Déposer un commun (active + gate 3 modes / standalone + unicité). */
  canCreateCommun: boolean;
  canCreateCommunReason?: string;
  /** 2. Lire les communs (annuaire public OU membre communauté OU admin). */
  canReadCommuns: boolean;
  /** 3. Modifier un commun (auteur OU admin). */
  canEditCommun: (commun?: AacCommunLike | null) => boolean;
  /** 4. Participer aux actions (connecté ; détail par action ailleurs). */
  canParticipateActions: boolean;
  /** 5. Contribuer financièrement (gate MAÎTRE corénumération + connexion). */
  canContributeFunding: boolean;
  canContributeFundingReason?: string;

  isConnected: boolean;
  isAdmin: boolean;
  currentUserId: string;
}
