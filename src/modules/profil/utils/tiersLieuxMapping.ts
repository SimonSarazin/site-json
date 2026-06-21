import type { TiersLieuxFormData } from "../components/add/TiersLieuxForm";
import { getDefaultTiersLieuxValues } from "../components/add/TiersLieuxForm";
import { transformFormDataWithAddress } from "../hooks/mutationUtils";

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

export function mapEntityToTiersLieuxValues(entity: EntityLike): TiersLieuxFormData {
  const data = entity.serverData ?? {};
  const defaults = getDefaultTiersLieuxValues();
  const opening = parseOpeningDate(data.openingDate);
  const family = parseFamily(data.typePlace);
  const management = parseManagementType(data.manageModel);
  const address = (data.address ?? {}) as Record<string, unknown>;
  const video = Array.isArray(data.video) ? data.video : [];

  return {
    ...defaults,
    name: pickString(data.name),
    shortDescription: pickString(data.shortDescription),
    description: pickString(data.description),
    openingMonth: opening.month,
    openingYear: opening.year,
    structureName: pickString(data.holderOrganization),
    managementType: management.managementType,
    managementTypeOther: management.managementTypeOther,
    family: family.family,
    familyOther: pickString(data.typePlaceOther) || family.familyOther,
    surfaceBuilt: pickNumberString(data.buildingSurfaceArea),
    surfaceOutdoor: pickNumberString(data.siteSurfaceArea),
    addressCountry: pickString(address.addressCountry),
    addressLocality: pickString(address.addressLocality),
    postalCode: pickString(address.postalCode),
    streetAddress: pickString(address.streetAddress),
    localityId: pickString(address.localityId),
    websiteUrl: pickString(data.url),
    socialLinks: parseSocialLinks(data.socialNetwork),
    hours: parseOpeningHours(data.openingHours),
    email: pickString(data.email),
    phone: pickString(data.telephone),
    videoUrl: pickString(video[0]),
  };
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
