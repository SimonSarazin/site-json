import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useEntityActions } from "../actions";
import { SeparateButtonsLayout } from "./action-buttons/SeparateButtonsLayout";
import { StatusDropdownLayout } from "./action-buttons/StatusDropdownLayout";

interface EntityActionButtonsProps {
  entity: EntityTypes | null;
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
 * @param entity - L'entité concernée (User, Organization, Project, Event)
 */
export function EntityActionButtons({ entity }: EntityActionButtonsProps) {
  const actionsConfig = useEntityActions(entity);

  if (!actionsConfig) return null;

  const { actions, layout, statusLabel, statusIcon, statusVariant } = actionsConfig;

  if (layout === "separate-buttons") {
    return <SeparateButtonsLayout actions={actions} />;
  }

  if (layout === "status-dropdown" && statusLabel && statusIcon && statusVariant) {
    return (
      <StatusDropdownLayout
        actions={actions}
        statusLabel={statusLabel}
        statusIcon={statusIcon}
        statusVariant={statusVariant}
      />
    );
  }

  return null;
}
