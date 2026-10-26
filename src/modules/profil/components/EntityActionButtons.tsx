import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useEntityActions } from "../actions";
import { useProfilePageIntent } from "../hooks/useUrlIntent";
import type { EntityActionsOptions } from "../types";
import { SeparateButtonsLayout } from "./action-buttons/SeparateButtonsLayout";
import { StatusDropdownLayout } from "./action-buttons/StatusDropdownLayout";

interface EntityActionButtonsProps {
  entity: EntityTypes | null;
  /** Actions ouvertes par la section hôte (suppression de la fiche) — cf. `EntityActionsOptions`. */
  options?: EntityActionsOptions;
}

/**
 * Composant générique pour afficher les boutons d'action sur n'importe quelle entité
 *
 * Gère automatiquement:
 * - Users (citoyens): Layout horizontal avec boutons séparés (Follow, Friend Request)
 * - Organizations: Menu déroulant avec statut (Admin/Membre/Suivi)
 * - Projects: À implémenter
 * - Events: À implémenter
 *
 * Le layout et les actions sont déterminés automatiquement selon le type d'entité
 *
 * `?participer` dans l'URL de la fiche d'un ÉVÉNEMENT ouvre directement la confirmation de
 * participation (lien posé par un site tiers, cf. doc/08). Visée par son identité `participate`,
 * pas par son type `join`, que portent aussi « devenir membre » d'une organisation ou « devenir
 * administrateur » ; et seulement pour l'entité de la page (`useProfilePageIntent`), pas pour un
 * aperçu. Sans droit (déconnecté, déjà participant), l'action n'existe pas et rien ne s'ouvre.
 *
 * @param entity - L'entité concernée (User, Organization, Project, Event)
 */
export function EntityActionButtons({ entity, options }: EntityActionButtonsProps) {
  const actionsConfig = useEntityActions(entity, options);
  const participer = useProfilePageIntent("participer", entity);

  if (!actionsConfig) return null;

  const { actions, layout, statusLabel, statusIcon, statusVariant } = actionsConfig;

  if (layout === "separate-buttons") {
    return <SeparateButtonsLayout actions={actions} />;
  }

  if (layout === "status-dropdown" && statusLabel && statusIcon && statusVariant) {
    const urlAction = participer.present
      ? actions.find((action) => action.id === "participate" && action.show) ?? null
      : null;
    return (
      <StatusDropdownLayout
        actions={actions}
        statusLabel={statusLabel}
        statusIcon={statusIcon}
        statusVariant={statusVariant}
        urlAction={urlAction}
        onUrlActionDone={participer.clear}
      />
    );
  }

  return null;
}
