import type { SearchEntity } from "@/modules/search/schema";
import type { User, Organization, Project, Event as EventType, Poi } from "@communecter/cocolight-api-client";

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

export function isUser(entity: SearchEntity): entity is User {
  return entity.getEntityType() === "citoyens";
}

export function isOrganization(entity: SearchEntity): entity is Organization {
  return entity.getEntityType() === "organizations";
}

export function isProject(entity: SearchEntity): entity is Project {
  return entity.getEntityType() === "projects";
}

export function isEvent(entity: SearchEntity): entity is EventType {
  return entity.getEntityType() === "events";
}

export function isPoi(entity: SearchEntity): entity is Poi {
  return entity.getEntityType() === "poi";
}
