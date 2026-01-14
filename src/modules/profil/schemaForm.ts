import { EVENT_TYPES, ORGANIZATION_TYPES, POI_TYPES, PROJECT_AVANCEMENTS } from "@communecter/cocolight-api-client";
import { z } from "zod";

// ============================================================================
// SCHÉMAS PARTAGÉS (réutilisables)
// ============================================================================

// Champ URL optionnel ou vide
const urlOrEmptySchema = z.union([z.url({ error: "validation.url.invalid" }), z.literal("")]);

// Champ date ISO optionnel ou vide (pour birthDate)
const dateOrEmptySchema = z.union([z.iso.date({ error: "validation.date.invalid" }), z.literal("")]);

// Champs partagés pour les tags (edit forms acceptent "" comme valeur vide)
const tagsSchema = z.union([
  z.array(z.string()),
  z.literal("")
]);

// Email optionnel OU vide (pour edit forms qui acceptent le vide)
const emailOrEmptySchema = z.union([
  z.email({ error: "validation.email.invalid" }),
  z.literal("")
]);

// Slug (identique partout)
const slugSchema = z.string()
  .min(3, "validation.slug.minLength")
  .max(100, "validation.slug.maxLength")
  .regex(/^[a-zA-Z0-9]+$/, "validation.slug.format");

// Réseaux sociaux (9 champs)
const socialFieldsSchema = z.object({
  github: urlOrEmptySchema.optional(),
  gitlab: urlOrEmptySchema.optional(),
  facebook: urlOrEmptySchema.optional(),
  twitter: urlOrEmptySchema.optional(),
  instagram: urlOrEmptySchema.optional(),
  diaspora: urlOrEmptySchema.optional(),
  mastodon: urlOrEmptySchema.optional(),
  telegram: urlOrEmptySchema.optional(),
  signal: urlOrEmptySchema.optional(),
});

// Localisation (14 champs, tous optionnels)
const localityFieldsSchema = z.object({
  addressCountry: z.string().optional(),
  streetAddress: z.string().optional(),
  postalCode: z.string().optional(),
  addressLocality: z.string().optional(),
  localityId: z.string().optional(),
  level1: z.string().optional(),
  level1Name: z.string().optional(),
  level2: z.string().optional(),
  level2Name: z.string().optional(),
  level3: z.string().optional(),
  level3Name: z.string().optional(),
  level4: z.string().optional(),
  level4Name: z.string().optional(),
  codeInsee: z.string().optional(),
});

// ============================================================================
// SCHÉMAS PARTAGÉS POUR ADD_BLOCKS
// ============================================================================

// Schéma pour les coordonnées géographiques
const geoSchema = z.object({
  latitude: z.union([z.string(), z.number()]),
  longitude: z.union([z.string(), z.number()]),
});

// Schéma pour la position GeoJSON
const geoPositionSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.array(z.number()).length(2),
});

// Schéma parent (référence entité parente)
const parentSchema = z.record(
  z.string().regex(/^[a-f0-9]{24}$/),
  z.object({
    type: z.string(),
    name: z.string().optional(),
  })
);

// Schéma préférences
const preferencesSchema = z.object({
  isOpenData: z.boolean().default(true),
  isOpenEdition: z.boolean().default(true),
});

// Schéma horaires d'ouverture (réutilisé)
// Note: la validation .length(7) est retirée car elle empêche les tableaux vides
// La validation de longueur est faite dans superRefine quand recurrency=true
const openingHoursSchema = z.array(z.union([
  z.literal(""),
  z.object({
    dayOfWeek: z.enum(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]),
    hours: z.array(z.object({
      opens: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "validation.openingHours.format"),
      closes: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "validation.openingHours.format"),
    })),
  })
]));

// ============================================================================
// USER PROFILE SCHEMA (citoyens)
// ============================================================================

export const userProfileSchema = z.object({
  // UPDATE_BLOCK_INFO
  name: z.string().min(1, "validation.name.required"),
  email: z.email({ error: "validation.email.invalid" }).optional(), // PAS emailOrEmpty (user n'accepte pas le vide)
  url: urlOrEmptySchema.optional(),
  tags: tagsSchema.optional(),
  birthDate: dateOrEmptySchema.optional(),
  fixe: z.string().optional(),
  mobile: z.string().optional(),

  // UPDATE_BLOCK_DESCRIPTION
  shortDescription: z.string().optional(),
  description: z.string().optional(),

  // UPDATE_BLOCK_SLUG
  slug: slugSchema,

  // UPDATE_BLOCK_SOCIAL
  ...socialFieldsSchema.shape,

  // UPDATE_BLOCK_LOCALITY
  ...localityFieldsSchema.shape,
});

export type UserProfileFormData = z.infer<typeof userProfileSchema>;

// ============================================================================
// ORGANIZATION PROFILE SCHEMA
// ============================================================================

export const organizationProfileSchema = z.object({
  // UPDATE_BLOCK_INFO
  name: z.string().min(1, "validation.name.required"),
  email: emailOrEmptySchema.optional(),
  url: urlOrEmptySchema.optional(),
  tags: tagsSchema.optional(),
  type: z.enum(ORGANIZATION_TYPES).optional(),

  // UPDATE_BLOCK_DESCRIPTION
  shortDescription: z.string().optional(),
  description: z.string().optional(),

  // UPDATE_BLOCK_SLUG
  slug: slugSchema,

  // VIRTUAL_OPENING_HOURS (spécifique à Organization)
  openingHours: openingHoursSchema.optional(),

  // UPDATE_BLOCK_SOCIAL
  ...socialFieldsSchema.shape,

  // UPDATE_BLOCK_LOCALITY
  ...localityFieldsSchema.shape,
});

export type OrganizationProfileFormData = z.infer<typeof organizationProfileSchema>;

// ============================================================================
// PROJECT PROFILE SCHEMA
// ============================================================================

export const projectProfileSchema = z.object({
  // UPDATE_BLOCK_INFO
  name: z.string().min(1, "validation.name.required"),
  email: emailOrEmptySchema.optional(),
  url: urlOrEmptySchema.optional(),
  tags: tagsSchema.optional(),
  avancement: z.enum(PROJECT_AVANCEMENTS).optional(),
  parent: parentSchema.optional(),

  // UPDATE_BLOCK_DESCRIPTION
  shortDescription: z.string().optional(),
  description: z.string().optional(),

  // UPDATE_BLOCK_SLUG
  slug: slugSchema,

  // UPDATE_BLOCK_SOCIAL
  ...socialFieldsSchema.shape,

  // UPDATE_BLOCK_LOCALITY
  ...localityFieldsSchema.shape,
});

export type ProjectProfileFormData = z.infer<typeof projectProfileSchema>;

// ============================================================================
// EVENT PROFILE SCHEMA
// Note: Les events sont mis à jour via ADD_EVENT (UPDATE_BLOCKS commentés dans Event.ts)
// ============================================================================

export const eventProfileSchema = z.object({
  // Champs INFO (via ADD_EVENT) - name min(2) pour events
  name: z.string().min(2, "validation.name.minLength"),
  email: emailOrEmptySchema.optional(),
  url: urlOrEmptySchema.optional(),
  tags: tagsSchema.optional(),
  type: z.enum(EVENT_TYPES),
  // organizer est validé manuellement dans onSubmit pour un meilleur contrôle des erreurs
  organizer: parentSchema.optional(),
  parent: parentSchema.optional(),

  // DESCRIPTION
  shortDescription: z.string().optional(),

  // OPTIONS
  public: z.boolean().default(true),
  preferences: z.object({
    isOpenData: z.boolean().default(false),
    isOpenEdition: z.boolean().default(false),
  }).optional(),

  // DATES ET HORAIRES
  timeZone: z.string().optional(),
  recurrency: z.boolean().default(false),
  startDate: z.iso.datetime({ error: "validation.datetime.invalid" }).optional(),
  endDate: z.iso.datetime({ error: "validation.datetime.invalid" }).optional(),
  openingHours: openingHoursSchema.optional(),

  // SLUG
  slug: slugSchema,

  // GEO (optionnel, format objet) - spécifique à Event
  geo: geoSchema.optional(),
  geoPosition: geoPositionSchema.optional(),

  // LOCALITY
  ...localityFieldsSchema.shape,
});
// Note: Les validations conditionnelles (organizer requis, startDate/endDate requis si !recurrency,
// openingHours requis si recurrency) sont faites manuellement dans onSubmit des formulaires
// car superRefine ne s'exécute pas si d'autres validations échouent (bug connu zodResolver)

export type EventProfileFormData = z.infer<typeof eventProfileSchema>;

// ============================================================================
// POI PROFILE SCHEMA
// Note: Poi n'a pas UPDATE_BLOCK_SOCIAL (pas de réseaux sociaux pour les POIs)
// ============================================================================

export const poiProfileSchema = z.object({
  // UPDATE_BLOCK_INFO
  name: z.string().min(1, "validation.name.required"),
  tags: tagsSchema.optional(),
  type: z.enum(POI_TYPES).optional(), // optional pour edit
  urls: z.array(z.string()).optional(),

  // UPDATE_BLOCK_DESCRIPTION (POI n'a pas de shortDescription)
  description: z.string().optional(),

  // UPDATE_BLOCK_SLUG
  slug: slugSchema,

  // UPDATE_BLOCK_LOCALITY (PAS de social, PAS de geo pour POI)
  ...localityFieldsSchema.shape,
});

export type PoiProfileFormData = z.infer<typeof poiProfileSchema>;

// ============================================================================
// ADD_ORGANIZATION SCHEMA
// ============================================================================

export const addOrganizationSchema = z.object({
  // Champs requis - name min(3) pour AddOrganization
  name: z.string().min(3, "validation.name.minLength"),
  type: z.enum(ORGANIZATION_TYPES),
  role: z.enum(["admin", "member"]),

  // Champs optionnels - email SANS vide, tags SANS vide (add forms)
  tags: z.array(z.string()).optional(),
  email: z.email({ error: "validation.email.invalid" }).optional(),
  shortDescription: z.string().optional(),
  url: urlOrEmptySchema.optional(),
  preferences: preferencesSchema.optional(),

  // GEO (spécifique aux add schemas)
  geo: geoSchema.optional(),
  geoPosition: geoPositionSchema.optional(),

  // LOCALITY
  ...localityFieldsSchema.shape,
});

export type AddOrganizationFormData = z.infer<typeof addOrganizationSchema>;

// ============================================================================
// ADD_PROJECT SCHEMA
// ============================================================================

export const addProjectSchema = z.object({
  // Champs requis
  name: z.string().min(1, "validation.name.required"),

  // Champs optionnels - tags SANS vide (add forms)
  parent: parentSchema.optional(),
  public: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
  shortDescription: z.string().optional(),
  url: urlOrEmptySchema.optional(),
  // preferences spécifique à AddProject (avec crowdfunding)
  preferences: z.object({
    isOpenData: z.boolean().default(false),
    isOpenEdition: z.boolean().default(false),
    crowdfunding: z.boolean().default(true),
  }).optional(),

  // GEO (spécifique aux add schemas)
  geo: geoSchema.optional(),
  geoPosition: geoPositionSchema.optional(),

  // LOCALITY
  ...localityFieldsSchema.shape,
});

export type AddProjectFormData = z.infer<typeof addProjectSchema>;

// ============================================================================
// ADD_POI SCHEMA
// ============================================================================

export const addPoiSchema = z.object({
  // Champs requis - type REQUIS pour add (pas .optional())
  name: z.string().min(1, "validation.name.required"),
  type: z.enum(POI_TYPES),

  // Champs optionnels - tags SANS vide (add forms)
  parent: parentSchema.optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  urls: z.array(z.string()).optional(),

  // GEO (spécifique aux add schemas)
  geo: geoSchema.optional(),
  geoPosition: geoPositionSchema.optional(),

  // LOCALITY
  ...localityFieldsSchema.shape,
});

export type AddPoiFormData = z.infer<typeof addPoiSchema>;

// ============================================================================
// ADD_EVENT SCHEMA (simplifié pour le formulaire de création)
// Note: slug est omis car il est généré automatiquement côté serveur
// ============================================================================

export const addEventSchema = eventProfileSchema.omit({ slug: true });

export type AddEventFormData = z.infer<typeof addEventSchema>;

// ============================================================================
// PROFILE FORM HELPERS
// ============================================================================

// Type union de tous les form data pour les profils
export type ProfileFormData =
  | UserProfileFormData
  | OrganizationProfileFormData
  | ProjectProfileFormData
  | EventProfileFormData
  | PoiProfileFormData;

// Mapping entityType -> schema
export const profileSchemas = {
  citoyens: userProfileSchema,
  organizations: organizationProfileSchema,
  projects: projectProfileSchema,
  events: eventProfileSchema,
  poi: poiProfileSchema,
} as const;

// Helper pour obtenir le schéma selon le type d'entité
export function getProfileSchema(entityType: string) {
  return profileSchemas[entityType as keyof typeof profileSchemas] || userProfileSchema;
}
