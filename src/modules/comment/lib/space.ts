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
import { isMaybeWritten } from "./optimistic";
import { assertGranted, readThread, toText, unreadableError } from "./discussions";

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

/** La clé d'une ligne de dépense : un segment de chemin, ou rien. Un serveur plus ancien n'en envoie pas. */
const LINE_KEY = /^[A-Za-z0-9_-]+$/;

function readLine(value: unknown): string | null {
  return typeof value === "string" && LINE_KEY.test(value) ? value : null;
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
  // Seule une ligne de dépense a une ligne : sur un autre fil, le champ ne veut rien dire.
  return { ...thread, kind, group: toText(row.group), audience, line: kind === "expense" ? readLine(row.line) : null };
}

/**
 * Les audiences qu'on peut donner à une discussion qu'on crée, dans l'ordre de l'écran. Un serveur
 * plus ancien n'envoie pas ce champ : son absence vaut « ne crée pas ». Une audience que l'écran
 * ne connaît pas n'est pas proposée — il ne saurait pas dire à qui elle ouvre.
 */
function readAudiences(value: unknown): readonly SpaceAudience[] {
  return Array.isArray(value) ? SPACE_AUDIENCES.filter(audience => value.includes(audience)) : [];
}

/**
 * Normalise la réponse de l'endpoint `space`. Lève, comme `parseDiscussions` : un refus MARQUÉ, ou
 * une réponse illisible — qui n'en est pas un, et se traite en panne (`unreadableError`).
 */
export function parseSpace(raw: unknown): DiscussionSpace {
  assertGranted(raw);

  const body = raw;
  const ref = body.space as { type?: unknown; id?: unknown; title?: unknown; formId?: unknown } | null | undefined;
  if (!ref || typeof ref !== "object" || !isSpaceType(ref.type) || typeof ref.id !== "string" || ref.id === "") {
    throw unreadableError();
  }
  return {
    space: { type: ref.type, id: ref.id, title: toText(ref.title), formId: toText(ref.formId) },
    threads: Array.isArray(body.threads)
      ? body.threads.map(readSpaceThread).filter((t): t is DiscussionThread => t !== null)
      : [],
    canComment: body.canComment === true,
    creatableAudiences: readAudiences(body.creatableAudiences),
    truncated: body.truncated === true,
  };
}

/**
 * Ce qu'une création de discussion peut rendre comme erreur. Les cinq premiers sont des refus du
 * serveur, dits chacun de sa phrase ; `unreadable` — sa réponse n'est pas celle d'une création : on
 * ne sait pas si elle a eu lieu ; `failed` — tout le reste (réseau, échec d'écriture, code inconnu).
 */
export const CREATION_REFUSALS = ["login", "hidden", "forbidden", "bad-name", "too-many"] as const;
export type CreationErrorCode = (typeof CREATION_REFUSALS)[number] | "unreadable" | "uncertain" | "failed";

function creationError(code: CreationErrorCode): Error & { creation: true; code: CreationErrorCode } {
  const erreur = new Error(code) as Error & { creation: true; code: CreationErrorCode };
  erreur.creation = true;
  erreur.code = code;
  return erreur;
}

/**
 * Le code d'une erreur de création. Ce qui ne vient pas de `parseCreatedDiscussion` est une panne,
 * et elle n'a pas toujours le même sens : `uncertain` quand le serveur a pu créer la discussion
 * avant de tomber (`isMaybeWritten` : à partir de 500, coupure du réseau comprise) — dire
 * « réessayez » en ferait créer une seconde, du même nom ; `failed` quand rien n'a pu s'écrire.
 */
export function creationErrorCodeOf(error: unknown): CreationErrorCode {
  const e = error as { creation?: unknown; code?: unknown } | null | undefined;
  if (e?.creation === true && typeof e.code === "string") return e.code as CreationErrorCode;
  return isMaybeWritten(error) ? "uncertain" : "failed";
}

/**
 * Lit la réponse de `creatediscussion` : le fil créé, dans la forme d'un fil de l'espace. Lève sur
 * un refus (`{result: false, code}`, que l'appelant a repris de l'exception du SDK par
 * `rawOrRefusal`) et sur une réponse qui n'est pas celle d'une discussion créée.
 */
export function parseCreatedDiscussion(raw: unknown): DiscussionThread {
  const body = raw as { result?: unknown; code?: unknown; thread?: unknown } | null | undefined;
  if (body && typeof body === "object" && body.result === false) {
    const connu = (CREATION_REFUSALS as readonly unknown[]).includes(body.code);
    throw creationError(connu ? (body.code as CreationErrorCode) : "failed");
  }
  const thread = body && typeof body === "object" && body.result === true ? readSpaceThread(body.thread) : null;
  if (!thread || thread.kind !== "discussion" || thread.target.path === null) throw creationError("unreadable");
  return thread;
}

/**
 * L'espace, avec une discussion de plus — rangée où le serveur la rangera : parmi les discussions,
 * par titre (sans la casse ni les accents), le chemin départageant. Une discussion déjà là est
 * remplacée, pas doublée.
 */
export function withDiscussion(space: DiscussionSpace, created: DiscussionThread): DiscussionSpace {
  const autres = space.threads.filter(thread => thread.key !== created.key);
  const precede = (thread: DiscussionThread): boolean => {
    if (thread.kind === "general") return true;
    if (thread.kind !== "discussion") return false;
    const ecart = (thread.title ?? "").localeCompare(created.title ?? "", "fr", { sensitivity: "base" });
    return ecart !== 0 ? ecart < 0 : (thread.target.path ?? "") < (created.target.path ?? "");
  };
  let rang = 0;
  while (rang < autres.length && precede(autres[rang])) rang += 1;
  return { ...space, threads: [...autres.slice(0, rang), created, ...autres.slice(rang)] };
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

/** Ce qu'un palier dit de sa discussion : où l'on entre, et ce qu'il y a à lire. */
export interface LineDiscussion {
  /** Le fil où l'on entre. `null` : l'espace n'en propose aucun pour cette ligne. */
  readonly target: CommentTarget | null;
  readonly total: number;
  readonly unread: number;
}

/**
 * La discussion d'une LIGNE de dépense — un palier de la fiche.
 *
 * Le legacy pose le fil d'une ligne sur la liste d'où l'on a cliqué (au dépôt, ou à l'étape de
 * financement) : une même ligne peut donc en avoir deux. Les compteurs les additionnent ; on entre
 * dans celui où l'on a écrit en dernier, et faute de message dans celui que le serveur propose de
 * lancer. La liste du serveur fait autorité, ici comme ailleurs : sans fil pour la ligne, `target`
 * est nul et il n'y a rien à ouvrir.
 */
export function lineDiscussion(threads: readonly DiscussionThread[], line: string): LineDiscussion {
  const fils = threads.filter(thread => thread.kind === "expense" && thread.line === line);
  let entree: DiscussionThread | null = null;
  for (const fil of fils) {
    if (entree === null) entree = fil;
    // Un fil écrit l'emporte sur un fil à lancer ; entre deux fils écrits, le plus récent.
    else if (!fil.virtual && (entree.virtual || (fil.last ?? 0) > (entree.last ?? 0))) entree = fil;
  }
  return { target: entree?.target ?? null, ...spaceTotals(fils) };
}
