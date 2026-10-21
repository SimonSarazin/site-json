import { normalizeImages } from "./commentImages";
import type { CommentAuthor, CommentMention, CommentNode } from "../types";

/**
 * Normalisation et manipulation **immuable** de l'arbre de commentaires.
 *
 * Toutes les fonctions de ce fichier sont pures : elles ne modifient jamais leur entrée et
 * renvoient une nouvelle structure. C'est ce qui rend le rollback optimiste possible —
 * l'implémentation précédente (`news/utils/commentCacheUtils.ts`) écrivait dans
 * `comment.serverData.replies`, si bien que `onError` restaurait une référence déjà modifiée
 * et que l'annulation n'annulait rien.
 *
 * Les entrées sont hétérogènes, et c'est mesuré, pas supposé :
 *   - un nœud est soit une instance SDK (`{ serverData }`), soit un objet nu (après SSR) ;
 *   - `created` arrive en `Date` depuis l'API, en secondes UNIX depuis Mongo, parfois en
 *     `{ sec, usec }` (forme legacy) ;
 *   - `author` est tantôt une entité `User`, tantôt un simple identifiant.
 */

/** Déballe un nœud, qu'il soit une instance SDK ou un objet nu. */
function payloadOf(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const asRecord = raw as Record<string, unknown>;
  const inner = asRecord.serverData ?? asRecord._serverData;
  if (inner && typeof inner === "object") return inner as Record<string, unknown>;
  return asRecord;
}

/**
 * Ramène une date à un timestamp UNIX en **secondes**, quelle que soit sa forme d'origine.
 * Renvoie 0 si rien d'exploitable : un message sans date reste affichable, en fin de tri.
 */
export function toUnixSeconds(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") {
    // Millisecondes (13 chiffres) vs secondes (10) : au-delà de ~2001 en ms, on divise.
    return value > 100_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && value.trim() !== "") return toUnixSeconds(asNumber);
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.sec === "number") return Math.floor(record.sec);
    if (typeof record.$date === "string" || typeof record.$date === "number") return toUnixSeconds(record.$date);
  }
  return 0;
}

const EMPTY_AUTHOR: CommentAuthor = { id: "", name: "", slug: null, avatarUrl: null };

function normalizeAuthor(raw: unknown): CommentAuthor {
  if (!raw) return EMPTY_AUTHOR;
  if (typeof raw === "string") return { ...EMPTY_AUTHOR, id: raw };
  const data = payloadOf(raw);
  if (!data) return EMPTY_AUTHOR;
  const id = typeof data.id === "string" ? data.id : typeof data._id === "string" ? data._id : "";
  const name = typeof data.name === "string" && data.name ? data.name
    : typeof data.username === "string" ? data.username : "";
  const slug = typeof data.slug === "string" && data.slug ? data.slug : null;
  const avatar = data.profilThumbImageUrl ?? data.profilImageUrl;
  return { id, name, slug, avatarUrl: typeof avatar === "string" && avatar ? avatar : null };
}

function normalizeMentions(raw: unknown): readonly CommentMention[] {
  // Une liste PHP à trous arrive en OBJET. L'ignorer ferait perdre ses mentions à la première
  // édition, puisque l'édition réécrit la liste entière.
  const entries = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
  return entries.flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const m = entry as Record<string, unknown>;
    const id = typeof m.id === "string" ? m.id : "";
    if (!id) return [];
    const type = typeof m.type === "string" && m.type !== "" ? m.type : null;
    return [{
      id,
      name: typeof m.name === "string" ? m.name : "",
      slug: typeof m.slug === "string" ? m.slug : "",
      ...(type ? { type } : {}),
    }];
  });
}

/** Ne garde que les compteurs strictement positifs, pour qu'aucune pastille vide ne s'affiche. */
function normalizeReactions(raw: unknown): Readonly<Record<string, number>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [statut, valeur] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof valeur === "number" ? valeur : Number(valeur);
    if (Number.isFinite(n) && n > 0) out[statut] = n;
  }
  return out;
}

/** La réaction de l'utilisateur courant, lue dans `vote[userId].status`. */
function myReactionOf(vote: unknown, meId: string | null): string | null {
  if (!meId || !vote || typeof vote !== "object") return null;
  const mine = (vote as Record<string, unknown>)[meId];
  if (!mine || typeof mine !== "object") return null;
  const status = (mine as Record<string, unknown>).status;
  return typeof status === "string" && status ? status : null;
}

/**
 * Non-lu = l'utilisateur courant n'a pas d'entrée dans `views`.
 * Un message qu'on a écrit soi-même n'est jamais non-lu, et un visiteur anonyme n'a pas de
 * non-lus du tout (sinon tout le fil s'allumerait pour une information qu'il ne peut pas acquitter).
 */
function isUnread(views: unknown, meId: string | null, authorId: string): boolean {
  if (!meId || meId === authorId) return false;
  if (!views || typeof views !== "object") return true;
  return !(meId in (views as Record<string, unknown>));
}

export interface NormalizeOptions {
  /** Identifiant de l'utilisateur courant — `null` avant hydratation, et c'est un cas normal. */
  readonly meId?: string | null;
}

/** Normalise un nœud et, récursivement, ses réponses. */
function normalizeNode(raw: unknown, meId: string | null, seen: Set<string>): CommentNode | null {
  const data = payloadOf(raw);
  if (!data) return null;

  const id = typeof data.id === "string" ? data.id
    : typeof data._id === "string" ? data._id
    : typeof data._id === "object" && data._id !== null && typeof (data._id as Record<string, unknown>).$id === "string"
      ? (data._id as Record<string, unknown>).$id as string
      : "";
  if (!id) return null;
  // Un arbre legacy peut contenir un cycle (une réponse qui se cite en ancêtre) : on coupe
  // au lieu de déborder la pile.
  if (seen.has(id)) return null;
  const branche = new Set(seen).add(id);

  const author = normalizeAuthor(data.author);
  const parentIdRaw = data.parentId;
  const parentId = typeof parentIdRaw === "string" && parentIdRaw !== "" ? parentIdRaw : null;

  const replies = Array.isArray(data.replies)
    ? data.replies.flatMap(r => { const n = normalizeNode(r, meId, branche); return n ? [n] : []; })
    : [];

  return {
    id,
    text: typeof data.text === "string" ? data.text : "",
    author,
    createdAt: toUnixSeconds(data.created ?? data.postedDate),
    updatedAt: data.updated == null && data.modified == null ? null : toUnixSeconds(data.updated ?? data.modified),
    parentId,
    path: typeof data.path === "string" && data.path !== "" ? data.path : null,
    reactions: normalizeReactions(data.voteCount),
    myReaction: myReactionOf(data.vote, meId),
    mentions: normalizeMentions(data.mentions),
    // Le backend hydrate `mediaImg` à la lecture (`convertParamsForComments`) : on y trouve
    // des documents complets, pas des identifiants. Voir `normalizeImages`.
    images: normalizeImages(data.mediaImg),
    unread: isUnread(data.views, meId, author.id),
    replies,
  };
}

/**
 * Trie un niveau du **plus ancien au plus récent**, récursivement.
 *
 * Indispensable, et mesuré : l'API rend les racines en ordre **décroissant**, si bien qu'un fil
 * se lisait à l'envers — le dernier message en tête. Un fil de discussion est chronologique, et
 * c'est le module qui en répond : compter sur l'ordre du serveur, c'est dépendre d'un détail
 * d'implémentation qu'aucun contrat n'énonce.
 *
 * Tri **stable** sur `createdAt` : deux messages de la même seconde gardent l'ordre reçu.
 */
function sortChronologically(nodes: readonly CommentNode[]): readonly CommentNode[] {
  const sorted = [...nodes].sort((a, b) => a.createdAt - b.createdAt);
  return sorted.map(node => {
    const replies = sortChronologically(node.replies);
    return replies === node.replies ? node : { ...node, replies };
  });
}

/** Normalise une liste de commentaires racine venue du SDK (ou du cache SSR). */
export function toCommentTree(raw: unknown, options: NormalizeOptions = {}): readonly CommentNode[] {
  if (!Array.isArray(raw)) return [];
  const meId = options.meId ?? null;
  const nodes = raw.flatMap(entry => {
    const n = normalizeNode(entry, meId, new Set());
    return n ? [n] : [];
  });
  return sortChronologically(nodes);
}

// ─────────────────────────── opérations immuables ───────────────────────────

/** Applique une transformation au nœud visé, en recréant uniquement la branche traversée. */
export function mapNode(
  tree: readonly CommentNode[],
  id: string,
  transform: (node: CommentNode) => CommentNode,
): readonly CommentNode[] {
  let touched = false;
  const next = tree.map(node => {
    if (node.id === id) { touched = true; return transform(node); }
    const replies = mapNode(node.replies, id, transform);
    if (replies !== node.replies) { touched = true; return { ...node, replies }; }
    return node;
  });
  // Renvoyer la MÊME référence quand rien n'a changé évite un rendu inutile en aval.
  return touched ? next : tree;
}

/** Retire un message et toute sa descendance. */
export function removeNode(tree: readonly CommentNode[], id: string): readonly CommentNode[] {
  let touched = false;
  const next: CommentNode[] = [];
  for (const node of tree) {
    if (node.id === id) { touched = true; continue; }
    const replies = removeNode(node.replies, id);
    if (replies !== node.replies) { touched = true; next.push({ ...node, replies }); }
    else next.push(node);
  }
  return touched ? next : tree;
}

/** Remplace le texte d'un message (et marque la date de modification si elle est fournie). */
export function updateNodeText(
  tree: readonly CommentNode[],
  id: string,
  text: string,
  updatedAt?: number,
): readonly CommentNode[] {
  return mapNode(tree, id, node => ({ ...node, text, updatedAt: updatedAt ?? node.updatedAt }));
}

/** Ajoute une réponse sous le message visé. `parentId === null` ajoute à la racine. */
export function addReply(
  tree: readonly CommentNode[],
  parentId: string | null,
  reply: CommentNode,
): readonly CommentNode[] {
  if (parentId === null) return [...tree, reply];
  return mapNode(tree, parentId, node => ({ ...node, replies: [...node.replies, reply] }));
}

/** Remplace un message par un autre — sert à substituer un message optimiste par le message réel. */
export function replaceNode(
  tree: readonly CommentNode[],
  id: string,
  replacement: CommentNode,
): readonly CommentNode[] {
  return mapNode(tree, id, node => ({ ...replacement, replies: replacement.replies.length ? replacement.replies : node.replies }));
}

/**
 * Bascule la réaction de l'utilisateur courant, en tenant les compteurs à jour.
 * Reposer la même réaction la retire (c'est le comportement attendu d'une pastille).
 */
export function toggleReaction(
  tree: readonly CommentNode[],
  id: string,
  reaction: string,
): readonly CommentNode[] {
  return mapNode(tree, id, node => {
    const reactions: Record<string, number> = { ...node.reactions };
    const ancienne = node.myReaction;
    const retire = ancienne === reaction;

    if (ancienne) {
      const reste = (reactions[ancienne] ?? 1) - 1;
      if (reste > 0) reactions[ancienne] = reste; else delete reactions[ancienne];
    }
    if (!retire) reactions[reaction] = (reactions[reaction] ?? 0) + 1;

    return { ...node, reactions, myReaction: retire ? null : reaction };
  });
}

/** Cherche un message dans tout l'arbre. */
export function findNode(tree: readonly CommentNode[], id: string): CommentNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNode(node.replies, id);
    if (found) return found;
  }
  return null;
}

/** La chaîne des ancêtres d'un message, du plus haut au parent direct (vide s'il est à la racine). */
export function ancestorsOf(tree: readonly CommentNode[], id: string): readonly CommentNode[] {
  const chemin: CommentNode[] = [];
  const descendre = (nodes: readonly CommentNode[]): boolean => {
    for (const node of nodes) {
      if (node.id === id) return true;
      chemin.push(node);
      if (descendre(node.replies)) return true;
      chemin.pop();
    }
    return false;
  };
  return descendre(tree) ? chemin : [];
}

/** Les identifiants des messages non lus, à toute profondeur, dans l'ordre du fil. */
export function unreadIds(tree: readonly CommentNode[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: readonly CommentNode[]) => {
    for (const node of nodes) {
      if (node.unread) ids.push(node.id);
      walk(node.replies);
    }
  };
  walk(tree);
  return ids;
}

/**
 * L'arbre, où les identifiants donnés restent NON LUS — même si le serveur les dit lus depuis.
 * Partage structurel : une branche sans changement garde sa référence.
 */
export function withUnread(tree: readonly CommentNode[], ids: ReadonlySet<string>): readonly CommentNode[] {
  if (ids.size === 0) return tree;
  let change = false;
  const next = tree.map(node => {
    const replies = withUnread(node.replies, ids);
    const unread = node.unread || ids.has(node.id);
    if (replies === node.replies && unread === node.unread) return node;
    change = true;
    return { ...node, unread, replies };
  });
  return change ? next : tree;
}

/** Nombre total de messages, réponses comprises. */
export function countNodes(tree: readonly CommentNode[]): number {
  return tree.reduce((total, node) => total + 1 + countNodes(node.replies), 0);
}

/** Nombre de messages non lus, réponses comprises. */
export function countUnread(tree: readonly CommentNode[]): number {
  return tree.reduce((total, node) => total + (node.unread ? 1 : 0) + countUnread(node.replies), 0);
}

/** Profondeur maximale de l'arbre (0 pour un fil sans réponse). */
export function maxDepth(tree: readonly CommentNode[], depth = 0): number {
  return tree.reduce((max, node) => Math.max(max, maxDepth(node.replies, depth + 1)), depth);
}

/** Date du message le plus récent, réponses comprises (0 si le fil est vide). */
export function lastActivityAt(tree: readonly CommentNode[]): number {
  return tree.reduce((max, node) => Math.max(max, node.createdAt, lastActivityAt(node.replies)), 0);
}

/**
 * Les auteurs distincts d'une branche, du plus récent au plus ancien.
 *
 * Sert aux avatars empilés d'une branche repliée — le repère de Slack : on voit QUI a répondu
 * sans rien déplier. Le plus récent d'abord, parce que c'est lui qu'on cherche.
 */
export function branchAuthors(tree: readonly CommentNode[], max = 3): readonly CommentAuthor[] {
  const tous: CommentNode[] = [];
  const parcourir = (nodes: readonly CommentNode[]) => {
    for (const node of nodes) { tous.push(node); parcourir(node.replies); }
  };
  parcourir(tree);
  tous.sort((a, b) => b.createdAt - a.createdAt);
  const vus = new Set<string>();
  const auteurs: CommentAuthor[] = [];
  for (const node of tous) {
    if (vus.has(node.author.id)) continue;
    vus.add(node.author.id);
    auteurs.push(node.author);
    if (auteurs.length >= max) break;
  }
  return auteurs;
}
