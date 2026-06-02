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
 *  - état d'une action (`todo`, `done`) et présence d'un userId dans `action.contributors[]`
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
  /** Éditer une action (admin OU contributeur de l'action) */
  canEditAction: (action: CagnotteActionLike | null | undefined) => boolean;
  /** Marquer une action terminée (admin OU contributeur de l'action) + action en `todo` */
  canMarkActionDone: (action: CagnotteActionLike | null | undefined) => boolean;
  /** Supprimer une action (admin uniquement) */
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
  hasActiveMilestones?: boolean;
  /** ID du projet sélectionné (sert au canContribute) */
  projectId?: string;
}
