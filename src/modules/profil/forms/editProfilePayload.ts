/**
 * Mapping form → payload d'édition de profil, par type d'entité. Migré (P4) vers le pipeline générique :
 * `buildProfileUpdateData` délègue à `valuesToPayload(PROFIL_WRITE_DESCRIPTORS[entityType])`. Les helpers
 * (adresse/social/tags/horaires/refs) sont enregistrés en transformers nommés et PARTAGÉS avec le READ
 * (`useProfileFormData`, voie B) → fin du miroir READ/WRITE. Comportement byte-identique à l'ancien switch
 * (prouvé par editProfilePayload.test.ts). cf. doc/refactor-field-treatment.md (P4).
 */
import { DAYS } from "@/constants/DAYS";
import { formatISO } from "date-fns";
import type { FieldDescriptor, FormDescriptor, FormValues } from "@/modules/formEngine";
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import { buildPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";

type Data = Record<string, unknown>;

const ADDRESS_KEYS = [
  "addressCountry", "streetAddress", "postalCode", "addressLocality", "localityId",
  "level1", "level1Name", "level2", "level2Name", "level3", "level3Name", "level4", "level4Name", "codeInsee",
] as const;
const SOCIAL_KEYS = ["github", "gitlab", "facebook", "twitter", "instagram", "diaspora", "mastodon", "telegram", "signal"] as const;

// Adresse : champs plats → objet PostalAddress, OU "" si pas de pays+ville+localityId (abandon silencieux, legacy).
function buildAddress(data: Data): Record<string, unknown> | "" {
  if (data.addressCountry && data.addressLocality && data.localityId) {
    const address: Record<string, unknown> = {
      "@type": "PostalAddress",
      addressCountry: data.addressCountry,
      addressLocality: data.addressLocality,
      localityId: data.localityId,
      level1: data.level1 || "",
      level1Name: data.level1Name || "",
      codeInsee: data.codeInsee || "",
    };
    if (data.level2) address.level2 = data.level2;
    if (data.level2Name) address.level2Name = data.level2Name;
    if (data.level3) address.level3 = data.level3;
    if (data.level3Name) address.level3Name = data.level3Name;
    if (data.level4) address.level4 = data.level4;
    if (data.level4Name) address.level4Name = data.level4Name;
    if (data.postalCode) address.postalCode = data.postalCode;
    if (data.streetAddress) address.streetAddress = data.streetAddress;
    return address;
  }
  return "";
}

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

// Référence d'entité (parent/organizer) : ne garde que name + type par entrée ; "" si vide.
function buildEntityReference(ref: unknown) {
  if (!ref || typeof ref !== "object") return "";
  const entries = Object.entries(ref as Record<string, unknown>);
  if (entries.length === 0) return "";
  return Object.fromEntries(
    entries.map(([id, ent]) => [id, { name: (ent as { name?: string }).name, type: (ent as { type?: string }).type }]),
  );
}

// ── Transformers WRITE (side-effect) ─────────────────────────────────────────
registerTransform("pf:orEmpty", (v) => v || "");                 // `data.x || ""` (toujours émis)
registerTransform("pf:orUndef", (v) => v || undefined);           // conditionnel (`if (data.x)`) → omis si vide
registerTransform("pf:tags", buildTags);
registerTransform("pf:recurrency", (v) => v || false);
registerTransform("pf:timeZone", (v) => v || Intl.DateTimeFormat().resolvedOptions().timeZone);
registerTransform("pf:isoDate", (v) => (typeof v === "string" ? formatISO(new Date(v)) : undefined)); // `if (typeof === string)`
registerTransform("pf:entityRef", buildEntityReference);
registerTransform("pf:openingHours", buildOpeningHours);
registerTransform("pf:addressWrite", (_v, all) => buildAddress((all ?? {}) as Data));
// READ adresse (objet serveur → 14 champs plats) — utilisé par le READ (P4) ; déclaré ici pour le groupe.
registerTransform("pf:addressRead", (v) => {
  const a = (v ?? {}) as Data;
  return Object.fromEntries(ADDRESS_KEYS.map((k) => [k, a[k] || ""]));
});

// ── Descripteurs WRITE par entité ────────────────────────────────────────────
const w = (name: string, write?: string, type: FieldDescriptor["type"] = "string"): FieldDescriptor =>
  ({ name, type, widget: "hidden", label: name, ...(write ? { write } : {}) });
const ADDR_GROUP = { address: { serverKey: "address", read: "pf:addressRead", write: "pf:addressWrite" } };
const ADDR_MEMBERS = Object.fromEntries(ADDRESS_KEYS.map((k) => [k, { name: k, type: "string", widget: "hidden", label: k, group: "address" } as FieldDescriptor]));
const SOCIAL_FIELDS = Object.fromEntries(SOCIAL_KEYS.map((k) => [k, w(k, "pf:orEmpty")]));
const base = (id: string): Omit<FormDescriptor, "fields"> => ({ id: `edit-${id}`, collection: "organizations", layout: { kind: "flat" }, sections: [], serializeGroups: ADDR_GROUP });

const PROFIL_WRITE_DESCRIPTORS: Record<string, FormDescriptor> = {
  citoyens: { ...base("citoyens"), fields: {
    name: w("name"), slug: w("slug"),
    shortDescription: w("shortDescription", "pf:orEmpty"), description: w("description", "pf:orEmpty"),
    url: w("url", "pf:orEmpty"), email: w("email", "pf:orEmpty"),
    mobile: w("mobile", "pf:orEmpty"), fixe: w("fixe", "pf:orEmpty"), birthDate: w("birthDate", "pf:orEmpty"),
    tags: w("tags", "pf:tags", "array"), ...ADDR_MEMBERS, ...SOCIAL_FIELDS,
  } },
  organizations: { ...base("organizations"), fields: {
    name: w("name"), slug: w("slug"),
    shortDescription: w("shortDescription", "pf:orEmpty"), description: w("description", "pf:orEmpty"),
    url: w("url", "pf:orEmpty"), email: w("email", "pf:orEmpty"),
    type: w("type", "pf:orUndef"), tags: w("tags", "pf:tags", "array"),
    openingHours: w("openingHours", "pf:openingHours", "array"), ...ADDR_MEMBERS, ...SOCIAL_FIELDS,
  } },
  projects: { ...base("projects"), fields: {
    name: w("name"), slug: w("slug"),
    shortDescription: w("shortDescription", "pf:orEmpty"), description: w("description", "pf:orEmpty"),
    url: w("url", "pf:orEmpty"), email: w("email", "pf:orEmpty"),
    avancement: w("avancement", "pf:orUndef"), parent: w("parent", "pf:entityRef", "object"),
    tags: w("tags", "pf:tags", "array"), ...ADDR_MEMBERS, ...SOCIAL_FIELDS,
  } },
  events: { ...base("events"), fields: {
    name: w("name"), slug: w("slug"),
    shortDescription: w("shortDescription", "pf:orEmpty"), url: w("url", "pf:orEmpty"), email: w("email", "pf:orEmpty"),
    type: w("type", "pf:orUndef"), recurrency: w("recurrency", "pf:recurrency", "boolean"),
    startDate: w("startDate", "pf:isoDate"), endDate: w("endDate", "pf:isoDate"), timeZone: w("timeZone", "pf:timeZone"),
    parent: w("parent", "pf:entityRef", "object"), organizer: w("organizer", "pf:entityRef", "object"),
    tags: w("tags", "pf:tags", "array"), openingHours: w("openingHours", "pf:openingHours", "array"), ...ADDR_MEMBERS,
  } },
  poi: { ...base("poi"), fields: {
    name: w("name"), slug: w("slug"),
    description: w("description", "pf:orEmpty"), type: w("type", "pf:orUndef"),
    tags: w("tags", "pf:tags", "array"), ...ADDR_MEMBERS,
  } },
};

/** Spec WRITE par entité (pattern unifié). READ (seedEntity) sera branché en migrant useProfileFormData. */
const PROFIL_SPECS: Record<string, FormSpec> = Object.fromEntries(
  Object.entries(PROFIL_WRITE_DESCRIPTORS).map(([k, descriptor]) => [k, { descriptor }]),
);

export function buildProfileUpdateData(entityType: string, data: Data): Record<string, unknown> {
  const spec = PROFIL_SPECS[entityType];
  if (!spec) return { name: data.name, slug: data.slug };
  return buildPayload(spec, data as FormValues) as Record<string, unknown>;
}
