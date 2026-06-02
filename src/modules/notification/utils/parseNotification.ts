import type { Notification } from "@communecter/cocolight-api-client";

/** Collections d'entités vers lesquelles on sait router (profil par slug). */
export type EntityCollection = "citoyens" | "projects" | "organizations" | "poi" | "events";

const ENTITY_TYPES: readonly string[] = [
  "citoyens",
  "projects",
  "organizations",
  "poi",
  "events",
];
/** Parents possibles d'une news (pas d'events). */
const NEWS_PARENT_TYPES: readonly string[] = [
  "citoyens",
  "projects",
  "organizations",
  "poi",
];

/**
 * Cible résolue d'une notification — l'élément vers lequel rediriger.
 * `null` = notification non navigable.
 */
export type NotificationTarget =
  | { kind: "entity"; type: EntityCollection; id: string }
  | { kind: "news"; id: string; parentType: EntityCollection; parentId: string }
  | { kind: "invite"; type: EntityCollection; id: string };

/**
 * Extrait, à partir des données d'une notification, l'élément concerné — mêmes
 * règles que le `parseNotification` du projet de référence, adaptées à notre
 * routing par slug (la résolution id→slug est faite ailleurs, via l'API typée) :
 *
 * - invitation ami (`target citoyens` + `verb invite`) → l'**auteur**
 * - cible directe (citoyens/projects/organizations/poi/events) → l'élément
 * - `target news` avec un parent supporté → la news + son parent
 * - sinon → `null` (ligne non cliquable)
 */
export function parseNotification(item: Notification): NotificationTarget | null {
  const data = item.data;
  const target = data?.target;
  const author = data?.author;

  // Invitation amis → on vise l'auteur de l'invitation
  if (
    target?.type === "citoyens" &&
    data?.verb === "invite" &&
    author?.id &&
    author?.type &&
    ENTITY_TYPES.includes(author.type)
  ) {
    return { kind: "invite", type: author.type as EntityCollection, id: author.id };
  }

  if (!target?.type || !target?.id) return null;

  if (ENTITY_TYPES.includes(target.type)) {
    return { kind: "entity", type: target.type as EntityCollection, id: target.id };
  }

  if (
    target.type === "news" &&
    target.parent?.type &&
    target.parent?.id &&
    NEWS_PARENT_TYPES.includes(target.parent.type)
  ) {
    return {
      kind: "news",
      id: target.id,
      parentType: target.parent.type as EntityCollection,
      parentId: target.parent.id,
    };
  }

  return null;
}
