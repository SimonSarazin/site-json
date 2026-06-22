import type { TiersLieuxFormData } from "../components/add/TiersLieuxForm";
import { getDefaultTiersLieuxValues } from "../components/add/TiersLieuxForm";
import { transformFormDataWithAddress } from "../hooks/mutationUtils";
// Pipeline (P3) — imports DIRECTS (pas le barrel formEngine) pour rester un util pur. cf. doc/refactor-field-treatment.md.
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import { seedFromEntity } from "@/modules/formEngine/engine/fieldPipeline";
import type { FieldDescriptor, FormDescriptor, FormValues } from "@/modules/formEngine";

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
registerTransform("tl:addressRead", (v) => {
  const a = (v ?? {}) as Record<string, unknown>;
  return {
    addressCountry: pickString(a.addressCountry), addressLocality: pickString(a.addressLocality),
    postalCode: pickString(a.postalCode), streetAddress: pickString(a.streetAddress), localityId: pickString(a.localityId),
  };
});

const ro = (name: string, read: string, path?: string, type: FieldDescriptor["type"] = "string"): FieldDescriptor =>
  ({ name, type, widget: "hidden", label: name, read, ...(path ? { path } : {}) });
const grp = (name: string, group: string, type: FieldDescriptor["type"] = "string"): FieldDescriptor =>
  ({ name, type, widget: "hidden", label: name, group });

const TIERSLIEU_READ_DESCRIPTOR: FormDescriptor = {
  id: "tiers-lieu:read", collection: "organizations", layout: { kind: "flat" }, sections: [],
  serializeGroups: {
    openingDate: { serverKey: "openingDate", read: "tl:openingDateRead", write: "tl:openingDateRead" },
    manageModel: { serverKey: "manageModel", read: "tl:manageModelRead", write: "tl:manageModelRead" },
    typePlace: { serverKey: "typePlace", read: "tl:typePlaceRead", write: "tl:typePlaceRead" },
    address: { serverKey: "address", read: "tl:addressRead", write: "tl:addressRead" },
  },
  fields: {
    name: ro("name", "tl:pickString"),
    shortDescription: ro("shortDescription", "tl:pickString"),
    description: ro("description", "tl:pickString"),
    structureName: ro("structureName", "tl:pickString", "holderOrganization"),
    surfaceBuilt: ro("surfaceBuilt", "tl:pickNumberString", "buildingSurfaceArea"),
    surfaceOutdoor: ro("surfaceOutdoor", "tl:pickNumberString", "siteSurfaceArea"),
    email: ro("email", "tl:pickString"),
    phone: ro("phone", "tl:pickString", "telephone"),
    websiteUrl: ro("websiteUrl", "tl:pickString", "url"),
    videoUrl: ro("videoUrl", "tl:video0", "video"),
    socialLinks: ro("socialLinks", "tl:socialRead", "socialNetwork", "array"),
    hours: ro("hours", "tl:hoursRead", "openingHours", "object"),
    openingMonth: grp("openingMonth", "openingDate"),
    openingYear: grp("openingYear", "openingDate"),
    managementType: grp("managementType", "manageModel"),
    managementTypeOther: grp("managementTypeOther", "manageModel"),
    family: grp("family", "typePlace", "array"),
    familyOther: grp("familyOther", "typePlace"),
    addressCountry: grp("addressCountry", "address"),
    addressLocality: grp("addressLocality", "address"),
    postalCode: grp("postalCode", "address"),
    streetAddress: grp("streetAddress", "address"),
    localityId: grp("localityId", "address"),
  },
};

/**
 * Entité serveur → valeurs de form tiers-lieu. Délègue à `seedFromEntity(TIERSLIEU_READ_DESCRIPTOR)` ;
 * `getDefaultTiersLieuxValues()` = socle (logo/photos/… non mappés). Équivalent à l'ancien mapping
 * helper-par-helper (prouvé en test). cf. doc/refactor-field-treatment.md (P3).
 */
export function mapEntityToTiersLieuxValues(entity: EntityLike): TiersLieuxFormData {
  const data = (entity.serverData ?? {}) as FormValues;
  return { ...getDefaultTiersLieuxValues(), ...seedFromEntity(TIERSLIEU_READ_DESCRIPTOR, data) } as TiersLieuxFormData;
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
}

export function buildTiersLieuxPayload(
  data: TiersLieuxFormData,
  options: BuildPayloadOptions = {}
): Record<string, unknown> {
  // Passer TOUTE la data (EditLocationTab y pose level1..4/codeInsee/geo au choix d'une ville) → l'objet
  // `address` reconstruit est COMPLET, pas amputé de level2..4 (sinon écrasement lossy de l'adresse serveur).
  // On n'extrait que `.address` (le reste de la data est cherry-pické champ par champ ci-dessous).
  const { address: builtAddress } = transformFormDataWithAddress(data as unknown as Record<string, unknown>);
  const transformedAddress = builtAddress ? { address: builtAddress } : {};

  const openingHours = buildOpeningHoursPayload(data.hours);
  const hasAnyOpen = openingHours.some((entry) => entry !== "");

  const payload: Record<string, unknown> = {
    name: data.name,
    ...transformedAddress,
    ...(data.shortDescription ? { shortDescription: data.shortDescription } : {}),
    ...(data.description ? { description: data.description } : {}),
    ...(buildOpeningDatePayload(data.openingMonth, data.openingYear)
      ? { openingDate: buildOpeningDatePayload(data.openingMonth, data.openingYear) }
      : {}),
    ...(data.structureName ? { holderOrganization: data.structureName } : {}),
    ...(data.managementType
      ? {
          manageModel:
            data.managementType === "autre" && data.managementTypeOther
              ? data.managementTypeOther
              : data.managementType,
        }
      : {}),
    ...buildTypePlace(data.family, data.familyOther),
    ...(data.surfaceBuilt ? { buildingSurfaceArea: Number(data.surfaceBuilt) } : {}),
    ...(data.surfaceOutdoor ? { siteSurfaceArea: Number(data.surfaceOutdoor) } : {}),
    ...(data.videoUrl ? { video: [data.videoUrl] } : {}),
    ...(data.websiteUrl ? { url: data.websiteUrl } : {}),
    ...buildSocialNetwork(data.socialLinks),
    email: data.email,
    ...(data.phone ? { telephone: data.phone } : {}),
    ...(hasAnyOpen ? { openingHours } : {}),
  };

  if (options.costum) {
    payload.type = "NGO";
    payload.preferences = { isOpenData: true, isOpenEdition: true };
    // `role:"admin"` et `mainTag` NE sont PLUS posés ici : redondants avec les PRESETS costum
    // `{role:"admin", mainTag:"TiersLieux"}` que la lib injecte d'office via `me.costum(slug)`
    // (CostumScope.create = `{...presets, ...data}`). `role` est de plus inerte côté serveur
    // (l'admin réel = links.members.isAdmin). Le CHAMP `mainTag` n'a AUCUN effet observatoire
    // (les filtres lisent `tags`, jamais le champ) → seul le merge `tags` ci-dessous compte.
    // NB : le contexte costum (source / costumSlug / costumId / costumType) est aussi injecté par
    // la lib ; le backend pose `source` au save. cf. useAddTiersLieu.
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
