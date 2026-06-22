/**
 * Constantes et helpers purs du formulaire "équipement sportif" (POI SSBE).
 * Extrait de `AddPoiEquipementModal` pour : (1) dédupliquer les valeurs métier
 * codées en dur (notamment l'ObjectId de l'org parente, présent à plusieurs
 * endroits), (2) rendre le mapping form↔entité testable isolément.
 */
import { format } from "date-fns";
import type { Poi } from "@communecter/cocolight-api-client";
import type { AddPoiFormData } from "../../schemaForm";
// Helpers de pipeline partagés (imports DIRECTS, pas le barrel formEngine → util pur testable sans
// tirer les widgets/composants). cf. doc/refactor-field-treatment.md.
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import { seedFromEntity, valuesToPayload, diffForEdit } from "@/modules/formEngine/engine/fieldPipeline";
import type { FieldDescriptor, FormDescriptor, FormValues } from "@/modules/formEngine";
import { buildAddressFromForm } from "../../hooks/mutationUtils";

/**
 * Payload de CRÉATION équipement (POI costum) : data + image optionnelle. Le `save()` route
 * `_imageFile` vers le bloc PROFIL_IMAGE. (Relocalisé depuis l'ancien PoiEquipementForm, supprimé.)
 */
export interface PoiEquipementSubmitPayload extends AddPoiFormData {
  _imageFile?: File | null;
  /** Drapeau UI : supprimer l'image existante (édition). Ignoré à la création. */
  _imageDeleted?: boolean;
}

/** Payload d'ÉDITION : delta serveur (champs modifiés/vidés, cf. buildEditDelta) + image. */
export type PoiEquipementEditPayload = Partial<AddPoiFormData> & { _imageFile?: File | null; _imageDeleted?: boolean };

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

// ── READ via pipeline (P2) : remplace le mapping coercer-par-coercer ───────────
// Coercers enregistrés comme transformers nommés + un descripteur de LECTURE déclaratif (coercer `read`
// + `default` par champ ; adresse = groupe de sérialisation objet `address` → 5 champs plats).
// `seedFromEntity(POI_READ_DESCRIPTOR, serverData)` reproduit l'ancien buildEditDefaults byte-pour-byte
// (prouvé en test) — création (serverData={}) ET édition. cf. doc/refactor-field-treatment.md (P2).
registerTransform("poi:toString", (v) => toStringValue(v));
registerTransform("poi:toNumber", (v) => toNumberValue(v));
registerTransform("poi:toBoolean", (v) => toBooleanValue(v));
registerTransform("poi:toStringArray", (v) => toStringArray(v));
registerTransform("poi:toDate", (v) => toDateInput(v));
// Adresse : objet serveur `address` → 5 champs plats. Parité buildEditDefaults : addressCountry retombe
// sur le défaut de scope ("RE") si vide ; les 4 autres sur "". (Écriture = P2-suite, ici read seulement.)
registerTransform("poi:addressRead", (a) => {
  const o = (a ?? {}) as Record<string, unknown>;
  return {
    addressCountry: toStringValue(o.addressCountry) || DEFAULT_POI_EQUIPEMENT_SCOPE.addressCountry,
    addressLocality: toStringValue(o.addressLocality),
    localityId: toStringValue(o.localityId),
    postalCode: toStringValue(o.postalCode),
    streetAddress: toStringValue(o.streetAddress),
  };
});
// WRITE adresse : champs plats du form → objet `address` imbriqué (ou `undefined` si pas de localityId →
// clé omise, parité buildAddressFromForm). `all` = toutes les valeurs de form.
registerTransform("poi:addressWrite", (all) => buildAddressFromForm((all ?? {}) as Record<string, string>));

const READ_STR = ["name", "description", "equip_type_name", "equip_type_famille", "equip_nature", "equip_sol", "categorie", "inst_acc_handi_type", "inst_trans_type", "equip_prop_nom", "equip_prop_type", "equip_gest_type", "inst_nom"];
const READ_NUM = ["equip_surf", "equip_larg", "equip_long"];
const READ_BOOL = ["inst_acc_handi_bool", "inst_trans_bool", "equip_eclair", "equip_acc_libre", "inst_part_bool", "equip_pmr_acc", "equip_pmr_chem", "equip_pmr_douche", "equip_pmr_sanit", "equip_pmr_trib", "equip_pmr_vest", "equip_pshs_aire", "equip_pshs_chem", "equip_pshs_sanit", "equip_pshs_trib", "equip_pshs_vest", "equip_pshs_sign", "equip_douche"];
const READ_ARR = ["tags", "urls", "aps_name", "inst_part_type", "equip_loc_type", "equip_utilisateur"];
const READ_DATE = ["inst_date_creation", "inst_enqu_date", "equip_maj_date"];

/** Descripteur de LECTURE POI (interne) : champs déclaratifs (read+default) consommés par seedFromEntity. */
function buildPoiReadFields(): Record<string, FieldDescriptor> {
  const f: Record<string, FieldDescriptor> = {};
  const add = (name: string, type: FieldDescriptor["type"], read: string, def?: unknown) => {
    f[name] = { name, type, widget: "hidden", label: name, read, ...(def !== undefined ? { default: def } : {}) };
  };
  for (const n of READ_STR) add(n, "string", "poi:toString", "");
  for (const n of READ_NUM) add(n, "number", "poi:toNumber");           // pas de défaut → undefined
  for (const n of READ_BOOL) add(n, "boolean", "poi:toBoolean", false);
  for (const n of READ_ARR) add(n, "array", "poi:toStringArray", []);
  for (const n of READ_DATE) add(n, "date", "poi:toDate", "");
  add("type", "string", "poi:toString", DEFAULT_POI_EQUIPEMENT_SCOPE.poiType);
  // membres du groupe `address` (skippés au profit de poi:addressRead).
  for (const n of ["addressCountry", "addressLocality", "localityId", "postalCode", "streetAddress"]) {
    f[n] = { name: n, type: "string", widget: "hidden", label: n, group: "address" };
  }
  return f;
}

const POI_READ_DESCRIPTOR: FormDescriptor = {
  id: "poi-equipement:read", collection: "poi", layout: { kind: "flat" }, sections: [],
  serializeGroups: { address: { serverKey: "address", read: "poi:addressRead", write: "poi:addressWrite" } },
  fields: buildPoiReadFields(),
};

// Descripteur d'ÉCRITURE = lecture + `geo`/`geoPosition` (posés par EditLocationTab, hors AddPoiFormData lue ;
// donc PAS dans POI_READ_DESCRIPTOR sinon seedFromEntity les remonterait). L'adresse (groupe) recompose l'objet
// imbriqué via poi:addressWrite ; geo/geoPosition partent quand ils changent (≈ l'ancien "force si adresse change",
// EditLocationTab les met à jour AVEC l'adresse).
const POI_WRITE_DESCRIPTOR: FormDescriptor = {
  ...POI_READ_DESCRIPTOR,
  fields: {
    ...POI_READ_DESCRIPTOR.fields,
    geo: { name: "geo", type: "object", widget: "hidden", label: "geo" },
    geoPosition: { name: "geoPosition", type: "object", widget: "hidden", label: "geoPosition" },
  },
};

/**
 * Valeurs de form depuis l'entité (édition) OU les défauts (création) — délègue à `seedFromEntity` via
 * POI_READ_DESCRIPTOR. `createEmptyDefaults()` sert de socle typé/complet ; `seedFromEntity` l'écrase
 * avec les valeurs serveur coercées + défauts. Équivalent byte-pour-byte à l'ancien mapping (prouvé en test).
 */
export const buildEditDefaults = (poi: Poi | null | undefined): AddPoiFormData => {
  const seeded = seedFromEntity(POI_READ_DESCRIPTOR, (poi?.serverData ?? {}) as FormValues);
  return { ...createEmptyDefaults(), ...seeded } as AddPoiFormData;
};

// ── Delta d'édition (pipeline, P2) ──────────────────────────────────────────────
/**
 * `current` vs `defaults` → delta serveur à appliquer au draft : via `valuesToPayload` (adresse recomposée
 * en objet imbriqué + champs costum) puis `diffForEdit` (modifié → valeur, VIDÉ → clear typé). Remplace
 * `buildEditPatch` + `transformFormDataWithAddress` : le delta est DÉJÀ nidifié (clé `address`), donc
 * `transformFormDataWithAddress` côté mutation devient un no-op. Différence ASSUMÉE vs l'ancien : un champ
 * vidé est réellement effacé (l'ancien lâchait les `undefined`). `geo`/`geoPosition` partent quand ils
 * changent (EditLocationTab les met à jour avec l'adresse). cf. doc/refactor-field-treatment.md (P2).
 */
export function buildEditDelta(current: AddPoiFormData, defaults: AddPoiFormData): Record<string, unknown> {
  const payload = valuesToPayload(POI_WRITE_DESCRIPTOR, current as unknown as FormValues);
  const baseline = valuesToPayload(POI_WRITE_DESCRIPTOR, defaults as unknown as FormValues);
  return diffForEdit(POI_WRITE_DESCRIPTOR, payload, baseline);
}
