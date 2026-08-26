import type { SearchByFieldValue } from "../contexts/pageFilters";
import type { FilterGroupLike, FilterAnswerDataLike } from "./computeFiltersFromUrl";

/**
 * Inverse de `computeFiltersFromUrl` : projette l'état `PageFilters`
 * (selectedFilters + searchByFields) dans des query params d'URL, **à
 * l'identique du format lu** (`?<group.id>=slug,slug`). Produit le miroir URL
 * écrit par `FiltersSection` au clic → permaliens partageables + back/forward.
 *
 * Couvre TOUS les types de filtres de la sidebar :
 *  - recherche texte                         → `?search=` (cf. effet de lecture `?search=`)
 *  - groupes « tag » (typologies…)         → `selectedFilters[group.id]`
 *  - `entityList` (réseaux régionaux)        → noms d'options présents dans `searchByFields`
 *  - `scopeList` (pays / régions)            → noms d'options présents dans `searchByFields`
 *  - « par réponses » (filtersByAnswers/Path, services) → clés d'options présentes dans `searchByFields`
 *
 * Part de `current` (et le clone) pour préserver tous les params hors filtres
 * (pagination…) et l'ordre existant → comparaison d'égalité stable côté appelant
 * (pas d'écriture parasite).
 */
/**
 * Sérialise une sélection en valeur de query param : chaque valeur est ENCODÉE avant d'être jointe
 * par une virgule.
 *
 * La lecture (`computeFiltersFromUrl`) fait `split(",")` PUIS `decodeURIComponent` sur chaque
 * fragment : sans l'encodage à l'écriture, une valeur contenant elle-même une virgule était
 * redécoupée en morceaux qui ne correspondaient à aucune option, et le paramètre était supprimé de
 * l'URL. En liste mixte la perte était PARTIELLE et silencieuse — les valeurs sans virgule
 * survivaient, l'autre disparaissait. 4 valeurs du parc étaient dans ce cas (groupe `portage` de
 * relief et tiers-lieux, ex. « Collectivités (Département, Intercommunalité, Région, etc) »).
 *
 * Ce n'est pas une nouvelle convention : `dropdownFilters.ts:134` écrit déjà
 * `optionIds.map(encodeURIComponent).join(",")`, avec sa lecture symétrique en
 * `SearchHeaderSection.tsx:287-289`. On aligne simplement ce module sur l'autre.
 *
 * ⚠️ NE PAS appliquer au csv `dateRange` (`${start},${end}`) : son lecteur
 * (`computeFiltersFromUrl.ts:147`) ne décode PAS, et la position de début vide (`,end`) est
 * significative — l'encoder ferait glisser la borne de fin en borne de début.
 *
 * Rétrocompatible : l'encodage est l'IDENTITÉ sur une valeur URL-safe, et la lecture décodait déjà.
 * Aucune URL déjà partagée ne cesse de fonctionner.
 */
function encodeValues(values: string[]): string {
  return values.map(encodeURIComponent).join(",");
}

export function computeUrlFromFilters(
  current: URLSearchParams,
  selectedFilters: Record<string, string[]>,
  searchByFields: Record<string, SearchByFieldValue>,
  filterGroups: FilterGroupLike[],
  searchQuery = "",
  filterAnswerData: FilterAnswerDataLike = null,
): URLSearchParams {
  const params = new URLSearchParams(current);

  // Recherche texte (sidebar) — même param que l'effet de lecture `?search=`.
  const q = searchQuery.trim();
  if (q) params.set("search", q);
  else params.delete("search");

  for (const group of filterGroups) {
    // dateRange : sélection en `searchByFields` sous la clé du GROUPE —
    // miroir `?<group.id>=start[,end]` (ou `,end` pour une plage « fin seule »).
    if (group.type === "dateRange") {
      const entry = searchByFields[group.id];
      const range = (entry?.value ?? {}) as { start?: string; end?: string };
      const start = range.start ?? "";
      const end = range.end ?? "";
      // On CONSERVE la position de début vide (`,end`) : un `.filter(Boolean)`
      // ferait glisser une borne de fin seule en position de début au round-trip
      // (la borne « Jusqu'au » deviendrait « À partir du »).
      const csv = end ? `${start},${end}` : start;
      if (csv) params.set(group.id, csv);
      else params.delete(group.id);
      continue;
    }
    // entityList, scopeList, searchTargets & groupes « champ » (taxonomie en
    // champs : parent62) : sélection en `searchByFields`, clé = nom d'option.
    // (`dateRange` est traité au-dessus, il n'atteint jamais cette branche.)
    if (
      group.type === "entityList" ||
      group.type === "scopeList" ||
      group.type === "searchTargets" ||
      group.field
    ) {
      const optionNames = (group.options ?? []).map((o) => o.name || o.id);
      // Options pas encore chargées (query entités/zones en vol) : on ne touche
      // PAS au param — sinon un deep-link `?<group.id>=…` serait effacé avant que
      // la lecture URL puisse l'hydrater.
      if (optionNames.length === 0) continue;
      const active = optionNames.filter((n) =>
        Object.prototype.hasOwnProperty.call(searchByFields, n),
      );
      if (active.length) params.set(group.id, encodeValues(active));
      else params.delete(group.id);
      continue;
    }
    // Groupe « tag » : miroir direct de la sélection catégorie.
    const active = selectedFilters[group.id] ?? [];
    if (active.length) params.set(group.id, encodeValues(active));
    else params.delete(group.id);
  }

  // Groupes « par réponses » (services form-based) : clé d'option présente dans
  // `searchByFields` (field `_id` → orgaNameArray). Param `?<groupId>=key1,key2`.
  for (const [groupId, grp] of Object.entries(filterAnswerData ?? {})) {
    const optionKeys = Object.keys(grp.values);
    // Données CoForm pas (encore) chargées : on ne touche pas au param.
    if (optionKeys.length === 0) continue;
    const active = optionKeys.filter((k) =>
      Object.prototype.hasOwnProperty.call(searchByFields, k),
    );
    if (active.length) params.set(groupId, encodeValues(active));
    else params.delete(groupId);
  }

  return params;
}
