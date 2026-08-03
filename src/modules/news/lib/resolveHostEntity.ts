import type { EntityTypes } from "@communecter/cocolight-api-client";

/**
 * Extrait `{ type, id }` d'un `target`/`object` de news, robuste aux DEUX formes :
 * la lib normalise ces champs imbriqués en INSTANCES d'entité (News._linkNestedEntity →
 * type/id sur `.serverData`) quand `{id,type}` sont présents, sinon laisse l'objet brut.
 */
export function targetRef(ref: unknown): { type?: string; id?: string } {
  if (!ref || typeof ref !== "object") return {};
  const r = ref as Record<string, unknown>;
  const sd = (r.serverData && typeof r.serverData === "object" ? r.serverData : r) as Record<string, unknown>;
  const id = typeof sd.id === "string" ? sd.id : typeof sd._id === "string" ? sd._id : undefined;
  return { type: typeof sd.type === "string" ? sd.type : undefined, id };
}

/**
 * API minimale nécessaire pour résoudre une entité par (type, id).
 * `api.<type>({ id })` déclenche un `get()` et renvoie l'entité (avec son slug).
 */
interface EntityByIdApi {
  organization: (a: { id: string }) => Promise<EntityTypes>;
  project: (a: { id: string }) => Promise<EntityTypes>;
  event: (a: { id: string }) => Promise<EntityTypes>;
  poi: (a: { id: string }) => Promise<EntityTypes>;
  user: (a: { id: string }) => Promise<EntityTypes>;
}

/**
 * Résout l'entité PORTEUSE d'une news (son `target`) à partir de `type` + `id`.
 *
 * Le routing du site est par **slug** alors qu'une news enrichie ne porte que
 * `target.{type,id}` (le legacy ne projette pas `target.slug` — parité). On
 * récupère donc l'entité via les méthodes typées `api.<type>({ id })`, qui
 * renvoient l'entité (et son slug). Même mécanisme que `useNotificationNavigation`.
 *
 * @returns l'entité, ou `null` si le type n'est pas résoluble (ex. cms) ou id absent.
 */
export async function resolveHostEntity(
  api: EntityByIdApi | null | undefined,
  type: string | null | undefined,
  id: string | null | undefined,
): Promise<EntityTypes | null> {
  if (!api || !type || !id) return null;
  switch (type) {
    case "organizations":
      return api.organization({ id });
    case "projects":
      return api.project({ id });
    case "events":
      return api.event({ id });
    case "poi":
      return api.poi({ id });
    case "citoyens":
      return api.user({ id });
    default:
      return null;
  }
}
