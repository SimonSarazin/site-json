/**
 * Logique PURE de la détection de doublons à la CRÉATION d'une entité (slot `entityDuplicates`
 * des formulaires costum) : ce que l'utilisateur saisit (nom, code postal) est comparé aux
 * entités que la recherche a ramenées. Aucune dépendance React — testé à part.
 *
 * Le nom SEUL ne prouve rien : dans l'annuaire des tiers-lieux (4 305 fiches, mesuré le 29/09/2026
 * avec le repli de `foldText`), 114 noms existent plusieurs fois — « L'Archipel » dans 7 villes —
 * et 34 seulement partagent aussi un code postal. D'où trois niveaux, et une alerte qui informe au
 * lieu de bloquer.
 */
import type { SearchEntity } from "@communecter/cocolight-api-client";

import { foldText } from "@/lib/foldText";
import { asRecord } from "@/modules/cagnotte/utils/coerce";
import { getEntryId, getEntrySlug } from "@/modules/search/lib/searchMapSelection";

/** Longueur minimale du nom REPLIÉ avant de chercher : en dessous, tout matche. */
export const DUPLICATE_MIN_CHARS = 3;
/** Correspondances AFFICHÉES. */
export const DUPLICATE_DISPLAY_LIMIT = 5;
/**
 * Correspondances DEMANDÉES au serveur. Le tri serveur est `updated` décroissant, pas la
 * pertinence : les homonymes exacts peuvent arriver loin (mesuré : rangs 9, 18, 29 et 30 pour
 * « La Fabrique »). On ramène large, on classe ici, on coupe ensuite.
 */
export const DUPLICATE_FETCH_LIMIT = 50;

/**
 * - `strong`   : même nom replié ET même code postal — quasi certain ;
 * - `likely`   : même nom replié ailleurs (ou code postal inconnu), ou nom approchant dans la même
 *                commune ;
 * - `possible` : nom approchant, sans autre indice.
 */
export type DuplicateLevel = "strong" | "likely" | "possible";

export interface DuplicateInput {
  name: unknown;
  postalCode?: unknown;
}

/** Ce qu'on lit d'une entité trouvée. */
export interface DuplicateCandidate {
  id: string;
  name: string;
  slug?: string;
  postalCode?: string;
  locality?: string;
}

export interface DuplicateVerdict {
  level: DuplicateLevel;
  /** Le nom replié est identique (et pas seulement approchant). */
  sameName: boolean;
  /** Le code postal saisi est celui de l'entité (faux tant que l'un des deux manque). */
  samePostalCode: boolean;
}

export interface RankedDuplicate<T> extends DuplicateVerdict {
  entity: T;
  candidate: DuplicateCandidate;
}

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : undefined;

/** Vrai dès que le nom saisi mérite une recherche. */
export function isSearchableName(name: unknown, minChars: number = DUPLICATE_MIN_CHARS): boolean {
  return foldText(name).length >= minChars;
}

/** Vue comparable d'une entité trouvée ; `null` si elle n'a ni id ni nom (rien à montrer). */
export function toDuplicateCandidate(entity: SearchEntity | null | undefined): DuplicateCandidate | null {
  if (!entity) return null;
  const data = asRecord(entity.serverData);
  const id = getEntryId(entity);
  const name = asString(data.name);
  if (!id || !name) return null;
  const address = asRecord(data.address);
  return {
    id,
    name,
    slug: getEntrySlug(entity),
    postalCode: asString(address.postalCode),
    locality: asString(address.addressLocality),
  };
}

/** Niveau d'une candidate face à la saisie ; `null` quand la saisie n'a pas de nom exploitable. */
export function duplicateLevel(input: DuplicateInput, candidate: DuplicateCandidate): DuplicateVerdict | null {
  const typed = foldText(input.name);
  if (!typed) return null;
  const sameName = typed === foldText(candidate.name);
  const typedCp = foldText(input.postalCode);
  const samePostalCode = typedCp !== "" && typedCp === foldText(candidate.postalCode);
  const level: DuplicateLevel = sameName && samePostalCode ? "strong" : sameName || samePostalCode ? "likely" : "possible";
  return { level, sameName, samePostalCode };
}

const LEVEL_RANK: Record<DuplicateLevel, number> = { strong: 0, likely: 1, possible: 2 };

/**
 * Candidates classées par niveau (le plus probant d'abord), l'ordre de la recherche étant
 * conservé dans chaque niveau (tri stable), puis bornées à `limit`. `excludeId` écarte l'entité
 * en cours d'édition : on ne se signale pas soi-même.
 */
export function rankDuplicates<T extends SearchEntity>(
  input: DuplicateInput,
  entities: readonly T[],
  options: { limit?: number; excludeId?: string | null } = {},
): RankedDuplicate<T>[] {
  const { limit = DUPLICATE_DISPLAY_LIMIT, excludeId } = options;
  const ranked: RankedDuplicate<T>[] = [];
  const seen = new Set<string>();
  for (const entity of entities) {
    const candidate = toDuplicateCandidate(entity);
    if (!candidate || candidate.id === excludeId || seen.has(candidate.id)) continue;
    const verdict = duplicateLevel(input, candidate);
    if (!verdict) continue;
    seen.add(candidate.id);
    ranked.push({ entity, candidate, ...verdict });
  }
  return ranked.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]).slice(0, Math.max(0, limit));
}

/**
 * Entités dont le nom a encore un rapport avec la saisie : l'un contient l'autre, une fois repliés.
 * Sert à trier des résultats reçus pour un nom PRÉCÉDENT pendant que le nom courant charge — la
 * liste de « La Plume » reste juste pour « La Plume à », pas pour « Zèbre ».
 */
export function stillRelevant<T extends SearchEntity>(name: unknown, entities: readonly T[]): T[] {
  const typed = foldText(name);
  if (!typed) return [];
  return entities.filter((entity) => {
    const other = foldText(asRecord(entity.serverData).name);
    return other !== "" && (other.includes(typed) || typed.includes(other));
  });
}

/** La première candidate `strong`, s'il y en a une — c'est elle qui justifie une confirmation. */
export function strongestDuplicate<T>(ranked: readonly RankedDuplicate<T>[]): RankedDuplicate<T> | undefined {
  return ranked.find((r) => r.level === "strong");
}

/** Où se trouve une candidate, en une ligne : « 62170 ATTIN ». Chaîne vide si l'adresse manque. */
export function candidatePlace(candidate: Pick<DuplicateCandidate, "postalCode" | "locality">): string {
  return [candidate.postalCode, candidate.locality].filter(Boolean).join(" ");
}

/**
 * Clé i18n de l'INDICE qui a fait remonter une correspondance (namespace `modules/profil`), ou
 * `null` pour un nom simplement approchant. L'indice est dit en texte : la couleur seule ne
 * suffit pas à distinguer les niveaux.
 */
export function duplicateHintKey(verdict: Pick<DuplicateVerdict, "sameName" | "samePostalCode">): string | null {
  if (verdict.sameName && verdict.samePostalCode) return "EntityDuplicates.hint.sameNameSamePostalCode";
  if (verdict.sameName) return "EntityDuplicates.hint.sameName";
  if (verdict.samePostalCode) return "EntityDuplicates.hint.samePostalCode";
  return null;
}

