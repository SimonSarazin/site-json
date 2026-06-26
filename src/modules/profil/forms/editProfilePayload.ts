/**
 * Mapping form ↔ profil, par type d'entité, via le pipeline générique (P4/S5). Descripteurs UNIFIÉS
 * read+write : `buildProfileUpdateData` délègue à `valuesToPayload` (WRITE, ignore `read`) et
 * `seedProfileFormValues` à `seedFromEntity` (READ, ignore `write`/`readOnly`). Fin du miroir READ/WRITE :
 * `useProfileFormData` consomme désormais ce même descripteur (avant : mapping manuel). Comportement
 * byte-identique à l'ancien (prouvé par editProfilePayload.test.ts + useProfileFormData.equiv.test.ts).
 *
 * Asymétries câblées par les flags du moteur :
 *  - social : groupe `groupReadOnly` (READ = décompose l'objet `socialNetwork` → 9 champs plats ; WRITE =
 *    9 clés plates top-level, re-nichées par le legacy updateblock UPDATE_BLOCK_SOCIAL).
 *  - `public` (event) / `urls` (poi) : `readOnly` (lus, jamais réécrits par cette voie).
 * cf. doc/refactor-field-treatment.md (P4/S5).
 */
import { DAYS, widgetFormatters } from "@/constants/DAYS";
import { formatISO } from "date-fns";
import type { FieldDescriptor, FormDescriptor, FormValues } from "@/modules/formEngine";
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import "@/modules/formEngine/engine/coercions"; // side-effect : enregistre les coerce:* (orEmpty/orUndef/arrayOrEmpty/truthy/dateISO/dateYMDfromISO) référencés par clé ci-dessous
import { seedEntity, buildPayload, type FormSpec, type EntityLike } from "@/modules/formEngine/engine/entityForm";
import { buildAddressFromForm } from "../hooks/mutationUtils"; // builder d'adresse UNIQUE (partagé poi/costums/profil)
// Imports DIRECTS de la couche config (PAS le barrel → pas de widgets/React tirés, le module reste pur).
import { formDescriptorToConfig } from "@/modules/formEngine/config/formDescriptorToConfig";
import { configToDescriptor } from "@/modules/formEngine/config/configToDescriptor";
import "./geoTransforms"; // enregistre geo:write / geoPosition:write (partagés, liés à localityId)

type Data = Record<string, unknown>;

const ADDRESS_KEYS = [
  "addressCountry", "streetAddress", "postalCode", "addressLocality", "localityId",
  "level1", "level1Name", "level2", "level2Name", "level3", "level3Name", "level4", "level4Name", "codeInsee",
] as const;
const SOCIAL_KEYS = ["github", "gitlab", "facebook", "twitter", "instagram", "diaspora", "mastodon", "telegram", "signal"] as const;

const buildTags = (v: unknown) => (Array.isArray(v) && v.length > 0 ? v : "");

// 7 entrées par jour (Mo..Su) ; "" pour les jours non renseignés.
function buildOpeningHours(v: unknown) {
  const arr = Array.isArray(v) ? v : [];
  return DAYS.map((day) => {
    const match = arr.find(
      (o): o is { dayOfWeek: string; hours: { opens: string; closes: string }[] } =>
        typeof o === "object" && o !== null && (o as { dayOfWeek?: unknown }).dayOfWeek === day,
    );
    return match || "";
  });
}

// Référence d'entité (parent/organizer) : ne garde que name + type par entrée. Vide → `undefined` (clé
// OMISE par buildPayload, cf. valuesToPayload emitEmpty=false), JAMAIS "" : le bloc d'édition standard
// UPDATE_BLOCK_INFO[projects].parent n'accepte QUE l'objet (pas de branche ""), contrairement à
// ADD_EVENT.parent (oneOf objet|""). Omettre la réf absente est byte-sûr partout (rien à modifier).
function buildEntityReference(ref: unknown) {
  if (!ref || typeof ref !== "object") return undefined;
  const entries = Object.entries(ref as Record<string, unknown>);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(
    entries.map(([id, ent]) => [id, { name: (ent as { name?: string }).name, type: (ent as { type?: string }).type }]),
  );
}

// ── Transformers WRITE (side-effect) ─────────────────────────────────────────
// coerce:orEmpty (`v || ""`) / coerce:orUndef (`v || undefined`) sont désormais GÉNÉRIQUES (formEngine/coercions).
registerTransform("pf:tags", buildTags);
registerTransform("pf:recurrency", (v) => v || false);
registerTransform("pf:timeZone", (v) => v || Intl.DateTimeFormat().resolvedOptions().timeZone);
registerTransform("pf:isoDate", (v) => (typeof v === "string" ? formatISO(new Date(v)) : undefined)); // `if (typeof === string)`
registerTransform("pf:entityRef", buildEntityReference);
// Provided (array) → 7-DOW ; NON fourni (undefined, ex. form de création sans openingHours) → omis
// (évite de sur-émettre un tableau 7-vides au CREATE, non strippé par le backend). L'édition fournit
// toujours le tableau (form complet) → 7-DOW, ou [] tout-fermé → 7-vides = clear.
registerTransform("pf:openingHours", (v) => (Array.isArray(v) ? buildOpeningHours(v) : undefined));
// Adresse profil = builder UNIQUE buildAddressFromForm, gate "countryLocality" (pays+ville+localityId, parité
// de l'ex-buildAddress) ; abandon → "" (l'ex-buildAddress retournait "", buildAddressFromForm renvoie undefined).
registerTransform("pf:addressWrite", (_v, all) =>
  buildAddressFromForm((all ?? {}) as Parameters<typeof buildAddressFromForm>[0], { gate: "countryLocality" }) ?? "");

// ── Transformers READ ────────────────────────────────────────────────────────
// Adresse (objet serveur → 14 champs plats) + social (objet socialNetwork → 9 champs plats), via les groupes.
registerTransform("pf:addressRead", (v) => {
  const a = (v ?? {}) as Data;
  return Object.fromEntries(ADDRESS_KEYS.map((k) => [k, a[k] || ""]));
});
registerTransform("pf:socialRead", (v) => {
  const sn = (v ?? {}) as Data;
  return Object.fromEntries(SOCIAL_KEYS.map((k) => [k, sn[k] || ""]));
});
// coerce:arrayOrEmpty (rdArr) / coerce:truthy (rdBool) / coerce:dateYMDfromISO (rdDateYMD birthDate) /
// coerce:dateISO (rdDateISO start/endDate) : désormais GÉNÉRIQUES (formEngine/coercions).
registerTransform("pf:rdRefOrUndef", (v) => v ?? undefined);        // `serverData.parent ?? undefined`
registerTransform("pf:rdOrganizer", (v) => v ?? {});               // `serverData.organizer ?? {}`
registerTransform("pf:rdPublic", (v) => v !== false);              // `serverData.public !== false`
registerTransform("pf:rdOpeningHours", (v) =>
  Array.isArray(v) ? widgetFormatters.openingHours(v).filter((d: { hours: unknown[] }) => d.hours.length > 0) : []);

// ── Helpers descripteur ──────────────────────────────────────────────────────
// f(name, read, write?, type?, extra?) — champ unifié read+write. `read`/`write` = transformers nommés
// (undefined = identité). Membre de groupe via `extra.group` ; lecture seule via `extra.readOnly`.
const f = (
  name: string,
  read?: string,
  write?: string,
  type: FieldDescriptor["type"] = "string",
  extra: Partial<FieldDescriptor> = {},
): FieldDescriptor => ({
  name, type, widget: "hidden", label: name,
  ...(read ? { read } : {}), ...(write ? { write } : {}), ...extra,
});

const ADDR_GROUP = { address: { serverKey: "address", read: "pf:addressRead", write: "pf:addressWrite" } };
const SOCIAL_GROUP = { social: { serverKey: "socialNetwork", read: "pf:socialRead", write: "coerce:orEmpty", groupReadOnly: true } };
const ADDR_MEMBERS = Object.fromEntries(ADDRESS_KEYS.map((k) => [k, f(k, undefined, undefined, "string", { group: "address" })]));
// Social : membres du groupe `groupReadOnly` → READ décompose l'objet, WRITE émet chaque clé à plat (pf:orEmpty).
const SOCIAL_FIELDS = Object.fromEntries(SOCIAL_KEYS.map((k) => [k, f(k, undefined, "coerce:orEmpty", "string", { group: "social" })]));
// geo/geoPosition : writeOnly (posés par EditLocationTab AVEC l'adresse), émis via les transforms PARTAGÉS
// liés à localityId (cf. forms/geoTransforms) → posé→émis, non touché→omis/préservé, adresse effacée→clear.
const GEO_FIELDS: Record<string, FieldDescriptor> = {
  geo: { name: "geo", type: "object", widget: "hidden", label: "geo", writeOnly: true, write: "geo:write" },
  geoPosition: { name: "geoPosition", type: "object", widget: "hidden", label: "geoPosition", writeOnly: true, write: "geoPosition:write" },
};

const base = (id: string, groups: Record<string, unknown>): Omit<FormDescriptor, "fields"> =>
  ({ id: `edit-${id}`, collection: "organizations", layout: { kind: "flat" }, sections: [], serializeGroups: groups as FormDescriptor["serializeGroups"] });

// Champs communs (name/slug identité au WRITE, orEmpty au READ ; desc/contact orEmpty des deux côtés).
const COMMON = {
  name: f("name", "coerce:orEmpty"), slug: f("slug", "coerce:orEmpty"),
  shortDescription: f("shortDescription", "coerce:orEmpty", "coerce:orEmpty"),
  description: f("description", "coerce:orEmpty", "coerce:orEmpty"),
  url: f("url", "coerce:orEmpty", "coerce:orEmpty"), email: f("email", "coerce:orEmpty", "coerce:orEmpty"),
  tags: f("tags", "coerce:arrayOrEmpty", "pf:tags", "array"),
};

/**
 * Descripteurs PIPELINE unifiés (read/write/group/serializeGroups, widgets `hidden`), PARTAGÉS par add+edit.
 * Exportés pour la DÉRIVATION config (mergeRenderPipeline) : un descripteur render (add/edit) + ce pipeline
 * → un descripteur unifié config-convertible, sans dupliquer le pipeline. cf. mergeRenderPipeline.ts.
 */
export const PROFIL_DESCRIPTORS: Record<string, FormDescriptor> = {
  citoyens: { ...base("citoyens", { ...ADDR_GROUP, ...SOCIAL_GROUP }), fields: {
    name: COMMON.name, slug: COMMON.slug, shortDescription: COMMON.shortDescription, description: COMMON.description,
    url: COMMON.url, email: COMMON.email,
    mobile: f("mobile", "coerce:orEmpty", "coerce:orEmpty"), fixe: f("fixe", "coerce:orEmpty", "coerce:orEmpty"),
    birthDate: f("birthDate", "coerce:dateYMDfromISO", "coerce:orEmpty"),
    tags: COMMON.tags, ...ADDR_MEMBERS, ...GEO_FIELDS, ...SOCIAL_FIELDS,
  } },
  organizations: { ...base("organizations", { ...ADDR_GROUP, ...SOCIAL_GROUP }), fields: {
    name: COMMON.name, slug: COMMON.slug, shortDescription: COMMON.shortDescription, description: COMMON.description,
    url: COMMON.url, email: COMMON.email,
    type: f("type", undefined, "coerce:orUndef"),
    openingHours: f("openingHours", "pf:rdOpeningHours", "pf:openingHours", "array"),
    tags: COMMON.tags, ...ADDR_MEMBERS, ...GEO_FIELDS, ...SOCIAL_FIELDS,
  } },
  projects: { ...base("projects", { ...ADDR_GROUP, ...SOCIAL_GROUP }), fields: {
    name: COMMON.name, slug: COMMON.slug, shortDescription: COMMON.shortDescription, description: COMMON.description,
    url: COMMON.url, email: COMMON.email,
    avancement: f("avancement", undefined, "coerce:orUndef"),
    parent: f("parent", "pf:rdRefOrUndef", "pf:entityRef", "object"),
    tags: COMMON.tags, ...ADDR_MEMBERS, ...GEO_FIELDS, ...SOCIAL_FIELDS,
  } },
  events: { ...base("events", ADDR_GROUP), fields: {
    name: COMMON.name, slug: COMMON.slug, shortDescription: COMMON.shortDescription,
    url: COMMON.url, email: COMMON.email,
    type: f("type", undefined, "coerce:orUndef"),
    recurrency: f("recurrency", "coerce:truthy", "pf:recurrency", "boolean"),
    startDate: f("startDate", "coerce:dateISO", "pf:isoDate"), endDate: f("endDate", "coerce:dateISO", "pf:isoDate"),
    timeZone: f("timeZone", "coerce:orEmpty", "pf:timeZone"),
    parent: f("parent", "pf:rdRefOrUndef", "pf:entityRef", "object"),
    organizer: f("organizer", "pf:rdOrganizer", "pf:entityRef", "object"),
    public: f("public", "pf:rdPublic", undefined, "boolean", { readOnly: true }),
    tags: COMMON.tags,
    openingHours: f("openingHours", "pf:rdOpeningHours", "pf:openingHours", "array"),
    ...ADDR_MEMBERS, ...GEO_FIELDS,
  } },
  poi: { ...base("poi", ADDR_GROUP), fields: {
    name: COMMON.name, slug: COMMON.slug,
    description: COMMON.description, type: f("type", undefined, "coerce:orUndef"),
    urls: f("urls", "coerce:arrayOrEmpty", undefined, "array", { readOnly: true }),
    tags: COMMON.tags, ...ADDR_MEMBERS, ...GEO_FIELDS,
  } },
};

/**
 * Spec read+write par entité — CONFIG-DRIVEN : chaque pipeline tourne sur le descripteur ISSU DE LA CONFIG
 * (`configToDescriptor(formDescriptorToConfig(...))`, round-trip identique → parité byte garantie). READ
 * (`seedProfileFormValues`) et WRITE (`buildProfileUpdateData`) passent donc par la config pour les 5 entités.
 * Labels gardés = clés i18n (résolus au rendu par GenericForm). cf. tiers-lieu (même geste).
 */
const KEEP_KEYS = (l: unknown) => (typeof l === "string" ? l : ((l as { fr?: string })?.fr ?? ""));
const PROFIL_SPECS: Record<string, FormSpec> = Object.fromEntries(
  Object.entries(PROFIL_DESCRIPTORS).map(([k, descriptor]) => [
    k,
    { descriptor: configToDescriptor(formDescriptorToConfig(descriptor), { tLoc: KEEP_KEYS }) },
  ]),
);

export function buildProfileUpdateData(entityType: string, data: Data): Record<string, unknown> {
  const spec = PROFIL_SPECS[entityType];
  if (!spec) return { name: data.name, slug: data.slug };
  return buildPayload(spec, data as FormValues) as Record<string, unknown>;
}

/** READ : entité serveur → valeurs de form (pipeline). `null` si type non géré. cf. useProfileFormData. */
export function seedProfileFormValues(entityType: string, entity: EntityLike): Record<string, unknown> | null {
  const spec = PROFIL_SPECS[entityType];
  if (!spec) return null;
  return seedEntity(spec, entity) as Record<string, unknown>;
}
