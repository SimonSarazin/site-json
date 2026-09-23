/**
 * Logique PURE de la section `answerCopy` (reprise de réponses d'un form source vers le form du
 * site) : identifier une ligne, calculer son empreinte de doublon, indexer les réponses du form
 * cible et en déduire l'état de chaque candidate. Aucune dépendance React — testé à part.
 *
 * Les lignes sont des résultats de recherche (instances lib `{ id, serverData }`) APLATIS par le
 * hook costum de recherche : `name`, `structure.name`, `address.*`, `copiedFrom`… au premier niveau
 * de `serverData`.
 */

import { getEntityId } from "@/modules/cagnotte/utils/dataTransform";

import { getPath } from "../sections/resourceHelpers";

export type CopyStatus = "copied" | "probable" | "new";

/** Empreinte par défaut d'un doublon probable : mêmes intitulé, structure et code postal. */
export const DEFAULT_DUPLICATE_KEYS = ["name", "structure.name", "address.postalCode"] as const;

/** Une ligne de tableau admin : instance lib (`id`) portant le document aplati (`serverData`). */
export interface RowLike {
  id?: unknown;
  serverData?: Record<string, unknown> | null;
}

export interface CopyIndex {
  /** id source (`copiedFrom`) → id de la copie dans le form cible. */
  copies: Map<string, string>;
  /** Empreintes de TOUTES les réponses cibles (tracées ou non) sur `duplicateKeys`. */
  signatures: Set<string>;
}

export interface CopyVerdict {
  status: CopyStatus;
  /** Id de la copie existante (statut `copied`). */
  copyId?: string;
}

/** Document aplati d'une ligne (objet vide si absent). */
export function rowData(row: RowLike | null | undefined): Record<string, unknown> {
  const data = row?.serverData;
  return data && typeof data === "object" ? data : {};
}

/**
 * Id d'une ligne : l'instance lib d'abord (`id`), puis le document via `getEntityId` (`id`,
 * `_id.$id` du JSON PHP, `_id._str` du payload SSR revivifié), puis un `_id` déjà en chaîne — le
 * seul cas que `getEntityId` ne couvre pas. Chaîne vide si aucun.
 */
export function rowId(row: RowLike | null | undefined): string {
  const direct = row?.id;
  if (typeof direct === "string" && direct) return direct;
  const data = rowData(row);
  const found = getEntityId(data);
  if (found) return found;
  return typeof data._id === "string" ? data._id : "";
}

/** Normalisation d'une valeur d'empreinte : texte trimé, casse et espaces repliés — « GYM  douce » ≡ « gym douce ». */
function normalize(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim().toLowerCase().replace(/\s+/g, " ");
  }
  return "";
}

/** Séparateur d'empreinte : un caractère de contrôle, impossible dans une valeur normalisée — sans
 *  lui, « gym 9 » + « 7430 » et « gym » + « 97430 » donneraient la même chaîne. */
const SIGNATURE_SEPARATOR = "\u001f";

/**
 * Empreinte d'une ligne sur `keys` (chemins pointés du document aplati). `null` quand AUCUNE clé
 * n'a de valeur : une ligne vide ne doit jamais « matcher » une autre ligne vide.
 */
export function rowSignature(row: RowLike | null | undefined, keys: readonly string[]): string | null {
  const data = rowData(row);
  const parts = keys.map((k) => normalize(getPath(data, k)));
  return parts.some((p) => p !== "") ? parts.join(SIGNATURE_SEPARATOR) : null;
}

/**
 * Index des réponses du form CIBLE : la trace `copiedFrom` fait foi (copie certaine) ; TOUTES les
 * réponses alimentent les empreintes (doublon probable), tracées comprises — un second dépôt SSBE
 * homonyme d'une source déjà reprise (même intitulé, même structure, même CP) doit demander
 * confirmation, c'est le cas de doublon le plus fréquent. La propre source d'une copie tracée n'en
 * souffre pas : `copyStatusOf` teste la trace AVANT l'empreinte.
 */
export function buildCopyIndex(targetRows: readonly RowLike[], keys: readonly string[]): CopyIndex {
  const copies = new Map<string, string>();
  const signatures = new Set<string>();
  for (const row of targetRows) {
    const data = rowData(row);
    const from = data.copiedFrom;
    if (typeof from === "string" && from) copies.set(from, rowId(row));
    const sig = rowSignature(row, keys);
    if (sig !== null) signatures.add(sig);
  }
  return { copies, signatures };
}

/** État d'une candidate : `copied` (trace) > `probable` (empreinte) > `new`. */
export function copyStatusOf(row: RowLike, index: CopyIndex, keys: readonly string[]): CopyVerdict {
  const id = rowId(row);
  const copyId = id ? index.copies.get(id) : undefined;
  if (copyId !== undefined) return { status: "copied", copyId };
  const sig = rowSignature(row, keys);
  if (sig !== null && index.signatures.has(sig)) return { status: "probable" };
  return { status: "new" };
}
