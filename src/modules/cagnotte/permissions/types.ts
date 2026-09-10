/**
 * Types de permissions pour le module cagnotte
 *
 * Le module cagnotte travaille sur des projets de financement participatif via
 * milestones (`projects.oceco.milestones[]`) et actions (`answers.aapStep1.depense[]`).
 *
 * Les permissions ici dérivent de :
 *  - `me` connecté ou non
 *  - rôle de `me` sur le `Project` (admin ou contributeur via `entity.isAdmin?.()` / `entity.isContributor?.()`)
 *  - état d'un milestone (`open`, `done`, `close`)
 *  - état d'une action (`todo`, `done`), son auteur, et présence d'un userId dans `action.contributors[]`
 *  - présence/absence de financement sur un milestone (pour la suppression)
 */

export type CagnotteMilestoneStatus = "open" | "done" | "close";
export type CagnotteActionStatus = "todo" | "done";

export interface CagnotteMilestoneLike {
  /** Statut du milestone */
  status?: CagnotteMilestoneStatus;
  /** Au moins une transaction enregistrée (sert au canDeleteMilestone) */
  hasTransactions?: boolean;
}

export interface CagnotteActionLike {
  /** Statut de l'action */
  status?: CagnotteActionStatus;
  /** Liste des IDs de contributeurs assignés à l'action */
  contributorIds?: string[];
  authorId?: string;
}

/**
 * Ce qu'une carte sait dire d'une action au calculateur de permissions — même contrat
 * que `CagnotteActionLike`, mais `status` et `contributorIds` y sont requis : une carte
 * qui rend une action les connaît toujours.
 *
 * `authorId` reste optionnel : les cartes qui ne le renseignent pas gardent le
 * comportement d'avant (admin ou contributeur assigné), sans erreur de type.
 */
export interface ActionPermissionInput {
  status: CagnotteActionStatus;
  contributorIds: string[];
  authorId?: string;
}

/**
 * Sous-ensemble de `CagnottePermissions` consommé par les cartes de palier — les deux
 * écrans qui rendent paliers et actions (`MilestoneCard` côté cagnotte,
 * `ActionsMilestoneCard` côté AAC) partagent ce contrat.
 *
 * Déclaré ici, dans le module qui possède le calculateur, et non dans chaque écran :
 * les deux copies locales qui existaient avaient divergé, celle des cartes cagnotte
 * ayant perdu `authorId` — donc la règle « l'auteur peut corriger son action ».
 */
export interface MilestoneCardPermissions {
  canCreateAction: (input: { status: CagnotteMilestoneStatus }) => boolean;
  canEditMilestone: (input: { status: CagnotteMilestoneStatus }) => boolean;
  canCloseMilestone: (input: { status: CagnotteMilestoneStatus }) => boolean;
  canDeleteMilestone: (input: { status: CagnotteMilestoneStatus; hasTransactions: boolean }) => boolean;
  canCandidateAction: (input: ActionPermissionInput) => boolean;
  canMarkActionDone: (input: ActionPermissionInput) => boolean;
  canEditAction: (input: ActionPermissionInput) => boolean;
  canDeleteAction: (input: ActionPermissionInput) => boolean;
}

export interface CagnottePermissions {
  // Contribution
  /** L'utilisateur peut ouvrir la modale de contribution (connecté + projet existant + milestones actifs) */
  canContribute: boolean;
  canContributeReason?: string;

  // Milestones
  /** Créer un milestone (admin projet) */
  canCreateMilestone: boolean;
  /** Éditer un milestone donné (admin projet + milestone non clôturé) */
  canEditMilestone: (milestone: CagnotteMilestoneLike | null | undefined) => boolean;
  /** Clôturer un milestone (admin + statut open) */
  canCloseMilestone: (milestone: CagnotteMilestoneLike | null | undefined) => boolean;
  /** Restaurer un milestone clôturé (admin + statut close) */
  canRestoreMilestone: (milestone: CagnotteMilestoneLike | null | undefined) => boolean;
  /** Supprimer un milestone (admin + pas de financement encaissé) */
  canDeleteMilestone: (milestone: CagnotteMilestoneLike | null | undefined) => boolean;

  // Actions
  /** Créer une action dans un milestone (admin + milestone non clôturé) */
  canCreateAction: (milestone: CagnotteMilestoneLike | null | undefined) => boolean;
  /** Éditer une action (admin OU auteur OU contributeur de l'action) — `done` : admin seul */
  canEditAction: (action: CagnotteActionLike | null | undefined) => boolean;
  /** Marquer une action terminée (admin OU auteur OU contributeur de l'action) + action en `todo` */
  canMarkActionDone: (action: CagnotteActionLike | null | undefined) => boolean;
  /** Supprimer une action (admin OU auteur de l'action) — `done` : admin seul */
  canDeleteAction: (action: CagnotteActionLike | null | undefined) => boolean;
  /** Se porter candidat sur une action (connecté + action `todo` + pas déjà contributeur) */
  canCandidateAction: (action: CagnotteActionLike | null | undefined) => boolean;

  // Méta-info utile aux call-sites
  isConnected: boolean;
  isAdmin: boolean;
  isContributor: boolean;
  currentUserId: string;
}

/**
 * Données additionnelles passées via `usePermissions(['cagnotte'], entity, data)`
 */
export interface CagnottePermissionData {
  /** Existe-t-il au moins un milestone non-clôturé sur le projet sélectionné ? */
  hasActiveItems?: boolean;
  /** ID du projet sélectionné (sert au canContribute) */
  resourceId?: string;
  /**
   * Utilisateurs qui font AUTORITÉ sur cette ressource-ci, en plus des admins de
   * l'entité passée au calculateur — ils obtiennent `isAdmin`, donc les mêmes
   * droits sur paliers et actions.
   *
   * Le calculateur ne sait pas ce qu'est une « ressource » côté métier : c'est à
   * l'appelant de dire qui la porte. Le module AAC y met le DÉPOSANT du commun et
   * l'admin de l'appel qui l'a publié — deux personnes qui ne sont ni l'une ni
   * l'autre nécessairement admin de l'entité du site ou du projet lié.
   *
   * Vide par défaut : les call-sites qui ne le renseignent pas sont inchangés.
   */
  ownerIds?: string[];
}
