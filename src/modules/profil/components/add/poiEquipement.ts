/**
 * Constantes et helpers purs du formulaire "équipement sportif" (POI SSBE).
 * Extrait de `AddPoiEquipementModal` pour : (1) dédupliquer les valeurs métier
 * codées en dur (notamment l'ObjectId de l'org parente, présent à plusieurs
 * endroits), (2) rendre le mapping form↔entité testable isolément.
 */
import { format } from "date-fns";
import type { Poi } from "@communecter/cocolight-api-client";
import type { AddPoiFormData } from "../../schemaForm";

// ── Étapes du wizard ────────────────────────────────────────────────────────
export const STEP_ORDER = ["general", "legal", "structure", "usage"] as const;
export type StepKey = (typeof STEP_ORDER)[number];

/** Clés i18n des titres d'étape (namespace `modules/profil`). */
export const STEP_TITLE_KEYS: Record<StepKey, string> = {
  general: "AddPoiEquipement.steps.general",
  legal: "AddPoiEquipement.steps.legal",
  structure: "AddPoiEquipement.steps.structure",
  usage: "AddPoiEquipement.steps.usage",
};

/** Champs PSHS rendus en bloc : `name` = champ form, `labelKey` = clé i18n. */
export const PSHS_FIELDS = [
  { name: "equip_pshs_aire", labelKey: "AddPoiEquipement.pshs.aire" },
  { name: "equip_pshs_sanit", labelKey: "AddPoiEquipement.pshs.sanit" },
  { name: "equip_pshs_trib", labelKey: "AddPoiEquipement.pshs.trib" },
  { name: "equip_pshs_sign", labelKey: "AddPoiEquipement.pshs.sign" },
  { name: "equip_pshs_vest", labelKey: "AddPoiEquipement.pshs.vest" },
  { name: "equip_pshs_chem", labelKey: "AddPoiEquipement.pshs.chem" },
] as const;

/** Champs projetés par le backend lors de la recherche/détail d'un équipement. */
export const POI_DETAIL_FIELDS = [
  "name",
  "equip_type_name",
  "equip_type_famille",
  "categorie",
  "enqueteStatut",
  "equip_nature",
  "equip_sol",
  "equip_surf",
  "equip_larg",
  "equip_long",
  "aps_name",
  "inst_nom",
  "equip_prop_nom",
  "equip_prop_type",
  "equip_gest_type",
  "inst_acc_handi_bool",
  "inst_acc_handi_type",
  "equip_pmr_acc",
  "equip_pmr_chem",
  "equip_pmr_douche",
  "equip_pmr_sanit",
  "equip_pmr_trib",
  "equip_pmr_vest",
  "equip_pshs_aire",
  "equip_pshs_chem",
  "equip_pshs_sanit",
  "equip_pshs_trib",
  "equip_pshs_vest",
  "equip_pshs_sign",
  "equip_acc_libre",
  "inst_trans_bool",
  "inst_trans_type",
  "equip_eclair",
  "equip_douche",
  "inst_part_bool",
  "inst_part_type",
  "equip_loc_type",
  "equip_utilisateur",
  "inst_date_creation",
  "inst_enqu_date",
  "equip_maj_date",
  "address",
  "geo",
  "geoPosition",
  "parent",
  // Image : projetée pour l'aperçu détail (handleOpenDetails n'effectue plus de
  // re-fetch → le match doit contenir tout ce que PoiDetailSSBE/CardPoiSSBE lisent).
  "profilImageUrl",
  "profileImageUrl",
  "profilMediumImageUrl",
  "profilThumbImageUrl",
  "image",
] as const;

// ── Scope du costum "équipement sportif" (dérivé de l'entité costum) ──────────
/**
 * Périmètre du costum équipement sportif. `parentId`/`sourceKey` sont dérivés de
 * l'ENTITÉ du costum (`useCocolight().entity` : `entity.id` / `entity.serverData.slug`),
 * pas d'une config — l'entité est la source de vérité et le scope s'adapte donc
 * automatiquement par déploiement. Les constantes ci-dessous ne servent que de
 * FALLBACK (entité indisponible). `poiType`/`addressCountry` sont des constantes
 * du domaine SSBE.
 */
export interface PoiEquipementScope {
  parentId: string;
  sourceKey: string;
  poiType: string;
  addressCountry: string;
}

export const DEFAULT_POI_EQUIPEMENT_SCOPE: PoiEquipementScope = {
  parentId: "6a04155ed047177b92399685",
  sourceKey: "equipementsSportifs974",
  poiType: "recoveryCenter",
  addressCountry: "RE",
};

/** Entité costum minimale utile à la résolution du scope (cf. `useCocolight().entity`). */
type ScopeEntity = { id?: string | null; serverData?: { slug?: string | null } | null } | null | undefined;

/**
 * Résout le scope depuis l'entité du costum : `parentId` = id de l'org costum,
 * `sourceKey` = son slug. Fallback sur les constantes SSBE si l'entité est absente.
 */
export function resolvePoiEquipementScope(entity?: ScopeEntity): PoiEquipementScope {
  const d = DEFAULT_POI_EQUIPEMENT_SCOPE;
  const slug = entity?.serverData?.slug;
  return {
    parentId: entity?.id || d.parentId,
    sourceKey: typeof slug === "string" && slug.trim().length > 0 ? slug.trim() : d.sourceKey,
    poiType: d.poiType,
    addressCountry: d.addressCountry,
  };
}

/** Construit les filtres de recherche d'équipements existants à une adresse. */
export function buildPoiMatchFilters(
  scope: PoiEquipementScope,
  params: { postalCode: string; equipTypeName: string; streetAddress?: string }
): Record<string, unknown> {
  const filters: Record<string, unknown> = {
    "address.postalCode": params.postalCode,
    equip_type_name: params.equipTypeName,
    $or: {
      "source.key": scope.sourceKey,
      "source.keys": scope.sourceKey,
      [`parent.${scope.parentId}`]: { $exists: true },
    },
    type: scope.poiType,
  };
  if (params.streetAddress && params.streetAddress.trim().length > 0) {
    filters["address.streetAddress"] = params.streetAddress;
  }
  return filters;
}

// ── Helpers de coercion FORMULAIRE ───────────────────────────────────────────
// Coercion de mapping form ↔ entité : `serverData` expose les champs costum en
// `unknown` (index signature), on les ramène aux valeurs RHF typées (string /
// boolean / string[]). C'est légitime et propre au domaine formulaire — distinct
// de la lecture d'affichage qui lit `serverData.X` typé directement.
export function isFilled(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : !!value;
}

export const toStringValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};

/**
 * serverData (`number`, ou `string` après hydratation SSR) → `number | undefined`
 * pour les champs dimension (`equip_long`/`equip_larg`/`equip_surf`) que le backend
 * attend en `number`. Vide → `undefined` (champ omis).
 */
export const toNumberValue = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const toBooleanValue = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return ["true", "1", "oui", "yes"].includes(value.trim().toLowerCase());
  return false;
};

export const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((e): e is string => typeof e === "string" && e.trim().length > 0);
  if (typeof value === "string") return value.split(",").map((e) => e.trim()).filter((e) => e.length > 0);
  return [];
};

/**
 * Date serverData (`Date` normalisée, ou string ISO après hydratation SSR) →
 * `"YYYY-MM-DD"` attendu par `DatePickerInput`/`<input type=date>`. Sans ça, une
 * date `Date` retombait sur `""` (champ vide en édition).
 */
export const toDateInput = (value: unknown): string => {
  const date = value instanceof Date ? value : typeof value === "string" && value.trim() ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? format(date, "yyyy-MM-dd") : "";
};

export const toggleArrayValue = (values: string[] | undefined, value: string) => {
  const current = Array.isArray(values) ? values : [];
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
};

export const createEmptyDefaults = (
  scope: PoiEquipementScope = DEFAULT_POI_EQUIPEMENT_SCOPE
): AddPoiFormData => ({
  name: "",
  type: scope.poiType as AddPoiFormData["type"],
  description: "",
  tags: [],
  urls: [],
  addressCountry: scope.addressCountry,
  addressLocality: "",
  localityId: "",
  postalCode: "",
  streetAddress: "",
  inst_acc_handi_bool: false,
  inst_trans_bool: false,
  equip_type_name: "",
  equip_type_famille: "",
  inst_date_creation: "",
  inst_enqu_date: "",
  equip_maj_date: "",
  equip_nature: "",
  equip_sol: "",
  equip_surf: undefined,
  equip_eclair: false,
  categorie: "",
  aps_name: [],
  equip_acc_libre: false,
  inst_acc_handi_type: "",
  inst_trans_type: "",
  inst_part_bool: false,
  inst_part_type: [],
  equip_prop_nom: "",
  equip_prop_type: "",
  equip_gest_type: "",
  equip_pmr_acc: false,
  equip_pmr_chem: false,
  equip_pmr_douche: false,
  equip_pmr_sanit: false,
  equip_pmr_trib: false,
  equip_pmr_vest: false,
  equip_pshs_aire: false,
  equip_pshs_chem: false,
  equip_pshs_sanit: false,
  equip_pshs_trib: false,
  equip_pshs_vest: false,
  equip_pshs_sign: false,
  equip_larg: undefined,
  equip_long: undefined,
  equip_douche: false,
  equip_loc_type: [],
  equip_utilisateur: [],
  inst_nom: "",
});

export const buildEditDefaults = (poi: Poi | null | undefined): AddPoiFormData => {
  const defaults = createEmptyDefaults();
  if (!poi) return defaults;

  // Source de vérité : `serverData` typé (PoiItemNormalized). Les champs costum
  // sont lus via l'index signature (`getField`) ; `address` est typé `PostalAddress`
  // (un cast local couvre ses sous-champs costum comme `localityId`).
  const serverData = poi.serverData;
  const address = serverData.address as (Record<string, unknown> | undefined);
  const getField = (field: string) => serverData[field];

  const resolvedType = toStringValue(getField("type"));

  return {
    ...defaults,
    name: toStringValue(getField("name")) || defaults.name,
    type: (resolvedType || defaults.type) as AddPoiFormData["type"],
    description: toStringValue(getField("description")) || defaults.description,
    tags: toStringArray(getField("tags")),
    urls: toStringArray(getField("urls")),
    addressCountry: toStringValue(address?.addressCountry) || defaults.addressCountry,
    addressLocality: toStringValue(address?.addressLocality),
    localityId: toStringValue(address?.localityId),
    postalCode: toStringValue(address?.postalCode),
    streetAddress: toStringValue(address?.streetAddress),
    inst_acc_handi_bool: toBooleanValue(getField("inst_acc_handi_bool")),
    inst_trans_bool: toBooleanValue(getField("inst_trans_bool")),
    equip_type_name: toStringValue(getField("equip_type_name")),
    equip_type_famille: toStringValue(getField("equip_type_famille")),
    inst_date_creation: toDateInput(getField("inst_date_creation")),
    inst_enqu_date: toDateInput(getField("inst_enqu_date")),
    equip_maj_date: toDateInput(getField("equip_maj_date")),
    equip_nature: toStringValue(getField("equip_nature")),
    equip_sol: toStringValue(getField("equip_sol")),
    equip_surf: toNumberValue(getField("equip_surf")),
    equip_eclair: toBooleanValue(getField("equip_eclair")),
    categorie: toStringValue(getField("categorie")),
    aps_name: toStringArray(getField("aps_name")),
    equip_acc_libre: toBooleanValue(getField("equip_acc_libre")),
    inst_acc_handi_type: toStringValue(getField("inst_acc_handi_type")),
    inst_trans_type: toStringValue(getField("inst_trans_type")),
    inst_part_bool: toBooleanValue(getField("inst_part_bool")),
    inst_part_type: toStringArray(getField("inst_part_type")),
    equip_prop_nom: toStringValue(getField("equip_prop_nom")),
    equip_prop_type: toStringValue(getField("equip_prop_type")),
    equip_gest_type: toStringValue(getField("equip_gest_type")),
    equip_pmr_acc: toBooleanValue(getField("equip_pmr_acc")),
    equip_pmr_chem: toBooleanValue(getField("equip_pmr_chem")),
    equip_pmr_douche: toBooleanValue(getField("equip_pmr_douche")),
    equip_pmr_sanit: toBooleanValue(getField("equip_pmr_sanit")),
    equip_pmr_trib: toBooleanValue(getField("equip_pmr_trib")),
    equip_pmr_vest: toBooleanValue(getField("equip_pmr_vest")),
    equip_pshs_aire: toBooleanValue(getField("equip_pshs_aire")),
    equip_pshs_chem: toBooleanValue(getField("equip_pshs_chem")),
    equip_pshs_sanit: toBooleanValue(getField("equip_pshs_sanit")),
    equip_pshs_trib: toBooleanValue(getField("equip_pshs_trib")),
    equip_pshs_vest: toBooleanValue(getField("equip_pshs_vest")),
    equip_pshs_sign: toBooleanValue(getField("equip_pshs_sign")),
    equip_larg: toNumberValue(getField("equip_larg")),
    equip_long: toNumberValue(getField("equip_long")),
    equip_douche: toBooleanValue(getField("equip_douche")),
    equip_loc_type: toStringArray(getField("equip_loc_type")),
    equip_utilisateur: toStringArray(getField("equip_utilisateur")),
    inst_nom: toStringValue(getField("inst_nom")),
  };
};
