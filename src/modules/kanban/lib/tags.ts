/**
 * Etiquettes LIBRES d'une action Communecter (`actions.tags`, blueprint §11.4)
 * — logique PURE, testee par `tests/unit/tags.test.ts`.
 *
 * Sur un board-lien, il n'y a pas de `board.labels` saisies a la main : chaque
 * tag distinct des cartes devient une etiquette `tag:<tag>`, de couleur stable
 * derivee du nom. Ce module porte les deux moities de ce contrat :
 *  - la SAISIE (normaliser, refuser un tag reserve, dedoublonner) ;
 *  - la DERIVATION des etiquettes, a l'identique du serveur, pour qu'un tag
 *    tout juste ajoute s'affiche sans attendre un rechargement.
 *
 * Les pseudo-tags `discuter`, `next`, `totest` rangent la carte dans une
 * colonne (`Action::get_action_status`) : ce ne sont PAS des etiquettes. Les
 * laisser saisir ferait sauter la carte de colonne sous les yeux de la
 * personne qui croyait l'etiqueter.
 */
import { phpLowercase } from '@/modules/kanban/lib/phpLowercase';
import type { BoardLabel } from '@/modules/kanban/types';

/** Plafond de longueur d'un tag, en caracteres (`KanbanInput::MAX_LABEL` cote PHP). */
export const TAG_MAX_LENGTH = 60;

/** Plafond du nombre de tags qu'une carte envoie (`ActionCards::MAX_TAGS` cote PHP). */
export const CARD_TAGS_MAX = 30;

/** Prefixe des `labelIds` forges par le serveur a partir des tags (§11.4). */
export const TAG_LABEL_PREFIX = 'tag:';

/** Pseudo-tags de statut de Kanban gestion (§11.3). */
export const COMMUNECTER_STATUS_TAGS: readonly string[] = ['discuter', 'next', 'totest'];

export type TagErrorCode = 'empty' | 'tooLong' | 'reserved' | 'duplicate' | 'tooMany';

/**
 * Forme canonique d'un tag saisi : espaces de bord retires, et `#` de tete
 * retires — c'est la convention de saisie de Kanban gestion (« #web »), pas
 * une partie du nom. La casse est CONSERVEE : « Web » et « web » sont deux
 * tags distincts en base, les fusionner ici reecrirait des donnees existantes.
 */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim();
}

/**
 * Tag reserve aux colonnes ? Compare SANS la casse, comme le module PHP
 * (`ActionColumns::isStatusTag`) : « Totest » n'aurait aucun effet sur la
 * colonne dans Kanban gestion, mais il se lirait comme l'etat de la carte, et
 * le serveur le traite comme un pseudo-tag (masque a l'affichage, preserve a
 * l'ecriture). Le refuser des la saisie evite un tag qui disparaitrait.
 */
export function isStatusTag(tag: string): boolean {
  const lowered = tag.toLowerCase();
  return COMMUNECTER_STATUS_TAGS.includes(lowered);
}

/** Longueur en points de code : un emoji ou une lettre accentuee composee comptent pour un. */
function lengthOf(value: string): number {
  return [...value].length;
}

/** Erreur d'ajout de `candidate` (deja normalise) a `tags`, ou `null`. */
export function tagError(tags: readonly string[], candidate: string): TagErrorCode | null {
  if (candidate === '') return 'empty';
  if (lengthOf(candidate) > TAG_MAX_LENGTH) return 'tooLong';
  if (isStatusTag(candidate)) return 'reserved';
  if (tags.includes(candidate)) return 'duplicate';
  if (tags.length >= CARD_TAGS_MAX) return 'tooMany';
  return null;
}

export interface TagAddResult {
  tags: string[];
  /** Le tag tel qu'il a ete (ou aurait ete) ajoute, apres normalisation. */
  tag: string;
  error: TagErrorCode | null;
}

/** Ajoute un tag saisi ; en cas d'erreur, la liste rendue est une COPIE inchangee. */
export function addTag(tags: readonly string[], raw: string): TagAddResult {
  const tag = normalizeTag(raw);
  const error = tagError(tags, tag);
  return { tags: error === null ? [...tags, tag] : [...tags], tag, error };
}

export function removeTag(tags: readonly string[], tag: string): string[] {
  return tags.filter((entry) => entry !== tag);
}

/**
 * Valide une liste COMPLETE (celle qu'on s'apprete a envoyer). Premiere erreur
 * rencontree, dans l'ordre de la liste, ou `null`.
 */
export function validateTags(tags: readonly string[]): TagErrorCode | null {
  if (tags.length > CARD_TAGS_MAX) return 'tooMany';
  const seen = new Set<string>();
  for (const tag of tags) {
    if (tag.trim() === '') return 'empty';
    if (lengthOf(tag) > TAG_MAX_LENGTH) return 'tooLong';
    if (isStatusTag(tag)) return 'reserved';
    if (seen.has(tag)) return 'duplicate';
    seen.add(tag);
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Etiquettes derivees des tags                                              */
/* -------------------------------------------------------------------------- */

export function tagLabelId(tag: string): string {
  return `${TAG_LABEL_PREFIX}${tag}`;
}

/** Tag porte par un `labelId` forge, ou `null` si l'etiquette n'en vient pas. */
export function tagOfLabelId(labelId: string): string | null {
  return labelId.startsWith(TAG_LABEL_PREFIX) ? labelId.slice(TAG_LABEL_PREFIX.length) : null;
}

/**
 * Palette des etiquettes derivees — celle du module PHP (`ActionCards::$palette`),
 * dans le meme ordre : la couleur d'un tag doit etre la meme a l'ecran, que
 * l'etiquette vienne du serveur ou de l'ajout optimiste d'un tag. Les teintes
 * ne portent jamais de texte (le nom est ecrit a cote) : aucun seuil de
 * contraste ne s'y applique.
 */
export const TAG_LABEL_PALETTE: readonly string[] = [
  '#2563eb',
  '#0891b2',
  '#059669',
  '#65a30d',
  '#d97706',
  '#dc2626',
  '#db2777',
  '#7c3aed',
  '#4f46e5',
  '#0d9488',
];

/** Table du CRC-32 IEEE 802.3 — le polynome de `crc32()` en PHP. */
const CRC32_TABLE: readonly number[] = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

/** CRC-32 non signe d'une suite d'octets : la valeur exacte de `crc32()` en PHP 64 bits. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Couleur STABLE d'un tag — miroir de `ActionCards::labelColor()` :
 * `crc32(mb_strtolower(tag)) & 0x7fffffff`, modulo la palette.
 *
 * Hache les OCTETS UTF-8 du nom en minuscules, comme PHP : un hachage sur les
 * unites UTF-16 de JavaScript divergerait des le premier accent. « Web » et
 * « web » partagent donc leur couleur, comme cote serveur. Les minuscules sont
 * celles de PHP 7.4 (`phpLowercase`) et non `toLowerCase()` : le sigma final
 * grec donnait deux teintes a « ΚΟΣΜΟΣ ».
 */
export function tagLabelColor(tag: string): string {
  const hash = crc32(new TextEncoder().encode(phpLowercase(tag))) & 0x7fffffff;
  return TAG_LABEL_PALETTE[hash % TAG_LABEL_PALETTE.length];
}

export function tagLabel(tag: string): BoardLabel {
  return { id: tagLabelId(tag), name: tag, color: tagLabelColor(tag) };
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Minuscules ASCII seulement, comme `strcasecmp` : les lettres accentuees restent telles quelles. */
function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

/**
 * Ordre des etiquettes — miroir du tri de `ActionCards::labelsFor()` :
 * `strcasecmp`, puis `strcmp` pour departager « Web » et « web ».
 */
export function compareTagNames(left: string, right: string): number {
  return compareCodePoints(asciiLower(left), asciiLower(right)) || compareCodePoints(left, right);
}

/** Etiquettes d'un board-lien : un label par tag distinct des cartes, dans l'ordre du serveur. */
export function tagLabelsOf(cards: readonly { tags?: readonly string[] }[]): BoardLabel[] {
  const distinct = new Set<string>();
  for (const card of cards) {
    for (const tag of card.tags ?? []) distinct.add(tag);
  }
  return [...distinct].sort(compareTagNames).map(tagLabel);
}

/**
 * Ajoute aux etiquettes connues celles des tags qui leur manquent.
 *
 * AJOUT seulement, jamais de retrait ni de reordonnancement : les etiquettes
 * servies par le serveur restent celles qu'il a calculees (aucun saut visuel au
 * premier geste si les deux derivations differaient d'un detail), et un tag
 * qui vient d'etre saisi s'affiche sans attendre `board/get`. Une etiquette
 * devenue orpheline disparait au prochain chargement complet — inoffensive
 * d'ici la. Renvoie la MEME reference quand rien ne manque.
 */
export function withMissingTagLabels(
  labels: readonly BoardLabel[],
  cards: readonly { tags?: readonly string[] }[],
): readonly BoardLabel[] {
  const known = new Set(labels.map((label) => label.id));
  const missing = tagLabelsOf(cards).filter((label) => !known.has(label.id));
  return missing.length === 0 ? labels : [...labels, ...missing];
}

/** Noms des tags deja utilises sur le tableau : les suggestions de l'editeur. */
export function tagSuggestions(labels: readonly BoardLabel[]): string[] {
  return labels
    .map((label) => tagOfLabelId(label.id))
    .filter((tag): tag is string => tag !== null)
    .sort(compareTagNames);
}
