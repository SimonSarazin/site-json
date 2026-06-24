import type { TiersLieuxFormData } from "./tiersLieux.schema";
import { getDefaultTiersLieuxValues } from "./tiersLieux.schema";
import { transformFormDataWithAddress } from "../hooks/mutationUtils";
// Pipeline (P3) — imports DIRECTS (pas le barrel formEngine) pour rester un util pur. cf. doc/refactor-field-treatment.md.
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import "../forms/geoTransforms"; // enregistre geo:write / geoPosition:write (partagés)
import { seedEntity, buildPayload, buildEditPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
// Imports DIRECTS de la couche config (PAS le barrel → pas de widgets/React tirés ici, l'util reste pur).
import { formDescriptorToConfig } from "@/modules/formEngine/config/formDescriptorToConfig";
import { configToDescriptor } from "@/modules/formEngine/config/configToDescriptor";
import type { FormValues, JsonFormConfig } from "@/modules/formEngine";
import { tiersLieuDescriptor } from "../forms/tiersLieu.descriptor";

// CONFIG-DRIVEN : le SPEC tiers-lieu tourne sur le descripteur ISSU DE LA CONFIG (round-trip identique au
// descripteur unifié → parité byte garantie). READ (seedEntity) ET WRITE (buildPayload/buildEditPayload)
// passent donc par la config. Labels gardés = clés i18n (résolues par GenericForm au rendu).
// Le contexte costum CREATE (type/preferences) est porté par `submit.extraData` — DONNÉE de config appliquée
// génériquement au create (cf. buildTiersLieuxPayload), PLUS aucune constante en dur dans le code.
const TIERSLIEU_CONFIG: JsonFormConfig = {
  ...formDescriptorToConfig(tiersLieuDescriptor),
  submit: { mode: "sdk", extraData: { type: "NGO", preferences: { isOpenData: true, isOpenEdition: true } } },
};
const KEEP_KEYS = (l: unknown) => (typeof l === "string" ? l : ((l as { fr?: string })?.fr ?? ""));
/** Descripteur tiers-lieu dérivé de la config (= tiersLieuDescriptor round-trip). Rendu par la modale. */
export const tiersLieuConfigDescriptor = configToDescriptor(TIERSLIEU_CONFIG, { tLoc: KEEP_KEYS });

export interface CostumConfig {
  /** Tag principal du costum (filtre observatoire). Ajouté à `tags`. NB : la lib pose aussi le *champ* mainTag via presets. */
  mainTag?: string;
  /** Tag « compagnon » spécifique au déploiement (filtre observatoire). Ajouté à `tags`. */
  compagnon?: string;
  // `slug` / `id` / `type` / `editMode` retirés : le slug du costum = slug de l'entité porteuse
  // (useCocolight().entity = VITE_SLUG, constant) ; costumId/costumType viennent du registry lib via
  // `me.costum(slug)`. config.costum ne sert plus qu'aux TAGS (mainTag/compagnon) de l'observatoire.
}

const DAY_TO_DOW: Record<keyof TiersLieuxFormData["hours"], string> = {
  monday: "Mo",
  tuesday: "Tu",
  wednesday: "We",
  thursday: "Th",
  friday: "Fr",
  saturday: "Sa",
  sunday: "Su",
};

const DOW_TO_DAY: Record<string, keyof TiersLieuxFormData["hours"]> = {
  Mo: "monday",
  Tu: "tuesday",
  We: "wednesday",
  Th: "thursday",
  Fr: "friday",
  Sa: "saturday",
  Su: "sunday",
};

const ORDERED_DAYS: Array<keyof TiersLieuxFormData["hours"]> = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

const KNOWN_MANAGEMENT_TYPES = [
  "association", "collectif-citoyen", "universites", "etablissements-scolaires",
  "collectivites", "sarl-sa-sas", "scic", "scop", "autre",
];

type OpeningHoursEntry = { dayOfWeek: string; hours: Array<{ opens: string; closes: string }> } | "";

export function buildOpeningHoursPayload(hours: TiersLieuxFormData["hours"]): OpeningHoursEntry[] {
  return ORDERED_DAYS.map<OpeningHoursEntry>((day) => {
    const slot = hours[day];
    if (slot?.enabled && slot.start && slot.end) {
      return {
        dayOfWeek: DAY_TO_DOW[day],
        hours: [{ opens: slot.start, closes: slot.end }],
      };
    }
    return "" as const;
  });
}

function buildOpeningDatePayload(month?: string, year?: string): string | undefined {
  if (!month && !year) return undefined;
  if (month && year) return `01/${month}/${year}`;
  return month || year;
}

function parseOpeningDate(value: unknown): { month: string; year: string } {
  if (typeof value !== "string" || !value) return { month: "", year: "" };
  const parts = value.split("/");
  if (parts.length === 3) return { month: parts[1] ?? "", year: parts[2] ?? "" };
  if (parts.length === 2) return { month: parts[0] ?? "", year: parts[1] ?? "" };
  return { month: "", year: value };
}

function parseOpeningHours(raw: unknown): TiersLieuxFormData["hours"] {
  const defaults = getDefaultTiersLieuxValues().hours;
  if (!Array.isArray(raw)) return defaults;
  const result = { ...defaults };
  for (const day of ORDERED_DAYS) {
    result[day] = { ...defaults[day], enabled: false };
  }
  for (const entry of raw) {
    if (
      entry &&
      typeof entry === "object" &&
      "dayOfWeek" in entry &&
      typeof (entry as { dayOfWeek: unknown }).dayOfWeek === "string"
    ) {
      const dow = (entry as { dayOfWeek: string }).dayOfWeek;
      const day = DOW_TO_DAY[dow];
      const slots = (entry as { hours?: Array<{ opens?: string; closes?: string }> }).hours;
      if (day && slots && slots[0]) {
        result[day] = {
          enabled: true,
          start: slots[0].opens ?? "08:00",
          end: slots[0].closes ?? "18:00",
        };
      }
    }
  }
  return result;
}

function parseFamily(value: unknown): { family: string[]; familyOther: string } {
  if (Array.isArray(value)) {
    return { family: value.filter((v): v is string => typeof v === "string"), familyOther: "" };
  }
  if (typeof value === "string" && value) {
    return { family: value.split(",").map((s) => s.trim()).filter(Boolean), familyOther: "" };
  }
  return { family: [], familyOther: "" };
}

function parseManagementType(value: unknown): { managementType: string; managementTypeOther: string } {
  if (typeof value !== "string" || !value) return { managementType: "", managementTypeOther: "" };
  if (KNOWN_MANAGEMENT_TYPES.includes(value)) {
    return { managementType: value, managementTypeOther: "" };
  }
  return { managementType: "autre", managementTypeOther: value };
}

/** Lecture : `serverData.socialNetwork` est un OBJET `{ facebook: url, ... }` (dataBinding legacy
 *  `socialNetwork` + `TranslateFtl::socialNetwork`), pas un array. (Fallback array rétro-compat.)
 *  → liste {platform,url} pour le form. */
function parseSocialLinks(value: unknown): Array<{ platform: string; url: string }> {
  if (Array.isArray(value)) {
    return value
      .filter((s): s is { platform: string; url: string } =>
        s !== null && typeof s === "object" && "platform" in s && "url" in s
      )
      .map((s) => ({ platform: String(s.platform ?? ""), url: String(s.url ?? "") }));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, url]) => typeof url === "string" && (url as string).trim().length > 0)
      .map(([platform, url]) => ({ platform, url: String(url) }));
  }
  return [];
}

/** Écriture : socialLinks (form) → OBJET `socialNetwork` `{ facebook: url, ... }` — le format réel
 *  attendu par le legacy (dataBinding org `socialNetwork`, toutes plateformes dont linkedin). */
function buildSocialNetwork(links?: Array<{ platform: string; url: string }>): Record<string, unknown> {
  const obj: Record<string, string> = {};
  for (const l of links ?? []) {
    const p = (l.platform ?? "").trim();
    const url = (l.url ?? "").trim();
    if (p && url) obj[p] = url;
  }
  return Object.keys(obj).length > 0 ? { socialNetwork: obj } : {};
}

/** Écriture : family (multi) + familyOther → `{ typePlace }` (la valeur 'autre' est remplacée par le
 *  texte libre). Plus de clé `typePlaceOther` (non writable → rejet DraftProxy). */
function buildTypePlace(family?: string[], familyOther?: string): Record<string, string> {
  const parts = (family ?? [])
    .map((f) => (f === "autre" ? (familyOther ?? "").trim() : f))
    .filter(Boolean);
  return parts.length > 0 ? { typePlace: parts.join(", ") } : {};
}

function pickString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function pickNumberString(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "";
}

export interface EntityLike {
  serverData?: Record<string, unknown> | null;
}

// ── READ via pipeline (P3) ──────────────────────────────────────────────────
// Transformers nommés réutilisant les helpers ci-dessus (side-effect à l'import). Champs 1→1 (path +
// read) + 4 GROUPES décompose (1 champ serveur → N champs form) : openingDate, manageModel,
// typePlace (+typePlaceOther via le 2e arg `all`), address. cf. doc/refactor-field-treatment.md (P3).
registerTransform("tl:pickString", (v) => pickString(v));
registerTransform("tl:pickNumberString", (v) => pickNumberString(v));
registerTransform("tl:video0", (v) => pickString(Array.isArray(v) ? v[0] : undefined));
registerTransform("tl:socialRead", (v) => parseSocialLinks(v));
registerTransform("tl:hoursRead", (v) => parseOpeningHours(v));
registerTransform("tl:openingDateRead", (v) => { const o = parseOpeningDate(v); return { openingMonth: o.month, openingYear: o.year }; });
registerTransform("tl:manageModelRead", (v) => { const m = parseManagementType(v); return { managementType: m.managementType, managementTypeOther: m.managementTypeOther }; });
registerTransform("tl:typePlaceRead", (v, all) => {
  const fam = parseFamily(v);
  return { family: fam.family, familyOther: pickString((all as Record<string, unknown>).typePlaceOther) || fam.familyOther };
});
// Lit les 14 champs SIG (parité profil `pf:addressRead`) → round-trip COMPLET des niveaux (level1..4/
// codeInsee). Sans eux, une édition sans toucher l'adresse reconstruisait un objet partiel ; et le schéma
// stripait les niveaux posés par EditLocationTab. cf. doc/refactor-field-treatment.md (asymétrie adresse).
registerTransform("tl:addressRead", (v) => {
  const a = (v ?? {}) as Record<string, unknown>;
  return {
    addressCountry: pickString(a.addressCountry), addressLocality: pickString(a.addressLocality),
    postalCode: pickString(a.postalCode), streetAddress: pickString(a.streetAddress), localityId: pickString(a.localityId),
    level1: pickString(a.level1), level1Name: pickString(a.level1Name),
    level2: pickString(a.level2), level2Name: pickString(a.level2Name),
    level3: pickString(a.level3), level3Name: pickString(a.level3Name),
    level4: pickString(a.level4), level4Name: pickString(a.level4Name),
    codeInsee: pickString(a.codeInsee),
  };
});
// WRITE (P3) — réutilisent les helpers de build. `undefined` sur vide = clé OMISE par valuesToPayload
// (parité de l'omit-empty de l'ancien buildTiersLieuxPayload ; le diff d'édition efface, lui, via diffForEdit).
registerTransform("tl:emptyToUndef", (v) => (v ? v : undefined));
registerTransform("tl:numOrUndef", (v) => (v ? Number(v) : undefined));
registerTransform("tl:videoWrite", (v) => (v ? [v] : undefined));
registerTransform("tl:socialWrite", (links) => buildSocialNetwork(links as Array<{ platform: string; url: string }>).socialNetwork);
registerTransform("tl:hoursWrite", (hours) => {
  const oh = buildOpeningHoursPayload(hours as TiersLieuxFormData["hours"]);
  return oh.some((e) => e !== "") ? oh : undefined; // omet openingHours si aucun jour ouvert
});
registerTransform("tl:openingDateWrite", (_v, all) =>
  buildOpeningDatePayload((all as Record<string, string>).openingMonth, (all as Record<string, string>).openingYear));
registerTransform("tl:manageModelWrite", (_v, all) => {
  const a = all as Record<string, string>;
  return a.managementType ? (a.managementType === "autre" && a.managementTypeOther ? a.managementTypeOther : a.managementType) : undefined;
});
registerTransform("tl:typePlaceWrite", (_v, all) =>
  buildTypePlace((all as Record<string, unknown>).family as string[], (all as Record<string, unknown>).familyOther as string).typePlace);
registerTransform("tl:addressWrite", (_v, all) => transformFormDataWithAddress((all ?? {}) as Record<string, unknown>).address);
// geo/geoPosition : transforms PARTAGÉS `geo:write`/`geoPosition:write` (liés à localityId), uniformes
// pour toutes les entités à composant adresse. cf. ../forms/geoTransforms (importé pour le side-effect).


/** Spec tiers-lieu (pattern unifié, CONFIG-DRIVEN) : descripteur issu de la config + socle typé. */
const TIERSLIEU_SPEC: FormSpec = {
  descriptor: tiersLieuConfigDescriptor,
  baseDefaults: () => getDefaultTiersLieuxValues() as unknown as FormValues,
};

/**
 * Entité serveur → valeurs de form tiers-lieu, via la primitive générique `seedEntity` (socle
 * `getDefaultTiersLieuxValues` + seed serveur). Équivalent à l'ancien mapping (prouvé en test).
 */
export function mapEntityToTiersLieuxValues(entity: EntityLike): TiersLieuxFormData {
  return seedEntity(TIERSLIEU_SPEC, entity) as unknown as TiersLieuxFormData;
}

export interface BuildPayloadOptions {
  /**
   * Si fourni, injecte les constantes costum (mainTag, compagnon, costumSlug…) dans le payload.
   * À utiliser pour la **création** d'une entité costum (les valeurs viennent du site config).
   * Pour l'**édition**, on omet ce champ : l'entité existante porte déjà ses costum fields.
   *
   * Note : si `costum.mainTag` et/ou `costum.compagnon` sont définis, ils sont
   * auto-ajoutés à `payload.tags` (mergés sans dupliquer avec `existingTags` +
   * `addTags`). `compagnon` est une valeur de tag, jamais un champ propre du payload.
   */
  costum?: CostumConfig;
  /**
   * Tags supplémentaires à garantir présents dans `payload.tags` (mergés sans dupliquer).
   * Combiné avec `costum.mainTag` (auto-ajouté si fourni).
   */
  addTags?: string[];
  /**
   * Tags actuels de l'entité (depuis `serverData.tags`) — mergés sans écrasement.
   * Au CREATE : omettre (rien à merger). À l'EDIT : passer `organization.serverData.tags`
   * pour préserver les tags existants quand `payload.tags` écrase via `.save()`.
   */
  existingTags?: string[];
  /**
   * ÉDITION (pattern unifié S6) : produit un payload COMPLET (vides typés `""`/`[]`) destiné à
   * `Object.assign(entity.data)` + `save()` — le SDK diffe et le backend efface ($unset). Au CREATE :
   * omettre (omit-empty natif, pour ne pas envoyer "" aux champs typés que l'AJV ADD rejetterait).
   */
  complete?: boolean;
}

export function buildTiersLieuxPayload(
  data: TiersLieuxFormData,
  options: BuildPayloadOptions = {}
): Record<string, unknown> {
  // Assemblage via le pipeline (TIERSLIEU_DESCRIPTOR : write transforms + path + groupes openingDate/
  // manageModel/typePlace/address). Un write renvoyant `undefined` sur vide → clé OMISE (parité exacte de
  // l'ancien omit-empty ; prouvé par tiersLieuxMapping.test.ts). EditLocationTab a posé level1..4/codeInsee/geo
  // dans `data` → l'objet `address` reconstruit reste COMPLET. Le contexte costum (presets + merge tags)
  // dépend de la config (hors descripteur) → géré ci-dessous.
  const payload = (options.complete
    ? buildEditPayload(TIERSLIEU_SPEC, data as unknown as FormValues)
    : buildPayload(TIERSLIEU_SPEC, data as unknown as FormValues)) as Record<string, unknown>;

  if (options.costum) {
    // Contexte costum CREATE = DONNÉES de config (`TIERSLIEU_CONFIG.submit.extraData`), fusionnées dans le
    // payload (merge extraData, hors clés costum*) → AUCUNE constante en dur ici. Les clés de contexte
    // costum (costum*) sont injectées par la lib (`me.costum(slug)`), jamais par le payload.
    for (const [k, v] of Object.entries(TIERSLIEU_CONFIG.submit?.extraData ?? {})) {
      if (k.startsWith("costum")) continue;
      payload[k] = v;
    }
    // `role:"admin"` et le CHAMP `mainTag` NE sont PAS posés : presets costum de la lib (`me.costum(slug)`
    // → `{role:"admin", mainTag:"TiersLieux"}`, CostumScope.create = `{...presets, ...data}`). `role` est
    // inerte côté serveur (admin réel = links.members.isAdmin) ; le CHAMP `mainTag` n'a aucun effet
    // observatoire (les filtres lisent `tags`) → seul le merge `tags` ci-dessous compte. source/costumSlug/
    // costumId/costumType aussi injectés par la lib ; le backend pose `source` au save. cf. useAddTiersLieu.
  }

  // Merge tags : `costum.mainTag` + `costum.compagnon` (auto) + `addTags` (manuel)
  // mergés à `existingTags`. `compagnon` est une *valeur de tag* (cf. dimension
  // observatoire `kind: "contains"` sur `tags`), pas un champ propre du payload.
  // Dédoublonne via Set (préserve l'ordre d'insertion). N'écrase pas, n'enlève rien.
  const tagsToAdd: string[] = [];
  if (options.costum?.mainTag) tagsToAdd.push(options.costum.mainTag);
  if (options.costum?.compagnon) tagsToAdd.push(options.costum.compagnon);
  if (options.addTags) tagsToAdd.push(...options.addTags);

  const existing = options.existingTags ?? [];
  const allTags = [...existing, ...tagsToAdd].filter(Boolean);
  if (allTags.length > 0) {
    payload.tags = Array.from(new Set(allTags));
  }

  return payload;
}
