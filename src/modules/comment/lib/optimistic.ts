import type { CommentAuthor, CommentImage, CommentMention, CommentNode } from "../types";

/**
 * Affichage optimiste et lecture des échecs d'écriture.
 *
 * Deux règles, l'une et l'autre tirées d'un fait mesuré sur ce backend :
 *
 * 1. **Un nœud optimiste est un nœud pur comme les autres.** L'implémentation `news` fabriquait
 *    un faux objet `Comment` (`{ id, serverData, data }` forcé en `as unknown as Comment`) et le
 *    poussait dans le cache d'instances ; toute la suite du code devait alors se demander si un
 *    élément était une vraie entité. Ici l'arbre rendu ne contient que des `CommentNode`, et
 *    l'index d'instances n'est jamais touché par une mise à jour optimiste.
 *
 * 2. **Un écrit peut réussir *puis* échouer.** C'est exactement ce que faisait le bug B8 :
 *    le commentaire était inséré en base, puis la notification levait `Undefined index` et la
 *    requête rendait un 500. Conclure « l'envoi a échoué » et retirer le message affichait
 *    l'inverse de la vérité. Au-delà de 500, on ne tranche donc pas : on relit le fil.
 */

/**
 * Préfixe des identifiants provisoires. Assez distinctif pour qu'aucun ObjectId (24 caractères
 * hexadécimaux) ne puisse lui ressembler, et pour qu'un `pending:` qui fuirait vers le serveur
 * saute aux yeux dans une trace.
 */
export const OPTIMISTIC_ID_PREFIX = "pending:";

let sequence = 0;

/**
 * Identifiant provisoire unique.
 * Le compteur n'est pas décoratif : deux envois dans la même milliseconde partageraient sinon
 * la même clé de rendu, et React fusionnerait les deux messages.
 */
export function nextOptimisticId(): string {
  sequence += 1;
  return `${OPTIMISTIC_ID_PREFIX}${Date.now()}-${sequence}`;
}

/** `true` si l'identifiant désigne un message qui n'existe pas encore côté serveur. */
export function isOptimisticId(id: string): boolean {
  return typeof id === "string" && id.startsWith(OPTIMISTIC_ID_PREFIX);
}

export interface OptimisticNodeInput {
  readonly text: string;
  readonly author: CommentAuthor;
  readonly parentId?: string | null;
  readonly path?: string | null;
  /** Les personnes mentionnées — affichées dès l'envoi, comme dans le message définitif. */
  readonly mentions?: readonly CommentMention[];
  /**
   * Les images jointes, avec leurs aperçus LOCAUX (`blob:`).
   *
   * Le serveur, lui, ne renverra leurs URL qu'à la relecture du fil : sans cela, une image
   * disparaîtrait à l'instant de l'envoi pour ne revenir qu'une seconde plus tard.
   */
  readonly images?: readonly CommentImage[];
  /** Injectable pour les tests ; par défaut, l'instant présent en secondes UNIX. */
  readonly createdAt?: number;
  /** Injectable pour les tests ; par défaut, un identifiant provisoire frais. */
  readonly id?: string;
}

/** Fabrique le message affiché pendant l'envoi. */
export function makeOptimisticNode(input: OptimisticNodeInput): CommentNode {
  return {
    id: input.id ?? nextOptimisticId(),
    text: input.text,
    author: input.author,
    createdAt: input.createdAt ?? Math.floor(Date.now() / 1000),
    updatedAt: null,
    parentId: input.parentId ?? null,
    path: input.path ?? null,
    reactions: {},
    myReaction: null,
    mentions: input.mentions ?? [],
    images: input.images ?? [],
    // Son propre message n'est jamais non lu.
    unread: false,
    replies: [],
    pending: true,
  };
}

/**
 * L'écrit a-t-il pu aboutir malgré l'erreur ?
 *
 * `true` à partir de 500 : le serveur a reçu la requête et l'a traitée au moins en partie.
 * `false` pour les refus francs (400 de validation, 401/403 d'autorisation, 404) et pour les
 * erreurs levées avant le départ de la requête (validation AJV du client), où rien n'a été écrit.
 *
 * Un 503 de coupe-circuit répond `true` alors que rien n'est parti : la conséquence est une
 * relecture inutile, jamais un affichage faux — c'est le bon sens de l'erreur.
 */
export function isMaybeWritten(error: unknown): boolean {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  return typeof status === "number" && status >= 500;
}

/** Message d'erreur lisible, sans jamais afficher « undefined ». */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Rend un nœud optimiste définitif : il prend l'identifiant que le serveur vient de lui donner
 * et perd son voile d'envoi. Le reste du message arrive avec la relecture du fil ; ne rien
 * inventer ici évite de dépendre de la forme exacte de la réponse d'écriture.
 */
export function settleOptimistic(node: CommentNode, realId: string | null): CommentNode {
  const { pending: _pending, failed: _failed, ...rest } = node;
  return realId ? { ...rest, id: realId } : rest;
}
