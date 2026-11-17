/**
 * Logique PURE de la section `formCoverage` (« qui a répondu à quel formulaire ») : retrouver, dans
 * une réponse CoForm, les organisations que désigne sa question « finder », puis indexer ces
 * désignations par formulaire. Aucune dépendance React — testé à part.
 *
 * Une réponse range ses valeurs par ÉTAPE (`answers.<étape>.<input>`) ; un finder y vaut un objet
 * `{ <id>: { id, name, type, … } }`. L'étape n'est pas dans la config (elle n'a rien à y faire : le
 * même input ne vit que dans une étape), donc l'input est cherché dans toutes les étapes — et au
 * premier niveau, pour une ligne déjà aplatie par un hook de recherche costum.
 */

import { getEntityId } from "@/modules/cagnotte/utils/dataTransform";
import { normalizeSearchText } from "@/modules/search/lib/resourceDirectorySearch";

import { getPath } from "../sections/resourceHelpers";

import { rowData, rowId, type RowLike } from "./answerCopy";

/** Un formulaire suivi par la section, tel que la config le déclare. */
export interface CoverageForm {
  formId: string;
  /** Clé de l'input finder qui désigne l'organisation ayant répondu. */
  finderInput: string;
  /** Chemins lus EN PLUS du finder (ex. `links.organizations`), même forme `{ <id>: { type } }`. */
  linkPaths?: readonly string[];
}

/** Réponses d'UN formulaire : id d'organisation → ids des réponses qui la désignent. */
export type FormCoverage = Map<string, string[]>;

/** Valeur brute de l'input `finderInput` dans un document de réponse (étapes, puis premier niveau). */
function finderValue(data: Record<string, unknown>, finderInput: string): unknown {
  const answers = data.answers;
  if (answers && typeof answers === "object") {
    for (const step of Object.values(answers as Record<string, unknown>)) {
      if (step && typeof step === "object" && finderInput in (step as Record<string, unknown>)) {
        return (step as Record<string, unknown>)[finderInput];
      }
    }
  }
  return getPath(data, finderInput);
}

/**
 * Ids des ORGANISATIONS désignées par le finder d'une réponse. Une entrée sans `type` compte (un
 * finder d'organisations n'en porte pas toujours) ; une entrée d'un autre type (citoyen) ne compte pas.
 */
export function finderOrganizationIds(data: Record<string, unknown>, finderInput: string): string[] {
  return organizationIdsOf(finderValue(data, finderInput));
}

/**
 * Organisations désignées par une réponse : son finder, puis chaque `linkPaths` — une réponse du
 * Navigateur des tiers-lieux rattache son lieu soit par le finder, soit par `links.organizations`
 * (les deux voies de `Navigator::getRessourceTL`, cf. `resolveAnswerParent`).
 */
export function answerOrganizationIds(data: Record<string, unknown>, form: CoverageForm): string[] {
  const ids = finderOrganizationIds(data, form.finderInput);
  for (const path of form.linkPaths ?? []) {
    for (const id of organizationIdsOf(getPath(data, path))) if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Ids d'une map `{ <id>: { id?, type? } }` (organisations ou entrées sans type), ou d'une LISTE d'ids /
 * d'entrées — sans quoi les index `"0"`, `"1"` d'un tableau passeraient pour des ids d'organisation.
 */
function organizationIdsOf(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const ids: string[] = [];
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((entry): [string, unknown] => [typeof entry === "string" ? entry : "", entry])
    : Object.entries(value as Record<string, unknown>);
  for (const [key, entry] of entries) {
    const e = entry && typeof entry === "object" ? (entry as { id?: unknown; type?: unknown }) : {};
    if (e.type !== undefined && e.type !== "organizations") continue;
    const id = typeof e.id === "string" && e.id ? e.id : key;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Indexe les réponses par formulaire suivi : pour chaque `formId`, les organisations désignées et
 * les réponses qui les désignent. Une réponse d'un formulaire non suivi est ignorée ; un formulaire
 * suivi sans aucune réponse a une entrée vide (et non absente) — « personne n'a répondu ».
 */
export function buildFormCoverage(answers: readonly RowLike[], forms: readonly CoverageForm[]): Map<string, FormCoverage> {
  const coverage = new Map<string, FormCoverage>(forms.map((f) => [f.formId, new Map()]));
  const formById = new Map(forms.map((f) => [f.formId, f]));
  for (const row of answers) {
    const data = rowData(row);
    // `form` : chaîne, ou `{ $id }` du JSON PHP — même lecture que l'id d'une ligne.
    const formId = getEntityId(data.form);
    const form = formById.get(formId);
    if (!form) continue;
    const answerId = rowId(row);
    const byOrg = coverage.get(formId)!;
    for (const orgId of answerOrganizationIds(data, form)) {
      const list = byOrg.get(orgId) ?? [];
      if (answerId && !list.includes(answerId)) list.push(answerId);
      byOrg.set(orgId, list);
    }
  }
  return coverage;
}

/** Lignes dont le nom contient le texte cherché — sans casse ni accents (« coopé » ≡ « Coopé »). Texte vide : tout. */
export function filterRowsByName<T extends RowLike>(rows: readonly T[], query: string): T[] {
  const q = normalizeSearchText(query);
  if (!q) return [...rows];
  return rows.filter((row) => normalizeSearchText(String(rowData(row).name ?? "")).includes(q));
}

/** Filtre « a répondu / n'a pas répondu » d'UN formulaire ; absent d'`AnswerFilter` = « Tous ». */
export type AnswerState = "answered" | "notAnswered";
/** Filtres par formulaire (`formId` → état voulu), cumulés en ET. */
export type AnswerFilter = Readonly<Record<string, AnswerState>>;

/** L'organisation `orgId` a-t-elle au moins une réponse au formulaire `formId` ? */
export function hasAnswered(coverage: ReadonlyMap<string, FormCoverage>, formId: string, orgId: string): boolean {
  return (coverage.get(formId)?.get(orgId)?.length ?? 0) > 0;
}

/**
 * Lignes qui satisfont TOUS les filtres de réponse (ex. « a répondu à Coworking ET pas à
 * Fréquentation »). Sans filtre : toutes les lignes. À n'appeler que sur une couverture COMPLÈTE —
 * sur une lecture partielle, « Pas de réponse » retiendrait des organisations qui ont répondu.
 */
export function filterRowsByAnswers<T extends RowLike>(
  rows: readonly T[],
  coverage: ReadonlyMap<string, FormCoverage>,
  filter: AnswerFilter,
): T[] {
  const entries = Object.entries(filter);
  if (entries.length === 0) return [...rows];
  return rows.filter((row) => {
    const id = rowId(row);
    return entries.every(([formId, want]) => hasAnswered(coverage, formId, id) === (want === "answered"));
  });
}

/**
 * Projection des organisations : celle de la config, plus ce que la table LIT — `name`, `slug` (lien
 * vers la fiche) et `email` (hors ligne publique). Sans `slug` explicite, le backend renvoie une ligne
 * réduite à `_id`/`name` dès qu'une projection est posée, et aucun lien ne sort.
 */
export function coverageOrgFields(defaultFields?: readonly string[]): string[] {
  return [...new Set([...(defaultFields ?? []), "name", "slug", "email"])];
}

/**
 * Projection des réponses : `form` et `answers` (le finder est cherché dans toutes les étapes), plus
 * chaque `linkPaths` — au lieu du document complet, pour ne lire que ce que `buildFormCoverage` lit.
 */
export function coverageAnswerFields(forms: readonly CoverageForm[]): string[] {
  return [...new Set(["form", "answers", ...forms.flatMap((f) => f.linkPaths ?? [])])];
}
