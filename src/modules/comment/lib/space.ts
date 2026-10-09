import {
  SPACE_AUDIENCES,
  SPACE_THREAD_KINDS,
  SPACE_TYPES,
  type CommentTarget,
  type DiscussionSpace,
  type DiscussionThread,
  type SpaceAudience,
  type SpaceRef,
  type SpaceThreadKind,
  type SpaceType,
} from "../types";
import { readThread, refusalError, refusalOf, toText } from "./discussions";

/**
 * L'ESPACE de discussion d'un commun, côté lecture.
 *
 * Même règle que pour le panneau : tout passe par ici, rien d'autre ne touche à la forme brute du
 * backend. Le serveur refuse en HTTP 200 avec `{result: false, code}` : c'est `result` qu'on lit,
 * pas le code HTTP — et comme la façade du SDK lève sur ce corps au lieu de le rendre, l'appelant
 * le reprend d'abord dans l'exception (`rawOrRefusal`) avant de le passer à `parseSpace`.
 *
 * **La liste du serveur fait autorité** : un fil qu'elle porte est un fil que CE lecteur peut lire
 * (une discussion réservée n'en sort que pour son audience). Rien ici ne décide d'un droit —
 * `belongsToSpace` ne sert qu'à savoir quelle fiche une adresse concerne.
 *
 * Fonctions pures : testables sans réseau, sans SDK et sans DOM.
 */

export function isSpaceType(value: unknown): value is SpaceType {
  return typeof value === "string" && (SPACE_TYPES as readonly string[]).includes(value);
}

/** Clé stable d'un espace : `answers:65a1…`. */
export function spaceKey(space: SpaceRef): string {
  return `${space.type}:${space.id}`;
}

/** Le fil général d'un espace : celui de l'élément lui-même, sans chemin. */
export function generalTarget(space: SpaceRef): CommentTarget {
  return { type: space.type, id: space.id, path: null };
}

/**
 * Cette cible désigne-t-elle un fil de cet espace ?
 *
 * Deux formes : un fil posé sur le commun lui-même, ou un fil posé sur l'APPEL dont le chemin
 * porte le commun en troisième segment (`<appel>.<étape>.<commun>.…`) — c'est ce segment, et lui
 * seul, qui range un fil de formulaire dans un espace.
 */
export function belongsToSpace(target: CommentTarget | null | undefined, space: SpaceRef): boolean {
  if (!target) return false;
  if (target.type === space.type) return target.id === space.id;
  if (target.type !== "forms" || !target.path) return false;
  const segments = target.path.split(".");
  return segments.length >= 5 && segments[0] === target.id && segments[2] === space.id;
}

function readSpaceThread(value: unknown): DiscussionThread | null {
  const thread = readThread(value);
  if (!thread) return null;
  const row = value as Record<string, unknown>;
  // Une nature inconnue (serveur plus récent) reste un fil : rangé « autre », jamais perdu.
  const kind: SpaceThreadKind = (SPACE_THREAD_KINDS as readonly unknown[]).includes(row.kind)
    ? (row.kind as SpaceThreadKind)
    : "other";
  const audience: SpaceAudience | null = (SPACE_AUDIENCES as readonly unknown[]).includes(row.audience)
    ? (row.audience as SpaceAudience)
    : null;
  return { ...thread, kind, group: toText(row.group), audience };
}

/** Normalise la réponse de l'endpoint `space`. Lève un refus MARQUÉ, comme `parseDiscussions`. */
export function parseSpace(raw: unknown): DiscussionSpace {
  const refusal = refusalOf(raw);
  if (refusal !== null) throw refusalError(refusal);

  const body = raw as Record<string, unknown>;
  const ref = body.space as { type?: unknown; id?: unknown; title?: unknown; formId?: unknown } | null | undefined;
  if (!ref || typeof ref !== "object" || !isSpaceType(ref.type) || typeof ref.id !== "string" || ref.id === "") {
    throw refusalError("unreadable");
  }
  return {
    space: { type: ref.type, id: ref.id, title: toText(ref.title), formId: toText(ref.formId) },
    threads: Array.isArray(body.threads)
      ? body.threads.map(readSpaceThread).filter((t): t is DiscussionThread => t !== null)
      : [],
    canComment: body.canComment === true,
    truncated: body.truncated === true,
  };
}

/** Ce qu'affiche le bouton d'une fiche : les messages et les non-lus de tout l'espace. */
export function spaceTotals(threads: readonly DiscussionThread[]): { readonly total: number; readonly unread: number } {
  return threads.reduce(
    (sum, thread) => ({ total: sum.total + thread.total, unread: sum.unread + thread.unread }),
    { total: 0, unread: 0 },
  );
}

/**
 * Les fils qu'on montre à ce lecteur.
 *
 * Qui ne peut pas écrire n'a rien à faire d'un emplacement vide : la liste des discussions à
 * lancer ne lui offrirait que des fils sans message. Le fil général, lui, reste — c'est l'endroit
 * où l'on arrive, et où l'invitation à se connecter prend son sens.
 */
export function visibleSpaceThreads(
  threads: readonly DiscussionThread[],
  canComment: boolean,
): readonly DiscussionThread[] {
  return canComment ? threads : threads.filter(thread => !thread.virtual || thread.kind === "general");
}
