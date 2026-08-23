/**
 * Fusion de deux blocs de filtres Mongo destinés au backend (`defaultFilters`).
 *
 * Motif : `$or` est une clé UNIQUE, et plusieurs écrivains la revendiquent — le
 * périmètre déclaré en config (`config.prod.tiers-lieux.json` pose
 * `defaultFilters.$or = {tags:{$in:["TiersLieux"]}}` sur les pages qui portent
 * justement des groupes « par réponses ») et, depuis les facettes sur answers, le
 * réducteur `searchByFieldsToQuery`. Un simple spread `{...a, ...b}` fait gagner le
 * dernier et DÉTRUIT SILENCIEUSEMENT le périmètre de l'autre.
 *
 * La fusion s'appuie sur la grammaire réelle du backend, mesurée sur les deux
 * serveurs (legacy 5080 et Node 5099, réponses byte-identiques) :
 *  - `SearchNew::searchFilters` (modules/citizenToolKit/models/SearchNew.php:549-574)
 *    lit `$or` comme une MAP `champ => opérateur` et pousse chaque entrée en clause ;
 *    la valeur est recopiée BRUTE, donc un `$and` niché y passe intact ;
 *  - `addQuery` (SearchNew.php:23) empile inconditionnellement sous `$and[]`.
 * D'où la forme composée `$or: { $and: [ {$or:[…]}, {$or:[…]} ] }` = ET de OU,
 * vérifiée conforme à l'attendu Mongo (1 020 réponses sur 1 686, L = B au byte près).
 *
 * ⚠️ La forme TABLEAU `$or: [clause, clause]` (Mongo standard) fait un HTTP 500 sur le
 * legacy — `array_push($orArray, array($fieldPrefix . $k => $v))` avec `$k` entier
 * produit une liste BSON, refusée : « $or/$and/$nor entries need to be full objects ».
 * Ne jamais l'émettre. `orClausesOf` la tolère en LECTURE (le backend Node l'accepte).
 */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Normalise une valeur de `$or` en liste de membres de `$and` combinables.
 *  - forme composée `{ $and: [...] }` → ses membres tels quels
 *  - MAP legacy `{ champ: op, … }`    → une clause OU `{ $or: [{champ: op}, …] }`
 *  - tableau `[clause, …]`            → une clause OU `{ $or: [...] }`
 */
export function orClausesOf(orValue: unknown): unknown[] {
  if (Array.isArray(orValue)) return orValue.length ? [{ $or: orValue }] : [];
  if (!isPlainObject(orValue)) return [];
  const keys = Object.keys(orValue);
  if (keys.length === 1 && keys[0] === "$and" && Array.isArray(orValue.$and)) {
    return orValue.$and as unknown[];
  }
  if (keys.length === 0) return [];
  return [{ $or: keys.map((k) => ({ [k]: orValue[k] })) }];
}

/**
 * `{ ...base, ...extra }` — SAUF `$or`, dont les deux côtés sont composés en ET
 * (`{ $and: [...] }`) au lieu que l'un écrase l'autre.
 *
 * Quand un seul côté porte un `$or`, sa forme est conservée TELLE QUELLE : les
 * configs et les groupes « par réponses » historiques gardent exactement le fil
 * qu'ils émettaient déjà.
 */
export function mergeMongoFilters(
  base: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (key === "$or" && base.$or !== undefined) {
      const baseClauses = orClausesOf(base.$or);
      const extraClauses = orClausesOf(value);
      // Un côté sans clause n'a rien à composer : on laisse l'autre INTACT plutôt que
      // de le ré-emballer. Un `$or` VIDE émis au backend est d'ailleurs un 500 legacy
      // (« $or must be a nonempty array »).
      if (extraClauses.length === 0) continue;
      if (baseClauses.length === 0) {
        out.$or = value;
        continue;
      }
      out.$or = { $and: [...baseClauses, ...extraClauses] };
      continue;
    }
    out[key] = value;
  }
  return out;
}
