// ------------------------------------------------------------
// schema.ts — Observatoire Équipements Sportifs (RES)
// ------------------------------------------------------------
// Tous les types (Zod + TS) pour la page Observatoire vivent ici.
// Convention calquée sur src/modules/search/schema.ts.
// ------------------------------------------------------------
import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

/*───────────────────────────────────────────────────────────────*/
/* 1. Champs PMR / PSHS — listes immuables                       */
/*───────────────────────────────────────────────────────────────*/
export const PMR_FIELDS = [
  "equip_pmr_acc",
  "equip_pmr_chem",
  "equip_pmr_douche",
  "equip_pmr_sanit",
  "equip_pmr_vest",
  "equip_pmr_trib",
] as const;

export const PSHS_FIELDS = [
  "equip_pshs_aire",
  "equip_pshs_chem",
  "equip_pshs_sanit",
  "equip_pshs_vest",
  "equip_pshs_trib",
  "equip_pshs_sign",
] as const;

export type PmrField = (typeof PMR_FIELDS)[number];
export type PshsField = (typeof PSHS_FIELDS)[number];

/*───────────────────────────────────────────────────────────────*/
/* 2. Equipment — modèle métier RES                              */
/*───────────────────────────────────────────────────────────────*/
// Valeur booléenne tolérante : l'API peut retourner true/false, "true"/"false",
// "Oui"/"Non", "1"/"0", null, undefined…
const BoolLike = z
  .union([z.boolean(), z.string(), z.number(), z.null()])
  .optional();

// Champ pouvant être une chaîne ou un tableau de chaînes (prod vs local)
const StringOrArray = z
  .union([z.string(), z.array(z.string())])
  .optional();

// Dates : le SDK désérialise l'EJSON Mongo ({$date: …}) en objets Date dans
// serverData (BaseEntity._transformServerData) — c'est son contrat, le schéma
// doit l'attendre. L'union garde string pour d'éventuelles données legacy
// stockées en chaîne. Sans ça : 418 équipements silencieusement rejetés au
// parse (constaté en réel sur ces trois champs).
const DateLike = z.union([z.string(), z.date()]).optional();

const PoiAddressSchema = z
  .object({
    streetAddress: z.string().optional(),
    postalCode: z.string().optional(),
    addressLocality: z.string().optional(),
    addressCountry: z.string().optional(),
    level1Name: z.string().optional(),
    level4Name: z.string().optional(),
    level5Name: z.string().optional(),
  })
  .partial()
  .passthrough();

const PoiGeoSchema = z
  .object({
    latitude: z.union([z.number(), z.string()]).optional(),
    longitude: z.union([z.number(), z.string()]).optional(),
  })
  .partial()
  .passthrough();

export const EquipmentSchema = z
  .object({
    // Identifiants / nom
    equip_numero: z.string().optional(),
    equip_nom: z.string().optional(),
    inst_nom: z.string().optional(),

    // Types
    equip_type_name: z.string().optional(),
    equip_type_famille: z.string().optional(),
    categorie: z.string().optional(),
    type: z.string().optional(),
    nature: z.string().optional(),
    equip_nature: z.string().optional(),

    // Adresse
    address: PoiAddressSchema.optional(),

    // Données techniques
    equip_sol: z.string().optional(),
    equip_surf: z.union([z.number(), z.string()]).optional(),
    equip_larg: z.union([z.number(), z.string()]).optional(),
    equip_long: z.union([z.number(), z.string()]).optional(),
    equip_eclair: BoolLike,
    equip_acc_libre: BoolLike,
    equip_douche: BoolLike,

    // Sports
    aps_name: z.union([z.string(), z.array(z.string())]).optional(),

    // Accessibilité globale
    inst_acc_handi_bool: BoolLike,
    inst_acc_handi_type: StringOrArray,
    inst_trans_bool: BoolLike,
    inst_trans_type: StringOrArray,

    // Accessibilité PMR (6 champs)
    equip_pmr_acc: BoolLike,
    equip_pmr_chem: BoolLike,
    equip_pmr_douche: BoolLike,
    equip_pmr_sanit: BoolLike,
    equip_pmr_vest: BoolLike,
    equip_pmr_trib: BoolLike,

    // Accessibilité PSHS (6 champs)
    equip_pshs_aire: BoolLike,
    equip_pshs_chem: BoolLike,
    equip_pshs_sanit: BoolLike,
    equip_pshs_vest: BoolLike,
    equip_pshs_trib: BoolLike,
    equip_pshs_sign: BoolLike,

    // Propriété / partenariat
    inst_part_bool: BoolLike,
    inst_part_type: StringOrArray,
    equip_prop_nom: z.string().optional(),
    equip_prop_type: StringOrArray,
    equip_gest_type: StringOrArray,
    equip_loc_type: StringOrArray,
    equip_utilisateur: StringOrArray,

    // Dates
    inst_date_creation: DateLike,
    inst_enqu_date: DateLike,
    equip_maj_date: DateLike,

    // Géo
    equip_x: z.union([z.number(), z.string()]).optional(),
    equip_y: z.union([z.number(), z.string()]).optional(),
    geo: PoiGeoSchema.optional(),
  })
  .passthrough();

export type Equipment = z.infer<typeof EquipmentSchema>;

/*───────────────────────────────────────────────────────────────*/
/* 2bis. Dimensions — cœur déclaratif du module                  */
/*───────────────────────────────────────────────────────────────*/
// Une « dimension » = une grandeur lisible sur chaque item (commune, type,
// accessibilité…). Filtres, KPI, graphes et colonnes de table ne font que
// CONSOMMER des dimensions — c'est ce qui rend le module pilotable par la
// config (mécanisme dans le composant, données dans la config). Le preset
// RES (`RES_DIMENSIONS`, dimensions.ts) sert de défaut : un site peut le
// surcharger dimension par dimension, ou déclarer les siennes.
export const DimensionDefSchema = z.object({
  /** Chaînes de priorité : le premier chemin non vide gagne (chemins pointés
   *  acceptés, ex. "address.addressLocality"). */
  paths: z.array(z.string()).min(1),
  /** value (défaut) : 1ʳᵉ chaîne non vide · list : CSV/tableau aplati ·
   *  anyTrue : au moins un des chemins est vrai · number : 1ʳᵉ valeur numérique. */
  kind: z.enum(["value", "list", "anyTrue", "number"]).optional(),
  /** Libellé localisé (prioritaire sur labelKey). */
  label: LocalizedString.optional(),
  /** Clé i18n du namespace modules/observatoire (utilisé par le preset RES
   *  pour pointer les libellés historiques, ex. "filters.owner"). */
  labelKey: z.string().optional(),
});
export type DimensionDef = z.infer<typeof DimensionDefSchema>;

export const DimensionsSchema = z.record(z.string(), DimensionDefSchema);
export type DimensionsConfig = z.infer<typeof DimensionsSchema>;

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
    // Plafond de résultats chargés (sécurité « charger tout ») — défaut :
    // SEARCH_ALL_DEFAULT_MAX_RESULTS (5000) du hook générique.
    maxResults: z.number().int().positive().optional(),
  })
  .optional();

/*───────────────────────────────────────────────────────────────*/
/* 5. Section schema                                             */
/*───────────────────────────────────────────────────────────────*/
export const EquipmentObservatorySectionSchema = z.object({
  type: z.literal("equipment-observatory"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString.optional(),
    description: LocalizedString.optional(),
    baseParams: ObservatoryBaseParamsSchema,
    // Surcharge PAR DIMENSION du preset RES (cf. dimensions.ts) — permet de
    // pointer d'autres champs sans toucher au code.
    dimensions: DimensionsSchema.optional(),
    // Ids des dimensions filtrables (ordre = ordre d'affichage).
    // Défaut : RES_FILTER_IDS. Les valeurs sélectionnées sont synchronisées
    // dans l'URL (?<id>=<valeur>) — permaliens, format maison sans virgule.
    filters: z.array(z.string()).optional(),
  }),
});

export type EquipmentObservatorySection = z.infer<
  typeof EquipmentObservatorySectionSchema
>;
export type EquipmentObservatorySectionProps = z.infer<
  typeof EquipmentObservatorySectionSchema
>["props"];
