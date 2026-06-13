// ------------------------------------------------------------
// schema.ts — Observatoire de données (dashboard déclaratif)
// ------------------------------------------------------------
// Tous les types (Zod + TS) du module vivent ici. AUCUN modèle métier en
// dur : le dataset, les dimensions, les KPI, les graphes, les filtres et la
// table viennent de la CONFIG de section. Convention calquée sur
// src/modules/search/schema.ts.
// ------------------------------------------------------------
import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";
import { PreviewConfSchema, SearchVariantSchema } from "@/modules/search/schema";

/*───────────────────────────────────────────────────────────────*/
/* 1. Item — document brut                                       */
/*───────────────────────────────────────────────────────────────*/
/**
 * Item du dashboard : le document `serverData` BRUT d'une entité. Aucun
 * schéma métier : la lecture et la coercion (bool tolérant, nombres,
 * dates SDK) se font au moment de résoudre une DIMENSION (moteur,
 * dimensions.ts) — seuls les champs déclarés sont consommés.
 */
export type ObservatoryItem = Record<string, unknown>;

/*───────────────────────────────────────────────────────────────*/
/* 2. Dimensions — cœur déclaratif du module                     */
/*───────────────────────────────────────────────────────────────*/
// Une « dimension » = une grandeur lisible sur chaque item (commune, type,
// accessibilité…). Filtres, KPI, graphes et colonnes de table ne font que
// CONSOMMER des dimensions — c'est ce qui rend le module entièrement
// pilotable par la config (mécanisme dans le composant, données dans la
// config) : le code ne connaît AUCUN dataset particulier.
export const DimensionDefSchema = z.object({
  /** Chaînes de priorité : le premier chemin non vide gagne (chemins pointés
   *  acceptés, ex. "address.addressLocality"). */
  paths: z.array(z.string()).min(1),
  /** value (défaut) : 1ʳᵉ chaîne non vide · list : CSV/tableau aplati ·
   *  anyTrue : au moins un des chemins est vrai · number : 1ʳᵉ valeur numérique ·
   *  contains : un chemin (liste) contient `value` (booléen d'appartenance). */
  kind: z.enum(["value", "list", "anyTrue", "number", "contains"]).optional(),
  /** `list` : restreint ET ordonne la sortie à cet ALLOWLIST — décompose un
   *  champ fourre-tout (ex. `tags` qui mêle typologie/portage/surface) en axes
   *  orthogonaux distincts. */
  values: z.array(z.string()).optional(),
  /** `contains` : valeur dont l'appartenance à la liste fait le booléen
   *  (ex. label "Compagnon France Tiers-Lieux"). */
  value: z.string().optional(),
  /** Normalisation des valeurs brutes → valeur canonique (avant allowlist) :
   *  fusionne les variantes saisies à la main du backend (ex.
   *  "Plus de 200m2" → "Plus de 200m²", "Switzerland" → "Suisse"). S'applique
   *  aux kinds `value` et `list`. */
  valueMap: z.record(z.string(), z.string()).optional(),
  /** Libellé localisé (prioritaire sur labelKey). */
  label: LocalizedString.optional(),
  /** Clé i18n du namespace modules/observatoire (réservé au chrome interne
   *  du module — les libellés métier passent par `label`). */
  labelKey: z.string().optional(),
});
export type DimensionDef = z.infer<typeof DimensionDefSchema>;

export const DimensionsSchema = z.record(z.string(), DimensionDefSchema);
export type DimensionsConfig = z.infer<typeof DimensionsSchema>;

// Jeton de couleur de thème (jamais d'hex : les rendus mappent vers les
// classes/var(--…) correspondantes — les graphes suivent le thème du site).
const ColorTokenSchema = z.enum([
  "primary", "accent", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "muted",
]);

/** KPI déclaratif : une FORME de calcul appliquée à une dimension. */
export const KpiDefSchema = z.object({
  kind: z.enum(["count", "distinct", "percentTrue", "valueSplit", "top", "sum", "avg"]),
  /** Dimension consommée (requise sauf pour `count`). */
  dimension: z.string().optional(),
  /** `valueSplit` : valeur comptée (affiché « n / total−n »). */
  value: z.string().optional(),
  label: LocalizedString.optional(),
  labelKey: z.string().optional(),
  /** Nom d'icône lucide (kebab-case) — rendu via DynamicIcon. */
  icon: z.string().optional(),
  accent: ColorTokenSchema.optional(),
  /** Unité affichée après la valeur (`sum`/`avg` — ex. "m²"). */
  unit: z.string().optional(),
});
export type KpiDef = z.infer<typeof KpiDefSchema>;

/** Graphe déclaratif : une FORME de visualisation d'une dimension. */
export const ChartDefSchema = z.object({
  kind: z.enum(["donut", "pie", "bars", "barsHorizontal", "booleanGroups"]),
  dimension: z.string().optional(),
  /** `booleanGroups` : dimensions anyTrue comparées (oui/non empilés). */
  dimensions: z.array(z.string()).optional(),
  /** `barsHorizontal` : nombre de valeurs retenues (tri décroissant). */
  top: z.number().int().positive().optional(),
  label: LocalizedString.optional(),
  labelKey: z.string().optional(),
  /** Couleur par VALEUR de dimension (jeton de thème). */
  colors: z.record(z.string(), ColorTokenSchema).optional(),
  /** Largeur dans la grille : `full` (défaut) ou `half` (appairé 2 colonnes). */
  layout: z.enum(["full", "half"]).optional(),
});
export type ChartDef = z.infer<typeof ChartDefSchema>;

/** Colonne de table déclarative. */
export const TableColumnSchema = z.object({
  dimension: z.string(),
  /** text (défaut) · title (+ sous-titre) · badge (teinté par valeur) ·
   *  boolBadge (oui/non) · number (+ unité). */
  kind: z.enum(["text", "title", "badge", "boolBadge", "number"]).optional(),
  unit: z.string().optional(),
  subtitleDimension: z.string().optional(),
  colors: z.record(z.string(), ColorTokenSchema).optional(),
  label: LocalizedString.optional(),
  labelKey: z.string().optional(),
});
export type TableColumnDef = z.infer<typeof TableColumnSchema>;

/** Déclaration d'un filtre (forme riche) — la forme courte est l'id seul. */
export const FilterDefSchema = z.object({
  dimension: z.string(),
  /** Sélection MULTIPLE (badges + recherche intégrée). Valeurs jointes par
   *  virgule dans l'URL (?id=v1,v2 — format maison des sidebars ; d'où la
   *  règle « pas de virgule dans une valeur »). Ignoré pour les dimensions
   *  anyTrue (oui/non). */
  multiple: z.boolean().optional(),
  /** Select avec recherche dans les options (combobox) — toujours actif en
   *  multiple (le composant multi-sélection cherche nativement). */
  searchable: z.boolean().optional(),
});
export type FilterDef = z.infer<typeof FilterDefSchema>;

export const TableDefSchema = z.object({
  columns: z.array(TableColumnSchema).min(1),
  /** Dimension du tri initial (défaut : la 1ʳᵉ colonne). */
  defaultSort: z.string().optional(),
  /** Action au clic sur une ligne — CHOIX déclaratif :
   *  - "profil"  : navigation vers /profil/<slug>
   *  - "preview" : ouvre le détail du module search (drawer/dialog + preview),
   *    le comportement de la liste /equipements-sportifs au clic sur une carte. */
  rowAction: z
    .object({
      kind: z.enum(["profil", "preview"]),
      /** preview : conteneur du détail (défaut "drawer"). */
      detailsMode: z.enum(["drawer", "dialog"]).optional(),
      /** preview : contenu (schéma du module search — poi-amenities…). */
      preview: PreviewConfSchema.optional(),
    })
    .optional(),
});
export type TableDef = z.infer<typeof TableDefSchema>;

/*───────────────────────────────────────────────────────────────*/
/* 3. Filtres — valeurs dynamiques (clé = id de dimension)       */
/*───────────────────────────────────────────────────────────────*/
export type FilterValues = Record<string, string>;

export const EMPTY_FILTERS: FilterValues = {};

/*───────────────────────────────────────────────────────────────*/
/* 4. baseParams (sous-ensemble compatible useSearchQuery)       */
/*───────────────────────────────────────────────────────────────*/
const ObservatoryBaseParamsSchema = z
  .object({
    indexStepList: z.number().optional(),
    defaultTypes: z.array(z.string()).optional(),
    defaultFields: z.array(z.string()).optional(),
    defaultFilters: z.record(z.string(), z.unknown()).optional(),
    defaultSortBy: z
      .record(z.string(), z.union([z.literal(1), z.literal(-1)]))
      .optional(),
    notSourceKey: z.boolean().optional(),
    // Variant SDK de `searchCostum` (ex. "navigator-tl") — DOIT correspondre à
    // celui des sections search du même costum, sinon l'observatoire interroge
    // un endpoint/projection différents. Inclus dans la queryKey (isole le
    // cache) et propagé au prefetch SSR. Même enum que les sections search.
    variant: SearchVariantSchema.optional(),
    // Plafond de résultats chargés (sécurité « charger tout ») — défaut :
    // SEARCH_ALL_DEFAULT_MAX_RESULTS (5000) du hook générique.
    maxResults: z.number().int().positive().optional(),
  })
  .optional();

/*───────────────────────────────────────────────────────────────*/
/* 5. Section schema                                             */
/*───────────────────────────────────────────────────────────────*/
export const DataObservatorySectionSchema = z.object({
  type: z.literal("data-observatory"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString.optional(),
    description: LocalizedString.optional(),
    baseParams: ObservatoryBaseParamsSchema,
    // Déclaration des dimensions du dataset — REQUIS pour qu'un dashboard
    // affiche quelque chose : le code ne porte aucun modèle métier.
    dimensions: DimensionsSchema.optional(),
    // Dimensions filtrables (ordre = ordre d'affichage) : id simple OU forme
    // riche {dimension, multiple, searchable}. Les valeurs sélectionnées sont
    // synchronisées dans l'URL (?<id>=<valeur> ; multi : ?<id>=v1,v2).
    filters: z.array(z.union([z.string(), FilterDefSchema])).optional(),
    // Recherche TEXTE optionnelle (présence du bloc = activée) : matching
    // client insensible casse/accents sur les dimensions listées (défaut :
    // toutes les dimensions value/list). Synchronisée dans l'URL (?q=…).
    search: z
      .object({
        dimensions: z.array(z.string()).optional(),
        placeholder: LocalizedString.optional(),
      })
      .optional(),
    // Export CSV du résultat FILTRÉ (présence du bloc = bouton affiché).
    export: z.object({ filename: z.string().optional() }).optional(),
    // Clic sur une part/barre de graphe → applique le filtre correspondant
    // (seulement pour les dimensions présentes dans `filters`).
    drilldown: z.boolean().optional(),
    // Tableau de bord déclaratif : chaque entrée référence des dimensions.
    kpis: z.array(KpiDefSchema).optional(),
    charts: z.array(ChartDefSchema).optional(),
    table: TableDefSchema.optional(),
  }),
});

export type DataObservatorySection = z.infer<
  typeof DataObservatorySectionSchema
>;
export type DataObservatorySectionProps = z.infer<
  typeof DataObservatorySectionSchema
>["props"];
