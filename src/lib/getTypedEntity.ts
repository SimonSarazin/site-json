import type { SearchEntity } from "@communecter/cocolight-api-client";
import type { User, Organization, Project, Event, Poi, EntityTypes } from "@communecter/cocolight-api-client";

/**
 * Type guards pour permettre à TypeScript de faire le narrowing automatique
 *
 * Ces fonctions permettent à TypeScript de déterminer automatiquement le type
 * spécifique d'une SearchEntity dans un contexte conditionnel.
 *
 * @example
 * if (isUser(entity)) {
 *   // TypeScript sait automatiquement que entity est User
 *   console.log(entity.isFriend());
 * }
 */

/**
 * Type guard pour vérifier si une entité est un User
 */
export function isUser(entity: EntityTypes): entity is User {
  return entity.getEntityType() === "citoyens";
}

/**
 * Type guard pour vérifier si une entité est une Organization
 */
export function isOrganization(entity: EntityTypes): entity is Organization {
  return entity.getEntityType() === "organizations";
}

/**
 * Type guard pour vérifier si une entité est un Project
 */
export function isProject(entity: EntityTypes): entity is Project {
  return entity.getEntityType() === "projects";
}

/**
 * Type guard pour vérifier si une entité est un Event
 */
export function isEvent(entity: EntityTypes): entity is Event {
  return entity.getEntityType() === "events";
}

/**
 * Type guard pour vérifier si une entité est un Poi
 */
export function isPoi(entity: SearchEntity): entity is Poi {
  return entity.getEntityType() === "poi";
}