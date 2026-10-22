import { isCarrierType, isCommentableType, type CarrierType, type CommentTarget } from "../types";

/**
 * Encodage et lecture du lien profond vers une discussion.
 *
 * L'URL est la source de vérité : les colonnes du panneau ne se parlent pas, chacune lit
 * l'URL et se recharge seule. Une adresse partagée rouvre donc exactement la même vue.
 *
 * Grammaire (valeur du paramètre, `discussion` par défaut) :
 *   `organizations:65a1…`            un fil, sur l'entité entière
 *   `organizations:65a1…:aapStep1`   un fil, sur un champ précis de l'entité (`path`)
 *   `@projects:65b0…`                un porteur seul : on liste ses fils, sans en ouvrir un
 *   `all`                            tout le parc — jamais implicite, toujours demandé
 * et le message visé vit dans le fragment : `#m-65b2…`.
 */

export const DEFAULT_DISCUSSION_PARAM = "discussion";
const MESSAGE_FRAGMENT_PREFIX = "m-";
const OBJECT_ID = /^[a-f0-9]{24}$/;

export type DiscussionSelection =
  | { readonly kind: "none" }
  | { readonly kind: "all" }
  /**
   * Un porteur seul. Son type se prend dans `CARRIER_TYPES`, PAS dans les types
   * commentables : une ville porte des fils (une action peut l'avoir pour parent) sans
   * jamais en recevoir. Valider ici avec `isCommentableType` ferait silencieusement
   * retomber `@cities:…` sur « aucune sélection ».
   */
  | { readonly kind: "holder"; readonly type: CarrierType; readonly id: string }
  | { readonly kind: "thread"; readonly target: CommentTarget };

/**
 * Un `path` désigne un champ à l'intérieur de l'entité. Les valeurs réelles sont des chemins
 * pointés, parfois longs (~190 caractères mesurés en base) :
 * `6371fd00….637c7197….68788b02….openOrganisation22112022_752_0larv1u2uoyt62l25ip.question_….comment`
 *
 * On n'accepte donc que des segments alphanumériques séparés par des points, tirets ou
 * soulignés — ce qui exclut au passage `..`, `/` et tout ce qui ressemble à une traversée
 * de chemin avant que la valeur n'atteigne le backend.
 */
const PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;

function isValidPath(path: string): boolean {
  if (path.length === 0 || path.length > 256) return false;
  return path.split(".").every(segment => PATH_SEGMENT.test(segment));
}

/** Lit la valeur du paramètre d'URL. Toute valeur mal formée rend `none`, jamais une exception. */
export function parseDiscussionValue(raw: string | null | undefined): DiscussionSelection {
  if (!raw) return { kind: "none" };
  const value = raw.trim();
  if (value === "") return { kind: "none" };
  if (value === "all") return { kind: "all" };

  const holder = value.startsWith("@");
  const parts = (holder ? value.slice(1) : value).split(":");
  const [type, id, path] = parts;

  if (!id || !OBJECT_ID.test(id)) return { kind: "none" };
  if (holder) {
    if (!isCarrierType(type) || parts.length !== 2) return { kind: "none" };
    return { kind: "holder", type, id };
  }
  if (!isCommentableType(type)) return { kind: "none" };
  if (parts.length === 2) return { kind: "thread", target: { type, id, path: null } };
  if (parts.length === 3 && path && isValidPath(path)) return { kind: "thread", target: { type, id, path } };
  return { kind: "none" };
}

/** Écrit la valeur du paramètre d'URL. Rend `null` pour « retirer le paramètre ». */
export function formatDiscussionValue(selection: DiscussionSelection): string | null {
  switch (selection.kind) {
    case "none": return null;
    case "all": return "all";
    case "holder": return `@${selection.type}:${selection.id}`;
    case "thread": {
      const { type, id, path } = selection.target;
      return path ? `${type}:${id}:${path}` : `${type}:${id}`;
    }
  }
}

/** Raccourci : la valeur d'URL qui ouvre le fil d'une cible. */
export function threadValue(target: CommentTarget): string {
  return formatDiscussionValue({ kind: "thread", target })!;
}

/** Deux cibles désignent-elles le même fil ? (sert à éviter un rechargement inutile) */
export function sameTarget(a: CommentTarget | null, b: CommentTarget | null): boolean {
  if (!a || !b) return a === b;
  return a.type === b.type && a.id === b.id && (a.path ?? null) === (b.path ?? null);
}

/** Identifiant d'ancre d'un message, pour `scrollIntoView` et pour le fragment d'URL. */
export function messageAnchorId(commentId: string): string {
  return `${MESSAGE_FRAGMENT_PREFIX}${commentId}`;
}

/** Lit l'identifiant de message porté par le fragment (`#m-…`). */
export function parseMessageFragment(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!value.startsWith(MESSAGE_FRAGMENT_PREFIX)) return null;
  const id = value.slice(MESSAGE_FRAGMENT_PREFIX.length);
  return OBJECT_ID.test(id) ? id : null;
}
