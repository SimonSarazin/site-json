import {
  isCarrierType,
  isCommentableType,
  type CarrierRef,
  type CommentTarget,
  type DiscussionCarrier,
  type DiscussionDepth,
  type DiscussionThread,
  type DiscussionsResult,
} from "../types";

/**
 * Lecture de la réponse de l'endpoint `discussions`.
 *
 * Tout passe par ici, et rien d'autre ne touche à la forme brute du backend. Trois raisons :
 *   1. le refus arrive en **HTTP 200** avec `{result:false, msg}` — tester le code HTTP ne
 *      dit rien, il faut lire `result` ;
 *   2. la réponse a **trois formes** selon le mode (`rail` n'a pas de `threads`, `fil` rend
 *      un `thread` au singulier) ;
 *   3. le porteur peut être **nul** pour de bon : 52 % des formulaires et 22 % des actualités
 *      n'ont aucun lien parent en base. Ces fils sont regroupés, jamais perdus.
 *
 * Fonctions pures : testables sans réseau, sans SDK et sans DOM.
 */

/** Clé stable d'un porteur — `"none"` pour le groupe « sans porteur ». */
export const CARRIER_NONE = "none";

export function carrierKey(carrier: CarrierRef | DiscussionCarrier | null): string {
  if (!carrier || !carrier.type || !carrier.id) return CARRIER_NONE;
  return `${carrier.type}:${carrier.id}`;
}

/**
 * Les refus que l'écran sait dire. Le serveur envoie `login` et `hidden` dans `code` ; les deux
 * autres sont posés ici. Un CODE, jamais un texte : le `msg` du serveur, en français, s'affichait
 * tel quel dans toutes les langues — c'est l'écran qui traduit (`errorCodeOf`).
 */
export type RefusalCode = "login" | "hidden" | "refused" | "unreadable";
const CODES_DU_SERVEUR: readonly RefusalCode[] = ["login", "hidden"];

/** Le code de refus, s'il y en a un. Rend `null` quand la réponse est exploitable. */
export function refusalOf(raw: unknown): RefusalCode | null {
  const body = raw as { result?: unknown; code?: unknown } | null | undefined;
  if (!body || typeof body !== "object") return "unreadable";
  if (body.result === false) {
    return CODES_DU_SERVEUR.includes(body.code as RefusalCode) ? (body.code as RefusalCode) : "refused";
  }
  if (body.result !== true) return "unreadable";
  return null;
}

/** Ce qu'une requête du panneau a rendu comme erreur : un refus codé, ou un échec (réseau, 500…). */
export type DiscussionErrorCode = RefusalCode | "failed";

export function errorCodeOf(error: unknown): DiscussionErrorCode {
  const e = error as { refus?: unknown; code?: unknown } | null | undefined;
  return e?.refus === true && typeof e.code === "string" ? (e.code as RefusalCode) : "failed";
}

function toInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

function toEpoch(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readCarrierRef(value: unknown): CarrierRef | null {
  const ref = value as { type?: unknown; id?: unknown } | null | undefined;
  if (!ref || typeof ref !== "object") return null;
  if (!isCarrierType(ref.type) || typeof ref.id !== "string" || ref.id === "") return null;
  return { type: ref.type, id: ref.id };
}

function readCarrier(value: unknown): DiscussionCarrier | null {
  const row = value as Record<string, unknown> | null | undefined;
  if (!row || typeof row !== "object") return null;
  // Le groupe « sans porteur » arrive avec id et type à null : on le garde tel quel.
  const type = isCarrierType(row.type) ? row.type : null;
  const id = typeof row.id === "string" && row.id !== "" ? row.id : null;
  if ((type === null) !== (id === null)) return null; // forme incohérente
  return {
    id,
    type,
    name: toText(row.name),
    slug: toText(row.slug),
    image: toText(row.image),
    threads: toInt(row.threads),
    total: toInt(row.total),
    unread: toInt(row.unread),
    last: toEpoch(row.last),
    mine: row.mine === true,
    membership: readMembership(row.membership),
  };
}

/** Un serveur plus ancien n'envoie pas ce champ : son absence vaut « aucune appartenance ». */
function readMembership(value: unknown): DiscussionCarrier["membership"] {
  return value === "self" || value === "admin" || value === "member" ? value : null;
}

function readThread(value: unknown): DiscussionThread | null {
  const row = value as Record<string, unknown> | null | undefined;
  if (!row || typeof row !== "object") return null;
  if (!isCommentableType(row.contextType)) return null;
  if (typeof row.contextId !== "string" || row.contextId === "") return null;

  const path = typeof row.path === "string" && row.path !== "" ? row.path : null;
  const target: CommentTarget = { type: row.contextType, id: row.contextId, path };
  return {
    key: toText(row.key) ?? `${target.type}:${target.id}${path ? `:${path}` : ""}`,
    target,
    title: toText(row.title),
    carrier: readCarrierRef(row.carrier),
    total: toInt(row.total),
    unread: toInt(row.unread),
    last: toEpoch(row.last),
    mine: row.mine === true,
    virtual: row.virtual === true,
  };
}

const DEPTHS: readonly DiscussionDepth[] = ["rail", "fils", "fil", "all"];

/**
 * Normalise une réponse du backend. Lève si elle est refusée ou illisible — l'appelant
 * (React Query) transforme ça en état d'erreur, ce qui vaut mieux qu'un panneau vide et muet.
 */
export function parseDiscussions(raw: unknown): DiscussionsResult {
  const refusal = refusalOf(raw);
  if (refusal !== null) {
    /**
     * Le refus est MARQUÉ, et ce n'est pas décoratif : c'est ce qui permet à l'appelant de ne
     * pas le réessayer. Le serveur a répondu, et il a dit non — une session expirée ou un droit
     * manquant ne deviendra pas vrai à la troisième tentative. Sans cette marque, React Query
     * retente trois fois avec un délai croissant : mesuré au navigateur, douze secondes de
     * squelettes avant que l'écran ne dise enfin pourquoi il est vide.
     */
    const erreur = new Error(refusal) as Error & { refus?: true; code?: RefusalCode };
    erreur.refus = true;
    erreur.code = refusal;
    throw erreur;
  }

  const body = raw as Record<string, unknown>;
  const depth = DEPTHS.includes(body.depth as DiscussionDepth) ? (body.depth as DiscussionDepth) : "rail";

  // Mode `fil` : un seul fil, au singulier, et son porteur à part.
  if (depth === "fil") {
    const thread = readThread(body.thread);
    const carrier = readCarrier(body.carrier);
    return {
      depth,
      carriers: carrier ? [carrier] : [],
      threads: thread ? [thread] : [],
      truncated: false,
      scanTruncated: false,
      carriersTruncated: false,
      canComment: typeof body.canComment === "boolean" ? body.canComment : null,
    };
  }

  const carriers = Array.isArray(body.carriers)
    ? body.carriers.map(readCarrier).filter((c): c is DiscussionCarrier => c !== null)
    : [];
  const threads = Array.isArray(body.threads)
    ? body.threads.map(readThread).filter((t): t is DiscussionThread => t !== null)
    : [];

  return {
    depth, carriers, threads,
    truncated: body.truncated === true,
    scanTruncated: body.scanTruncated === true,
    carriersTruncated: body.carriersTruncated === true,
    canComment: null,
  };
}

/**
 * Tri des fils dans la colonne du milieu : les non-lus d'abord, puis la dernière activité.
 *
 * Le serveur trie déjà les PORTEURS ainsi ; les fils, eux, arrivent par date décroissante
 * toutes colonnes confondues. Comme le fil se lit, lui, du plus ancien au plus récent
 * (corrigé au J3), mieux vaut poser ici la règle d'affichage plutôt que de la supposer.
 */
export function sortThreads(threads: readonly DiscussionThread[]): readonly DiscussionThread[] {
  return [...threads].sort((a, b) => {
    if ((a.unread > 0) !== (b.unread > 0)) return a.unread > 0 ? -1 : 1;
    const ecart = (b.last ?? 0) - (a.last ?? 0);
    if (ecart !== 0) return ecart;
    // Les fils vierges n'ont pas de date : sans départage, leur ordre changerait d'un
    // chargement à l'autre, et la liste semblerait bouger toute seule.
    return (a.title ?? "").localeCompare(b.title ?? "");
  });
}

/** Les fils d'un porteur donné, dans l'ordre d'affichage. */
export function threadsOfCarrier(
  threads: readonly DiscussionThread[],
  carrier: string | null,
): readonly DiscussionThread[] {
  if (carrier === null) return sortThreads(threads);
  return sortThreads(threads.filter(t => carrierKey(t.carrier) === carrier));
}

/** Total de non-lus, pour la pastille globale du panneau. */
export function totalUnread(carriers: readonly DiscussionCarrier[]): number {
  return carriers.reduce((sum, c) => sum + c.unread, 0);
}
