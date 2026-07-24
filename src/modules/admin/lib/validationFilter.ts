/**
 * Fragment de filtre `filters` (payload searchCostum) pour le STATUT DE VALIDATION costum.
 *
 * Le legacy pose le flag « en attente » sur DEUX voies (SearchNew::getQueries:783-818) :
 *   `preferences.toBeValidated.<slug>` (voie préférences) ET `source.toBeValidated.<slug>` (voie source).
 * Un élément est VALIDÉ quand les DEUX sont absents ; EN ATTENTE quand AU MOINS un est présent.
 * Le filtre admin historique ne testait que `preferences.*` → ratait les éléments mis en attente
 * par la voie source. Ce helper couvre les deux, byte-compatible legacy ET backend Node.
 *
 * - `"validated"` → les deux flags `$exists:false` (AND implicite : deux clés distinctes dans `filters`).
 * - `"pending"`   → au moins un flag `$exists:true` → `$or` en **OBJET-MAP** `{champ: op}` (forme attendue
 *   par `SearchNew::searchFilters:549` — `foreach($value as $k=>$v)` — ET par le backend Node
 *   `buildFilters` qui accepte objet|tableau). Ne PAS passer un tableau (legacy le mangerait mal).
 *
 * ⚠ Le mode `pending` occupe la clé `$or` du filtre : ne pas combiner avec un `defaultFilters` qui
 * poserait aussi un `$or` (aucune resource admin ne le fait aujourd'hui).
 */
export function validationStatusFilter(
  costumSlug: string,
  mode: "pending" | "validated",
): Record<string, unknown> {
  const pref = `preferences.toBeValidated.${costumSlug}`;
  const src = `source.toBeValidated.${costumSlug}`;
  return mode === "validated"
    ? { [pref]: { $exists: false }, [src]: { $exists: false } }
    : { $or: { [pref]: { $exists: true }, [src]: { $exists: true } } };
}
