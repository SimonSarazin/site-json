/**
 * Types du module comment.
 *
 * Le module travaille sur un **arbre de nœuds purs** (`CommentNode`), dérivé des entités
 * `Comment` du SDK. Deux raisons :
 *   1. les entités du SDK sont des Proxy réactifs — les muter pour un affichage optimiste
 *      casse le rollback (la restauration rend la même référence, déjà modifiée) ;
 *   2. un nœud pur est testable sans SDK, sans réseau et sans DOM.
 */

/** Les dix types d'entité qui portent des commentaires (enum `GET_COMMENTS` / `ADD_COMMENTS`). */
export const COMMENTABLE_TYPES = [
  "citoyens", "organizations", "projects", "events", "poi",
  "news", "answers", "forms", "classifieds", "actions",
] as const;

export type CommentableType = (typeof COMMENTABLE_TYPES)[number];

export function isCommentableType(value: unknown): value is CommentableType {
  return typeof value === "string" && (COMMENTABLE_TYPES as readonly string[]).includes(value);
}

/** L'entité qui porte un fil : un couple (type, id). */
export interface CommentTarget {
  readonly type: CommentableType;
  /** ObjectId hexadécimal sur 24 caractères. */
  readonly id: string;
  /**
   * Champ commenté à l'intérieur de l'entité, quand le fil ne porte pas sur l'entité entière.
   * Écrit par `ADD_COMMENTS.path`, lu par `getComments({path})` (`GET_COMMENTS_BY_PATH`) ; sans
   * lui, le fil est celui de l'entité entière, réduit à ses messages sans `path`.
   */
  readonly path?: string | null;
}

export interface CommentMention {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  /**
   * Le type de l'entité mentionnée, tel que stocké (`citoyens`, `organizations`, `projects`…).
   * Absent d'une mention saisie ici, qui ne vise que des citoyens (B3). Le garder évite qu'une
   * édition ne change en citoyen la mention d'une organisation venue du legacy.
   */
  readonly type?: string;
}

export interface CommentAuthor {
  readonly id: string;
  readonly name: string;
  readonly slug: string | null;
  readonly avatarUrl: string | null;
}

/**
 * Une image attachée à un message.
 *
 * Le backend la rend **hydratée** (`convertParamsForComments` remplace chaque identifiant de
 * document par son enregistrement, augmenté de `imagePath`/`imageThumbPath`), exactement comme
 * pour une actualité. C'est cette forme-là que le module consomme ; les identifiants bruts ne
 * servent qu'à l'écriture.
 */
export interface CommentImage {
  readonly id: string;
  /** Pleine résolution. `null` quand le document a disparu — le message reste lisible. */
  readonly url: string | null;
  readonly thumbUrl: string | null;
  readonly name: string;
}

/** Un message du fil, normalisé et immuable. */
export interface CommentNode {
  readonly id: string;
  readonly text: string;
  readonly author: CommentAuthor;
  /** Timestamp UNIX en **secondes** — c'est la forme que stocke le backend (`created`). */
  readonly createdAt: number;
  /**
   * Dernière activité connue du serveur — **pas** une date d'édition.
   *
   * Mesuré : modifier le texte d'un message n'écrit AUCUNE date côté backend, alors qu'y poser
   * une réaction écrit `updated` et `modified`. S'en servir pour afficher « modifié » disait
   * donc l'inverse de la vérité. Voir le blocage B10.
   */
  readonly updatedAt: number | null;
  readonly parentId: string | null;
  readonly path: string | null;
  /** Compteurs par réaction, ex. `{ love: 3, like: 2 }`. */
  readonly reactions: Readonly<Record<string, number>>;
  /** La réaction de l'utilisateur courant sur ce message, s'il en a posé une. */
  readonly myReaction: string | null;
  readonly mentions: readonly CommentMention[];
  /**
   * Images attachées, au plus **cinq** — c'est le plafond qu'applique l'hydratation backend,
   * pas une limite d'affichage.
   */
  readonly images: readonly CommentImage[];
  /** `true` tant que l'utilisateur courant n'a pas d'entrée dans `views`. */
  readonly unread: boolean;
  readonly replies: readonly CommentNode[];
  /** Présent seulement pour un message en cours d'envoi (affichage estompé). */
  readonly pending?: true;
  /** Présent quand l'envoi a échoué (offre une action « réessayer »). */
  readonly failed?: true;
}

/**
 * Les types qui peuvent PORTER une discussion dans le rail du panneau.
 *
 * Ce n'est pas la même liste que `COMMENTABLE_TYPES`, et la différence est mesurée :
 * `cities` porte des fils (une action peut avoir une ville pour parent) sans jamais en
 * recevoir lui-même, tandis que `news`, `actions`, `forms` et `answers` reçoivent des fils
 * sans jamais en porter. Confondre les deux listes ferait disparaître du rail tout fil
 * rattaché à une ville.
 */
export const CARRIER_TYPES = [
  "citoyens", "organizations", "projects", "events", "cities", "poi", "classifieds",
] as const;

export type CarrierType = (typeof CARRIER_TYPES)[number];

export function isCarrierType(value: unknown): value is CarrierType {
  return typeof value === "string" && (CARRIER_TYPES as readonly string[]).includes(value);
}

/** Référence courte d'un porteur, telle que le backend la rend sur un fil. */
export interface CarrierRef {
  readonly type: CarrierType;
  readonly id: string;
}

/** Un porteur du rail, avec les compteurs agrégés de ses fils. */
export interface DiscussionCarrier {
  /**
   * `null` pour le groupe « sans porteur » : le backend n'a pas su remonter. Ce n'est pas
   * un cas marginal — 52 % des formulaires et 22 % des actualités n'ont aucun lien parent
   * en base. Ces fils sont regroupés plutôt que perdus.
   */
  readonly id: string | null;
  readonly type: CarrierType | null;
  readonly name: string | null;
  readonly slug: string | null;
  readonly image: string | null;
  /** Nombre de fils rangés sous ce porteur. */
  readonly threads: number;
  readonly total: number;
  readonly unread: number;
  /** Dernière activité, en **secondes**. */
  readonly last: number | null;
  /** L'utilisateur a écrit dans au moins un de ces fils. */
  readonly mine: boolean;
  /**
   * Le lien d'appartenance, quand il y en a un : `self` (sa propre page), `admin`, `member`.
   * `null` quand le porteur n'apparaît que par CADRAGE — un élément suivi, par exemple.
   *
   * C'est ce qui permet de distinguer « un espace où je peux lancer une discussion » d'« un
   * espace que je croise ». Sans lui, un porteur à zéro fil serait indiscernable d'un bug.
   */
  readonly membership: "self" | "admin" | "member" | null;
}

/** Un fil, tel que la colonne du milieu l'affiche : titré et compté, jamais son texte. */
export interface DiscussionThread {
  /** Clé du fil, telle qu'elle transite dans l'URL : `type:id` ou `type:id:path`. */
  readonly key: string;
  readonly target: CommentTarget;
  readonly title: string | null;
  readonly carrier: CarrierRef | null;
  readonly total: number;
  readonly unread: number;
  readonly last: number | null;
  readonly mine: boolean;
  /**
   * Fil FABRIQUÉ : il n'existe encore aucun message dessus, le serveur l'a composé pour
   * qu'on puisse y écrire le premier. Sans ce drapeau, le front ne pourrait pas le
   * distinguer d'un fil réel dont tous les messages auraient été supprimés.
   */
  readonly virtual: boolean;
}

export type DiscussionDepth = "rail" | "fils" | "fil" | "all";

/** Réponse du panneau, normalisée. */
export interface DiscussionsResult {
  readonly depth: DiscussionDepth;
  readonly carriers: readonly DiscussionCarrier[];
  readonly threads: readonly DiscussionThread[];
  /** Le plafond MÉTIER a été atteint : des fils vous concernant ne sont pas rendus. */
  readonly truncated: boolean;
  /**
   * Le budget de lecture a été atteint AVANT le cadrage : ce n'est pas la même chose.
   * Le premier dit « vous en avez trop », le second « le parc en a trop ».
   */
  readonly scanTruncated: boolean;
  /** Le plafond de porteurs sans discussion a été atteint. */
  readonly carriersTruncated: boolean;
  /** Mode `fil` seulement — l'utilisateur peut-il écrire dans ce fil ? */
  readonly canComment: boolean | null;
}
