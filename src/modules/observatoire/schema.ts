// ------------------------------------------------------------
// schema.ts — Observatoire de données (dashboard déclaratif)
// ------------------------------------------------------------
// Les types (Zod + TS) du module vivent ici — à l'exception des primitives du
// tableau de bord (dimensions, KPI, graphes), passées dans `dashboardSchema.ts`
// pour rester importables par le module search ; ce fichier les ré-exporte.
// AUCUN modèle métier en dur : le dataset, les dimensions, les KPI, les
// graphes, les filtres et la table viennent de la CONFIG de section.
// Convention calquée sur src/modules/search/schema.ts.
// ------------------------------------------------------------
import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";
import { PreviewConfSchema, SearchVariantSchema } from "@/modules/search/schema";

/*───────────────────────────────────────────────────────────────*/
/* 1-2. Item, dimensions, KPI, graphes                           */
/*───────────────────────────────────────────────────────────────*/
// Déplacés dans `dashboardSchema.ts` : le module search les importe pour son
// tableau de bord embarqué, et ce fichier-ci importe search (cf. l'en-tête de
// dashboardSchema.ts). Ré-exportés ici — `from "../schema"` reste la voie
// d'accès normale pour le module.
export * from "./dashboardSchema";
import {
  ChartDefSchema,
  ColorTokenSchema,
  DimensionDefSchema,
  DimensionsSchema,
  KpiDefSchema,
} from "./dashboardSchema";

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
  /** Id d'une dimension parente : quand une valeur est sélectionnée pour ce
   *  filtre parent, les options du filtre courant sont restreintes aux items
   *  correspondant à cette sélection (facette cascade opt-in). */
  dependsOn: z.string().optional(),
});
export type FilterDef = z.infer<typeof FilterDefSchema>;

/** Ouverture d'une FICHE depuis une ligne de table ou un item de liste —
 *  CHOIX déclaratif :
 *  - "profil"  : navigation vers /profil/<slug>
 *  - "preview" : ouvre le détail du module search (drawer/dialog + preview),
 *    le comportement de la liste /equipements-sportifs au clic sur une carte. */
export const RowActionSchema = z.object({
  kind: z.enum(["profil", "preview"]),
  /** preview : conteneur du détail (défaut "drawer"). */
  detailsMode: z.enum(["drawer", "dialog"]).optional(),
  /** preview : contenu (schéma du module search — poi-amenities…). */
  preview: PreviewConfSchema.optional(),
});
export type RowActionDef = z.infer<typeof RowActionSchema>;

export const TableDefSchema = z.object({
  columns: z.array(TableColumnSchema).min(1),
  /** Dimension du tri initial (défaut : la 1ʳᵉ colonne). */
  defaultSort: z.string().optional(),
  /** Cf. RowActionSchema. Repli de `props.rowAction` : une config antérieure au
   *  mode `split` déclare son action ICI, et continue de fonctionner. */
  rowAction: RowActionSchema.optional(),
});
export type TableDef = z.infer<typeof TableDefSchema>;

/**
 * Liste latérale du mode `layout: "split"` — l'équivalent « une ligne, un
 * item » de la table, pensé pour un panneau étroit : pas de colonnes, un
 * libellé, un sous-titre, un bouton fiche.
 */
export const ObservatoryListSchema = z.object({
  /** Dimension du libellé d'une ligne (ex. le nom de l'équipement). */
  titleDimension: z.string(),
  /** Dimensions du sous-titre, jointes par « · » (valeurs vides ignorées). */
  subtitleDimensions: z.array(z.string()).optional(),
  /**
   * Dimensions interrogées par la SÉLECTION (clic sur une ligne) : chaque MOT
   * du libellé cliqué doit s'y trouver. Défaut : `titleDimension` seule.
   * En déclarer plusieurs (ex. équipement ET installation) ÉLARGIT le
   * résultat — les mots sont cherchés dans leur réunion, pas dans chacune.
   */
  selectDimensions: z.array(z.string()).optional(),
  /** Titre du panneau (défaut : i18n `list.title`). */
  label: LocalizedString.optional(),
  /** Répartition liste / tableau de bord en `split` (défaut "40-60"). */
  splitRatio: z.enum(["40-60", "50-50", "60-40"]).optional(),
  /** Lignes rendues avant « Voir plus » (défaut 50). Sans virtualisation dans
   *  le parc, tout rendre d'un coup coûte trop cher au-delà de quelques
   *  centaines d'items. */
  pageSize: z.number().int().positive().optional(),
});
export type ObservatoryListDef = z.infer<typeof ObservatoryListSchema>;

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
    // Périmètre costum EXPLICITE. OMIS dans le cas courant : le SDK auto-scope alors au
    // porteur du site, que le serveur traduit en `$or[source.keys ∈, reference.costum ∈]`
    // — donc la data possédée ET la data seulement référencée. À renseigner uniquement pour
    // viser un AUTRE costum que le site courant. Sans effet si `notSourceKey` est présent.
    sourceKey: z.array(z.string()).optional(),
    // Arme le filtre de VALIDATION côté client (`applyValidationGate`, buildSearchPayload.ts:100-103).
    // Sans lui, un observatoire COMPTE les fiches en attente de validation là où les sections
    // search du même site les masquent : deux pages, deux totaux, aucun signal.
    costumSlug: z.string().optional(),
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
    // `fields` (optionnel) : colonnes d'export COMPLÈTES, indépendantes du
    // tableau affiché — chaque champ est une dimension (paths/kind/label)
    // résolue par le moteur. Permet d'exporter toutes les données de la fiche
    // détail, pas seulement les colonnes visibles. Absent → export des colonnes.
    export: z
      .object({
        filename: z.string().optional(),
        fields: z.array(DimensionDefSchema).optional(),
      })
      .optional(),
    // Clic sur une part/barre de graphe → applique le filtre correspondant
    // (seulement pour les dimensions présentes dans `filters`).
    drilldown: z.boolean().optional(),
    // Tableau de bord déclaratif : chaque entrée référence des dimensions.
    kpis: z.array(KpiDefSchema).optional(),
    /**
     * Densité des KPI. `cards` (défaut) pour une page d'observatoire, où le
     * tableau de bord est le sujet. `inline` pour poser deux ou trois repères
     * chiffrés sur une page dont le sujet est ailleurs — une accueil, par
     * exemple — sans y planter un tableau de bord.
     */
    kpiLayout: z.enum(["cards", "inline"]).optional(),
    /**
     * Largeur du conteneur. `8xl` (1440px, défaut) est la bonne mesure pour une
     * page dédiée : une table à colonnes multiples a besoin de place.
     *
     * Mais les autres sections du moteur s'arrêtent à `6xl` (1152px) — c'est la
     * largeur de `searchProStatic`, `features-glass`, `cta-card-grid`… Poser
     * l'observatoire à côté d'elles sur une même page décale donc le contenu de
     * 144 px par côté. Cette clé permet de l'aligner quand il n'est qu'un bloc
     * parmi d'autres, sans toucher aux pages où il est le sujet.
     */
    maxWidth: z.enum(["4xl", "5xl", "6xl", "7xl", "8xl", "full"]).optional(),
    charts: z.array(ChartDefSchema).optional(),
    table: TableDefSchema.optional(),
    /**
     * Agencement de la section. `stacked` (défaut) : filtres, KPI, graphes puis
     * table empilés — le rendu historique, inchangé. `split` : KPI en bandeau
     * pleine largeur sous les filtres, puis liste des items à GAUCHE et graphes
     * à DROITE, sur le patron du split liste+carte du module search (desktop
     * seulement — sous 768 px les deux colonnes sont illisibles, la liste
     * repasse alors SOUS les graphes, avant la table éventuelle). Une `table`
     * déclarée avec `split` vient SOUS les deux colonnes, en pleine largeur.
     * Demande `list`.
     */
    layout: z.enum(["stacked", "split"]).optional(),
    list: ObservatoryListSchema.optional(),
    /**
     * Ouverture de la fiche depuis la LISTE (le deep-link `?installation=` y
     * puise aussi sa config). Historiquement déclarée sous `table.rowAction` —
     * toujours lue en repli, donc une page qui remplace sa table par une liste
     * déplace simplement son bloc ici, sans rien dupliquer. La table, elle, ne
     * lit QUE `table.rowAction` : une page qui GARDE sa table y laisse le bloc.
     */
    rowAction: RowActionSchema.optional(),
  }),
});

export type DataObservatorySection = z.infer<
  typeof DataObservatorySectionSchema
>;
export type DataObservatorySectionProps = z.infer<
  typeof DataObservatorySectionSchema
>["props"];
