import type { SearchByFieldValue } from "../contexts/pageFilters";
import { ANSWER_PATH_TYPE, answerFilterClause } from "./answerFilterClause";
import { TOKEN_MATCH_TYPE, tokenMatchPattern } from "./tokenMatch";

/** Type d'entrée `searchByFields` d'une EXCLUSION : `value` = valeurs à écarter du champ, traduites en
 *  `$nin`. Défini ICI, chez le traducteur, et non chez son producteur (`slotFilter.ts`) : ce module est
 *  chargé par toutes les listes, il ne doit pas tirer la logique des réservations. */
export const EXCLUDE_TYPE = "exclude";

/**
 * Traduit le `searchByFields` du `PageFilters` (filtres dynamiques : answers
 * form-based, scopeList, sourceKey) en les 3 morceaux de requête consommés par
 * `searchCostum` :
 *  - `filters`   : filtres MongoDB `{ field: { $in: [...] } }` (services form-based, etc.)
 *  - `locality`  : zones (`scopeList`)
 *  - `sourceKeys`: clés natives SDK (`entityList` → réseaux régionaux)
 *
 * Source unique réutilisée par `SearchProStatic` (liste) **et** `useAutocomplete`
 * (suggestions du hero) → mêmes filtres dynamiques des deux côtés.
 */
/** Cible du filtre « type d'info » (groupe `searchTargets`) — cf. schema.SearchTarget. */
export interface SearchTargetQuery {
  defaultTypes?: string[];
  defaultFilters?: Record<string, unknown>;
}

export function searchByFieldsToQuery(
  searchByFields: Record<string, SearchByFieldValue> = {},
): {
  /** `$in` (tags/valeurs), `$nin` (exclusions calculées), opérateurs date (`$gt`/`$lte`) et
   *  `$or: { $and }` (facettes sur réponses, champs multi-valeurs `token`) — envoyés tels quels au backend. */
  filters: Record<string, Record<string, unknown>>;
  locality: Record<string, unknown>;
  sourceKeys: string[];
  /** Sélection unique (radio) — appliquée par SearchProStatic : remplace
   *  `defaultTypes` et fusionne `defaultFilters` de la section. */
  searchTarget: SearchTargetQuery | null;
} {
  const filters: Record<string, Record<string, unknown>> = {};
  const locality: Record<string, unknown> = {};
  const sourceKeys: string[] = [];
  let searchTarget: SearchTargetQuery | null = null;
  // Facettes sur une liste d'`answers` : valeurs cochées regroupées PAR CHAMP de
  // réponse (clé = chemin). Assemblées après la boucle en ET de OU (cf. plus bas).
  const answerGroups = new Map<string, string[]>();
  // Champs MULTI-VALEURS (`match: "token"`) : valeurs cochées regroupées par champ, comparées
  // élément par élément d'une liste « a, b » au lieu d'à l'identique (cf. tokenMatch.ts).
  const tokenGroups = new Map<string, string[]>();

  for (const { field, type, value } of Object.values(searchByFields)) {
    if (type === "scopeList") {
      if (!locality[field]) locality[field] = value;
      continue;
    }
    if (type === "sourceKey") {
      if (Array.isArray(value)) sourceKeys.push(...value);
      continue;
    }
    if (type === "searchTarget") {
      // Pas un filtre Mongo : porté séparément (defaultTypes/defaultFilters).
      // Radio côté toggle → au plus une entrée de ce type dans searchByFields.
      if (value && !Array.isArray(value)) searchTarget = value as SearchTargetQuery;
      continue;
    }
    if (type === "dateRange") {
      // SEUL `$gt` est converti en date par le backend (SearchNew::getQueries) ;
      // `end` n'est émis que si présent (rendu conditionné à `withEnd`, cf.
      // schema.ts — $lte en attente du support backend, demande Aboire).
      const range = (value ?? {}) as { start?: string; end?: string };
      const dateOps: Record<string, string> = {};
      if (range.start) dateOps.$gt = range.start;
      if (range.end) dateOps.$lte = range.end;
      if (Object.keys(dateOps).length > 0) {
        filters[field] = { ...(filters[field] ?? {}), ...dateOps };
      }
      continue;
    }
    if (type === ANSWER_PATH_TYPE) {
      // La liste porte les réponses elles-mêmes : le prédicat porte sur le CHEMIN de
      // la réponse, pas sur `_id` (cf. answerFilterClause). Pas d'écriture directe
      // dans `filters` : les valeurs d'un même champ doivent finir en OU.
      if (Array.isArray(value) && value.length > 0) {
        answerGroups.set(field, [...(answerGroups.get(field) ?? []), ...(value as string[])]);
      }
      continue;
    }
    if (type === TOKEN_MATCH_TYPE) {
      // Pas d'écriture directe dans `filters` : un `$in` comparerait à l'identique.
      if (Array.isArray(value) && value.length > 0) {
        tokenGroups.set(field, [...(tokenGroups.get(field) ?? []), ...(value as string[])]);
      }
      continue;
    }
    if (type === EXCLUDE_TYPE) {
      // Exclusion CALCULÉE par son producteur (filtre créneau : ressources occupées) → `$nin`, cumulée
      // avec une exclusion du même champ et compatible avec un `$in` (le backend applique les deux).
      // Vide — rien d'occupé — : aucune clause, la liste reste entière.
      if (Array.isArray(value) && value.length > 0) {
        const existing = (filters[field]?.$nin as string[] | undefined) ?? [];
        filters[field] = { ...(filters[field] ?? {}), $nin: Array.from(new Set([...existing, ...value])) };
      }
      continue;
    }
    if (Array.isArray(value) && value.length > 0) {
      if (!filters[field]) {
        filters[field] = { $in: value };
      } else {
        const existing = (filters[field].$in as string[] | undefined) ?? [];
        filters[field].$in = Array.from(new Set([...existing, ...value]));
      }
    }
  }

  // ET de OU : un `$or` par champ de réponse (les valeurs cochées d'un groupe sont
  // alternatives), l'ensemble composé sous la clé UNIQUE `$or` — seule forme que la
  // grammaire du backend sait recevoir des deux côtés (legacy et Node), cf.
  // `mongoFilters.ts` pour la démonstration et les formes à ne pas émettre.
  const answerAnd: unknown[] = [];
  for (const [fieldPath, values] of answerGroups) {
    const clauses: Record<string, unknown>[] = [];
    for (const value of Array.from(new Set(values))) {
      const clause = answerFilterClause(fieldPath, value);
      if (clause) {
        clauses.push(clause);
        continue;
      }
      // Inexprimable (libellé de multiCheckboxPlus contenant un point) : on n'émet
      // PAS de filtre mort. Bruyant en dev, signalé par tests/preflight en CI.
      if (import.meta.env.DEV) {
        console.warn(
          `[filtersByAnswers] valeur non filtrable (le libellé contient un point) : "${value}" sur ${fieldPath}`,
        );
      }
    }
    if (clauses.length > 0) answerAnd.push({ $or: clauses });
  }
  // Un `$regex` par champ multi-valeurs (ses valeurs cochées en OU dans le motif), membre du MÊME ET
  // que les facettes sur réponses : c'est le seul canal que le backend recopie brut jusqu'à Mongo.
  // Sans filtre `token` coché, la sortie est identique octet pour octet à ce qu'elle était.
  const tokenAnd: unknown[] = [];
  for (const [field, values] of tokenGroups) {
    tokenAnd.push({ [field]: { $regex: tokenMatchPattern(Array.from(new Set(values))) } });
  }
  const andClauses = [...answerAnd, ...tokenAnd];
  if (andClauses.length > 0) filters.$or = { $and: andClauses };

  return { filters, locality, sourceKeys, searchTarget };
}
