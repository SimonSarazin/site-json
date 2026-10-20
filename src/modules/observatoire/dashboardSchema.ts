// ------------------------------------------------------------
// dashboardSchema.ts — primitives déclaratives du tableau de bord
// ------------------------------------------------------------
// Dimensions, KPI et graphes : le VOCABULAIRE du dashboard, sans rien
// connaître ni de la section `data-observatory`, ni du module search.
//
// POURQUOI un fichier à part, alors que la convention du dépôt est « tous les
// types du module dans schema.ts » : `schema.ts` importe le module search
// (PreviewConfSchema, SearchVariantSchema) pour sa section. Depuis que
// `searchProStatic` peut afficher un tableau de bord dans sa propre section
// (`props.observatory`), search a besoin de ces primitives — un import direct
// de `schema.ts` fermerait le cycle search ↔ observatoire, et Zod, évalué au
// chargement du module, y lirait des `undefined`. Ce fichier n'importe QUE zod
// et le schéma de libellé localisé : il se laisse importer des deux côtés.
//
// `schema.ts` le ré-exporte intégralement — les imports existants
// (`from "../schema"`) restent valides.
// ------------------------------------------------------------
import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

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
  /** Chaînes de priorité : le premier chemin non vide gagne. Chemins pointés
   *  acceptés (ex. "address.addressLocality") et ARRAY-AWARE : un segment
   *  tombant sur un tableau (sans index numérique) mappe le reste du chemin sur
   *  chaque élément puis aplatit — une réponse CoForm embarquée se lit ainsi
   *  par un simple chemin `answers.<form>.serverData.answers.<section>.<field>`
   *  (cf. resolveSegments, dimensions.ts), sans accesseur métier dédié. */
  paths: z.array(z.string()).min(1),
  /** REGROUPEMENT sur clé canonique (kind `value`) : quand un libellé affiché
   *  (`paths`, ex. `address.level4Name`) est du texte libre SALE (variantes de
   *  casse/accents : "NORD"/"Nord", "ISERE"/"Isère"…), `keyPaths` désigne une
   *  clé propre et stable (ex. `address.level4`, l'id de zone). Le moteur
   *  regroupe les items par cette clé et, comme TOUTES les données sont chargées,
   *  DÉRIVE un libellé canonique par groupe (la variante la plus « riche » :
   *  casse mixte + accents). Filtre/KPI/graphe/table voient alors une valeur
   *  unique par groupe — fini les doublons. Sans `keyPaths` : comportement
   *  normal (la valeur affichée EST la clé). */
  keyPaths: z.array(z.string()).min(1).optional(),
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
export const ColorTokenSchema = z.enum([
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

/*───────────────────────────────────────────────────────────────*/
/* 3. Panneau réutilisable — le dashboard SANS sa page           */
/*───────────────────────────────────────────────────────────────*/
/**
 * Contrat d'un tableau de bord EMBARQUÉ dans une autre section : les
 * dimensions à lire, les KPI et les graphes à en tirer. Rien d'autre — ni
 * périmètre de données (l'hôte apporte les siennes, déjà chargées et déjà
 * filtrées), ni filtres, ni table : ce qui reste est exactement ce qu'on peut
 * poser à côté d'une carte.
 *
 * Consommé par `ObservatoryPanel` (rendu) et par `searchProStatic.observatory`
 * (config). La section `data-observatory` garde sa propre déclaration, plus
 * large : elle possède ses données.
 */
export const ObservatoryPanelConfSchema = z.object({
  /** Dimensions lues sur chaque item — même vocabulaire que la section. */
  dimensions: DimensionsSchema,
  /** Chiffres de synthèse, en bandeau au-dessus des graphes. */
  kpis: z.array(KpiDefSchema).optional(),
  charts: z.array(ChartDefSchema).optional(),
  /** Densité des KPI : `cards` (défaut) ou `inline` (repères discrets). */
  kpiLayout: z.enum(["cards", "inline"]).optional(),
  /** Libellé du bouton de bascule (défaut : i18n « Observatoire »). */
  label: LocalizedString.optional(),
  /**
   * SÉLECTION par clic sur un item de la liste — le pendant embarqué de
   * `list.selectDimensions` de la section. Déclaré, le clic sur une carte
   * RESTREINT le tableau de bord à sa famille (et un bouton « Fiche » prend en
   * charge l'ouverture du détail) ; absent, le clic ouvre la fiche comme
   * partout ailleurs. Effectif seulement avec une carte qui rend ce bouton
   * (`poi-amenities`) en vue grille : avec un autre variant, le clic garde
   * l'ouverture de la fiche (sinon elle deviendrait inaccessible).
   */
  select: z
    .object({
      /** Dimension qui donne le libellé de la sélection (ex. le nom de l'équipement). */
      titleDimension: z.string(),
      /** Dimensions où chercher les MOTS de ce libellé. Défaut : `titleDimension`
       *  seule. En déclarer plusieurs ÉLARGIT le résultat — les mots sont
       *  cherchés dans leur réunion (ex. équipement ET installation). */
      dimensions: z.array(z.string()).optional(),
    })
    .optional(),
  /** Clic sur une part ou une barre → restreint le tableau de bord à cette
   *  valeur (retirable). Sans filtres affichés à côté, c'est le seul moyen
   *  d'entrer dans un graphe — d'où l'opt-in explicite. */
  drilldown: z.boolean().optional(),
});
export type ObservatoryPanelConf = z.infer<typeof ObservatoryPanelConfSchema>;
