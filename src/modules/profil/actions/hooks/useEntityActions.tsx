/**
 * Hook principal (routeur) pour les actions sur les entités
 * Délègue au hook approprié selon le type d'entité
 */
import type { EntityTypes, User, Organization, Project, Event } from "@communecter/cocolight-api-client";
import { isUser, isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";
import { useUserEntityActions } from "./useUserEntityActions";
import { useOrgEntityActions } from "./useOrgEntityActions";
import { useProjectEntityActions } from "./useProjectEntityActions";
import { useEventEntityActions } from "./useEventEntityActions";
import type { EntityActionsResult } from "../../types";

export type { EntityAction, EntityActionsResult } from "../../types";

type EntityType = "user" | "organization" | "project" | "event";

/**
 * Détermine le type d'une entité
 */
function getEntityType(entity: EntityTypes): EntityType | null {
  if (isUser(entity)) return "user";
  if (isOrganization(entity)) return "organization";
  if (isProject(entity)) return "project";
  if (isEvent(entity)) return "event";
  return null;
}

/**
 * Hook centralisé pour obtenir les actions disponibles sur une entité
 * Retourne les actions appropriées selon le type d'entité et les permissions
 *
 * @param entity - L'entité concernée (User, Organization, Project, Event)
 * @returns Configuration des actions et du layout
 *
 * @example
 * const result = useEntityActions(entity);
 * if (result) {
 *   // result.actions contient les actions disponibles
 *   // result.layout indique le type de rendu ("separate-buttons" ou "status-dropdown")
 * }
 */
export function useEntityActions(entity: EntityTypes | null): EntityActionsResult | null {
  // Déterminer le type d'entité une seule fois
  const entityType = entity ? getEntityType(entity) : null;

  // Appeler les hooks avec null si le type ne correspond pas
  // Cela évite d'appeler les mutations inutiles
  const userActions = useUserEntityActions(entityType === "user" ? (entity as User) : null);
  const orgActions = useOrgEntityActions(entityType === "organization" ? (entity as Organization) : null);
  const projectActions = useProjectEntityActions(entityType === "project" ? (entity as Project) : null);
  const eventActions = useEventEntityActions(entityType === "event" ? (entity as Event) : null);

  // Retourner le résultat approprié
  switch (entityType) {
    case "user":
      return userActions;
    case "organization":
      return orgActions;
    case "project":
      return projectActions;
    case "event":
      return eventActions;
    default:
      return null;
  }
}
