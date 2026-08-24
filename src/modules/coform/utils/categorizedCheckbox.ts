import type {
  CategorizedCheckboxChild,
  CategorizedCheckboxConfig,
  CategorizedCheckboxOption,
  CategorizedCheckboxValue,
  CommonTableCatalog,
} from "../types";
import { buildOptionKey, optionKeySlug } from "./slugify";
import { buildUsageGroupKeyResolver } from "./commonTableUsage";

/**
 * Helpers PURS du champ `categorizedCheckbox` : construction de l'arbre d'options et résolution
 * des clés persistées. Aucun React ici — c'est la partie testable contre les données réelles.
 *
 * ## Ce qui est persisté
 *
 * Une réponse vaut `{ list: ["<i>_<slug>"], sublist: { "<i>_<slug>": ["<j>_<slug>"] } }`.
 * L'index fait PARTIE de la clé : il vient de la position de l'option dans sa liste, avant toute
 * déduplication. Cette dérivation est partagée avec le template legacy
 * (`categorizedCheckbox.php:470`, `:492`) ET avec l'agrégateur backend (`Aap.php:2102`, `:2115`,
 * `:2150`, `:2173`). C'est pourquoi la déduplication d'affichage ci-dessous ne réindexe RIEN.
 *
 * ## Pourquoi la lecture est tolérante
 *
 * L'index rend la clé fragile : renommer une question ou en insérer une avant les autres change
 * les clés de toutes les suivantes, sans toucher aux réponses déjà écrites. Mesuré sur le
 * formulaire « Les communs des CAEs » : 2 des 9 réponses portent des clés qui ne se dérivent plus
 * (`0_gestion`, de l'époque où la liste était manuelle ; `4_autres-outils-de-la-cae`, dont la
 * question a été renommée). D'où `resolveStoredKey` : exact, puis repli sur le slug seul, puis
 * conservation de la valeur brute — une réponse n'est jamais silencieusement perdue.
 */

/** `dataSourceToUse` autorise-t-il les options saisies à la main ? */
export function usesManualSource(config: Pick<CategorizedCheckboxConfig, "dataSourceToUse">): boolean {
  return config.dataSourceToUse !== "distanceOnly";
}

/** `dataSourceToUse` autorise-t-il les options venues d'un commonTable distant ? */
export function usesRemoteSource(config: Pick<CategorizedCheckboxConfig, "dataSourceToUse">): boolean {
  return config.dataSourceToUse !== "manual";
}

/** Découpe une entrée `questionsParamsSource` (`<formId>-<stepId…>-<inputKey>`). */
export function parseQuestionPath(path: string): { formId: string; inputKey: string } | null {
  const parts = String(path).split("-");
  if (parts.length < 2) return null;
  const formId = parts[0];
  const inputKey = parts[parts.length - 1];
  if (!formId || !inputKey) return null;
  return { formId, inputKey };
}

/**
 * Catégories issues de la liste manuelle. L'index est la position dans `config.list`, telle quelle.
 */
export function buildManualOptions(config: CategorizedCheckboxConfig): CategorizedCheckboxOption[] {
  if (!usesManualSource(config)) return [];
  return config.list.map((label, index) => {
    const key = buildOptionKey(index, label);
    const children = (config.sublist[key] ?? []).map((subLabel, subIndex) => ({
      key: buildOptionKey(subIndex, subLabel),
      label: String(subLabel),
    }));
    return { key, label: String(label), children, fromSource: false };
  });
}

/**
 * Sous-options d'une question commonTable : une par criteria, libellée par son `usage`.
 *
 * Les doublons sont MASQUÉS mais pas supprimés de l'indexation : on parcourt le catalogue dans son
 * ordre naturel, on attribue à chacun son index, et on n'émet que la première occurrence de chaque
 * groupe d'usage. Une entrée masquée « brûle » donc son index — c'est voulu, c'est ce qui garde la
 * parité avec les clés déjà en base et avec `Aap.php:2173`.
 *
 * En cas de doublon, on garde l'occurrence la plus renseignée (`count` le plus élevé) comme
 * libellé affiché, tout en conservant l'index de la PREMIÈRE : le catalogue legacy porte souvent
 * une entrée orpheline (count 0) à côté de l'entrée réellement utilisée.
 */
export function buildChildrenFromCatalog(catalog: CommonTableCatalog): CategorizedCheckboxChild[] {
  const entries = Object.values(catalog);
  const resolveGroupKey = buildUsageGroupKeyResolver([entries]);

  const byGroup = new Map<string, CategorizedCheckboxChild>();
  const order: string[] = [];

  entries.forEach((entry, index) => {
    const group = resolveGroupKey(entry.usageKey, entry.usage);
    const label = String(entry.usage ?? "").trim();
    const count = typeof entry.count === "number" ? entry.count : 0;
    const existing = byGroup.get(group);
    if (!existing) {
      // Index de la PREMIÈRE occurrence → c'est lui qui part dans la clé persistée.
      byGroup.set(group, { key: buildOptionKey(index, label), label, count });
      order.push(group);
      return;
    }
    // Doublon : on ne réindexe pas, on enrichit seulement l'affichage.
    existing.count = (existing.count ?? 0) + count;
    if (count > 0 && !existing.label) existing.label = label;
  });

  // Une entrée sans libellé d'usage n'a rien à afficher — mais elle a bien consommé son index.
  return order
    .map((g) => byGroup.get(g))
    .filter((c): c is CategorizedCheckboxChild => !!c && c.label !== "");
}

/**
 * Assemble l'arbre complet. `startIndex` des options distantes = nombre d'options manuelles déjà
 * posées : le legacy amorce son compteur sur les éléments déjà rendus
 * (`categorizedCheckbox.php:465`), et `Aap.php:2141` recompte de la même façon.
 *
 * `remote` est ordonné comme `questionsParamsSource` — cet ordre EST l'indexation.
 */
export function buildCategorizedOptions(
  config: CategorizedCheckboxConfig,
  remote: Array<{ label: string; catalog: CommonTableCatalog }>,
): CategorizedCheckboxOption[] {
  const manual = buildManualOptions(config);
  if (!usesRemoteSource(config)) return manual;

  const startIndex = manual.length;
  const distant = remote.map((question, i) => ({
    key: buildOptionKey(startIndex + i, question.label),
    label: question.label,
    children: buildChildrenFromCatalog(question.catalog),
    fromSource: true,
  }));

  return [...manual, ...distant];
}

/**
 * Retrouve l'option correspondant à une clé STOCKÉE.
 *
 * 1. correspondance exacte ;
 * 2. sinon même slug à un index près — l'option a été déplacée (question insérée avant, liste
 *    réordonnée) ou le catalogue distant s'énumère dans un ordre légèrement différent de celui du
 *    legacy (`getformcatalogs` ajoute les criteriaId vus seulement dans `yesOrNo`) ;
 * 3. sinon `undefined` — à l'appelant d'afficher la valeur brute plutôt que de l'escamoter.
 */
export function resolveStoredKey<T extends { key: string }>(
  stored: string,
  options: readonly T[],
): T | undefined {
  const exact = options.find((o) => o.key === stored);
  if (exact) return exact;
  const slug = optionKeySlug(stored);
  if (!slug) return undefined;
  return options.find((o) => optionKeySlug(o.key) === slug);
}

/** Valeur vide canonique — jamais `undefined`, pour que le champ reste contrôlé. */
export function emptyCategorizedValue(): CategorizedCheckboxValue {
  return { list: [], sublist: {} };
}

/** Normalise une valeur venue de la base (clés absentes, `null`, formes legacy dégradées). */
export function normalizeCategorizedValue(raw: unknown): CategorizedCheckboxValue {
  if (!raw || typeof raw !== "object") return emptyCategorizedValue();
  const v = raw as Partial<CategorizedCheckboxValue>;
  const list = Array.isArray(v.list) ? v.list.map(String).filter(Boolean) : [];
  const sublist: Record<string, string[]> = {};
  if (v.sublist && typeof v.sublist === "object") {
    for (const [k, arr] of Object.entries(v.sublist)) {
      if (Array.isArray(arr)) sublist[k] = arr.map(String).filter(Boolean);
    }
  }
  return { list, sublist };
}

/**
 * Coche/décoche une catégorie. Décocher purge ses sous-options : le legacy laissait la sous-liste
 * en base après avoir décoché le parent, ce qui ressuscitait des sous-options au re-cochage.
 */
export function toggleCategory(
  value: CategorizedCheckboxValue,
  key: string,
  checked: boolean,
): CategorizedCheckboxValue {
  if (checked) {
    if (value.list.includes(key)) return value;
    return { ...value, list: [...value.list, key] };
  }
  const { [key]: _removed, ...sublist } = value.sublist;
  return { list: value.list.filter((k) => k !== key), sublist };
}

/**
 * Coche/décoche une sous-option. Reprend les deux automatismes du legacy
 * (`categorizedCheckbox.php:680` et `:702`) : cocher une sous-option coche son parent, et décocher
 * la dernière sous-option décoche le parent.
 */
export function toggleChild(
  value: CategorizedCheckboxValue,
  parentKey: string,
  childKey: string,
  checked: boolean,
): CategorizedCheckboxValue {
  const current = value.sublist[parentKey] ?? [];
  if (checked) {
    const next = current.includes(childKey) ? current : [...current, childKey];
    return {
      list: value.list.includes(parentKey) ? value.list : [...value.list, parentKey],
      sublist: { ...value.sublist, [parentKey]: next },
    };
  }
  const next = current.filter((k) => k !== childKey);
  if (next.length === 0) {
    const { [parentKey]: _removed, ...sublist } = value.sublist;
    return { list: value.list.filter((k) => k !== parentKey), sublist };
  }
  return { ...value, sublist: { ...value.sublist, [parentKey]: next } };
}
