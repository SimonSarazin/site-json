import type { SiteConfig } from "@/types/site-schema";
import type { SearchHeaderSectionProps } from "@/modules/search/schema";
import type { SearchByFieldValue } from "@/modules/search/contexts/pageFilters";

/**
 * Logique **pure** et **agnostique de l'entité** des dropdownFilters de la
 * recherche (type de section `searchHeader`). Source unique réutilisée par le
 * header ET par les valeurs de facette cliquables des previews.
 *
 * Le lien « champ affiché → filtre » existe DÉJÀ en config : chaque filtre
 * déclare son `field` (le champ `serverData` qu'il indexe). On dérive donc le
 * filtre depuis le `field` plutôt que de coder en dur des `filterId` par site.
 */

export type DropdownFilterConfig = NonNullable<SearchHeaderSectionProps["dropdownFilters"]>[number];
export type DropdownOptionConfig = DropdownFilterConfig["options"][number];

/** Contrat unique de clé `searchByFields` (écriture ET lecture). */
export function keyFor(filterId: string, optionId: string): string {
  return `${filterId}:${optionId}`;
}
export function splitKey(key: string): { filterId: string; optionId: string } | null {
  const i = key.indexOf(":");
  if (i < 0) return null;
  return { filterId: key.slice(0, i), optionId: key.slice(i + 1) };
}

/**
 * Normalisation déterministe (aucun matching substring ordonné) :
 * diacritiques + minuscules + suppression des caractères de parenthèses seuls
 * (garde le contenu : « Individuel(s) » → « individuels ») + variantes
 * d'apostrophe + espaces autour du `/`. Validé sur la taxonomie backend réelle.
 */
export function normalizeFilterValue(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques (marques combinantes)
    .toLowerCase()
    .replace(/[()]/g, "") // caractères de parenthèses seuls (garde le contenu)
    .replace(/[’ʼ‘`´]/g, "'") // variantes d'apostrophe → '
    .replace(/\s*\/\s*/g, "/") // espaces autour du slash
    .replace(/\s+/g, " ")
    .trim();
}

function labelText(label: DropdownOptionConfig["label"] | undefined): string {
  if (!label) return "";
  if (typeof label === "string") return label;
  const rec = label as Record<string, string | undefined>;
  return rec.fr ?? rec.en ?? "";
}

/**
 * Résout l'option d'un filtre pour une `value` affichée. Chaîne déterministe :
 * id exact → value normalisée → label normalisé (fr/en). Pas de fallback
 * substring (élimine les faux positifs ordre-dépendants).
 */
export function resolveDropdownOption(
  filter: DropdownFilterConfig,
  value: string,
): DropdownOptionConfig | null {
  const options = filter.options ?? [];
  const byId = options.find((o) => o.id === value);
  if (byId) return byId;

  const n = normalizeFilterValue(value);
  const byValue = options.find((o) => o.value != null && normalizeFilterValue(o.value) === n);
  if (byValue) return byValue;

  const byLabel = options.find((o) => normalizeFilterValue(labelText(o.label)) === n);
  return byLabel ?? null;
}

/** Tous les dropdownFilters de toutes les pages (via les sections `searchHeader`). */
export function getAllDropdownFilters(
  config: SiteConfig,
): Array<{ pathname: string; filter: DropdownFilterConfig }> {
  const out: Array<{ pathname: string; filter: DropdownFilterConfig }> = [];
  for (const page of config.pages ?? []) {
    for (const section of page.sections ?? []) {
      if (section.type === "searchHeader") {
        for (const filter of section.props.dropdownFilters ?? []) {
          out.push({ pathname: page.path, filter });
        }
      }
    }
  }
  return out;
}

/**
 * Page propriétaire + définition d'un filtre par son id. `preferPathname`
 * privilégie la page courante ; sinon premier déclaré (déterministe).
 */
export function getDropdownFilterOwner(
  config: SiteConfig,
  filterId: string,
  preferPathname?: string,
): { pathname: string; filter: DropdownFilterConfig } | null {
  const matches = getAllDropdownFilters(config).filter((e) => e.filter.id === filterId);
  if (matches.length === 0) return null;
  if (preferPathname) {
    const onPage = matches.find((e) => e.pathname === preferPathname);
    if (onPage) return onPage;
  }
  return matches[0];
}

/** Idem mais par `field` `serverData` (dérivation champ → filtre). */
export function findFilterByField(
  config: SiteConfig,
  field: string,
  preferPathname?: string,
): { pathname: string; filter: DropdownFilterConfig } | null {
  const matches = getAllDropdownFilters(config).filter((e) => e.filter.field === field);
  if (matches.length === 0) return null;
  if (preferPathname) {
    const onPage = matches.find((e) => e.pathname === preferPathname);
    if (onPage) return onPage;
  }
  return matches[0];
}

/** Miroir URL `?filterId=ids`. `optionIds` vide → suppression du param. */
export function dropdownFilterToParam(
  params: URLSearchParams,
  filter: DropdownFilterConfig,
  optionIds: string[],
): void {
  if (optionIds.length) params.set(filter.id, optionIds.join(","));
  else params.delete(filter.id);
}

type SelectedUpdater = (prev: Record<string, string[]>) => Record<string, string[]>;
type SearchByFieldsUpdater = (
  prev: Record<string, SearchByFieldValue>,
) => Record<string, SearchByFieldValue>;

/**
 * Écrit l'état `PageFilters` correspondant, sémantique **REPLACE** (comme
 * `SearchHeaderSection.setDropdownSelection`) : la branche `field` nettoie
 * d'abord toutes les clés `${filterId}:*` (pas d'accumulation avec un multiple
 * déjà coché), résout le field par option (`option.field ?? filter.field`) ;
 * `optionIds` vide → suppression. Branche non-`field` → `selectedFilters`.
 */
export function dropdownFilterToState(
  setSelectedFilters: (updater: SelectedUpdater) => void,
  setSearchByFields: (updater: SearchByFieldsUpdater) => void,
  filter: DropdownFilterConfig,
  optionIds: string[],
): void {
  if (filter.field) {
    const fieldName = filter.field;
    setSearchByFields((prev) => {
      const prefix = `${filter.id}:`;
      const cleaned = Object.fromEntries(
        Object.entries(prev).filter(([key]) => !key.startsWith(prefix)),
      );
      if (!optionIds.length) return cleaned;
      const next = { ...cleaned };
      for (const id of optionIds) {
        const option = (filter.options ?? []).find((o) => o.id === id);
        if (!option) continue;
        next[keyFor(filter.id, id)] = {
          field: option.field ?? fieldName,
          value: [option.value ?? option.id],
        };
      }
      return next;
    });
  } else {
    setSelectedFilters((prev) => {
      const next = { ...prev };
      if (!optionIds.length) {
        delete next[filter.id];
        return next;
      }
      next[filter.id] = optionIds;
      return next;
    });
  }
}

/** Lit une valeur `serverData` par chemin (dot-path, ex. `address.postalCode`). */
export function resolveServerDataPath(
  serverData: Record<string, unknown> | undefined,
  path: string,
): unknown {
  if (!serverData) return undefined;
  return path
    .split(".")
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], serverData);
}

/**
 * Tokens affichables/filtrables d'une valeur de champ : tableau → strings,
 * chaîne « a, b » → ["a","b"] (multi-valeurs), number/boolean → [String].
 * Agnostique : gère aussi bien les champs `coerce:stringArray` que les chaînes.
 */
export function toFacetTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter((v) => v.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  return [];
}
