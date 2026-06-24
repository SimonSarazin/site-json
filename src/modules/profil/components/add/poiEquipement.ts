/**
 * Constantes et helpers purs du formulaire "équipement sportif" (POI SSBE).
 * Extrait de `AddPoiEquipementModal` pour : (1) dédupliquer les valeurs métier
 * codées en dur (notamment l'ObjectId de l'org parente, présent à plusieurs
 * endroits), (2) rendre le mapping form↔entité testable isolément.
 */
import { format } from "date-fns";
import type { AddPoiFormData } from "../../schemaForm";
// Helpers de pipeline partagés (imports DIRECTS, pas le barrel formEngine → util pur testable sans
// tirer les widgets/composants). cf. doc/refactor-field-treatment.md.
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import { buildPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import "../../forms/geoTransforms"; // enregistre geo:write / geoPosition:write (partagés)
import type { FormValues } from "@/modules/formEngine";
import { poiEquipementDescriptor } from "../../forms/poiEquipement.descriptor";
import { buildAddressFromForm } from "../../hooks/mutationUtils";


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
  level1: "", level1Name: "", level2: "", level2Name: "",
  level3: "", level3Name: "", level4: "", level4Name: "", codeInsee: "",
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
    // 9 champs SIG (level1..4/codeInsee) : round-trip COMPLET requis par l'édition unifiée (S6) — sinon
    // l'adresse reconstruite (payload complet) écraserait les niveaux serveur. Parité tl:addressRead.
    level1: toStringValue(o.level1), level1Name: toStringValue(o.level1Name),
    level2: toStringValue(o.level2), level2Name: toStringValue(o.level2Name),
    level3: toStringValue(o.level3), level3Name: toStringValue(o.level3Name),
    level4: toStringValue(o.level4), level4Name: toStringValue(o.level4Name),
    codeInsee: toStringValue(o.codeInsee),
  };
});
// WRITE adresse : champs plats du form → objet `address` imbriqué (ou `undefined` si pas de localityId →
// clé omise, parité buildAddressFromForm). `all` = toutes les valeurs de form.
registerTransform("poi:addressWrite", (all) => buildAddressFromForm((all ?? {}) as Record<string, string>));

/**
 * Spec POI = descripteur UNIFIÉ (render + read/write) `poiEquipementDescriptor` + socle createEmptyDefaults.
 * Le MÊME descripteur pilote le rendu (GenericForm), le READ (seedEntity), le WRITE create/edit (buildPayload)
 * ET la config (formDescriptorToConfig). Les transforms `poi:*` référencés par ses champs sont enregistrés
 * ci-dessus (poi:toString/…, poi:addressRead/Write) + `geo:*` via l'import geoTransforms. cf. tiers-lieu.
 */
const POI_SPEC: FormSpec = { descriptor: poiEquipementDescriptor, baseDefaults: () => createEmptyDefaults() as unknown as FormValues };

/**
 * Payload de CRÉATION POI (pipeline, omit-empty) : adresse imbriquée, geo coercé, champs équipement typés
 * (poi:toString/toNumber/toBoolean), via le descripteur unifié. Le READ (defaults) et le WRITE d'édition
 * passent désormais par les helpers config-driven du host (buildPipelineDefaults/buildPipelinePayload, cf.
 * configs/poiEquipement.tsx). parent/extraFields/image gérés par l'appelant (useEntityMutation).
 */
export function buildAddPoiPayload(data: AddPoiFormData): Record<string, unknown> {
  return buildPayload(POI_SPEC, data as unknown as FormValues) as Record<string, unknown>;
}
