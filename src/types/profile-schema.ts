import { z } from "zod";
import { LocalizedString } from "./locale-schema";

// Types d'entités supportés
export const ProfileTypeSchema = z.enum([
  "events",
  "organizations",
  "projects",
  "citoyens",
  "poi"
]);

export type ProfileType = z.infer<typeof ProfileTypeSchema>;

// Variantes de sections de profil
export const ProfileHeaderVariantSchema = z.enum(["hero", "simple", "cover", "minimal"]);
export const ProfileInfoVariantSchema = z.enum(["sidebar", "inline", "tabs"]);
export const ProfileLayoutVariantSchema = z.enum(["default", "modern", "compact", "full-width"]);

// Sections de profil
export const ProfileHeaderSectionSchema = z.object({
  type: z.literal("profile-header"),
  variant: ProfileHeaderVariantSchema.optional().default("hero"),
  showBackButton: z.boolean().optional().default(true),
  showShareButton: z.boolean().optional().default(true),
  showEditButton: z.boolean().optional().default(false),
});

export const ProfileInfoSectionSchema = z.object({
  type: z.literal("profile-info"),
  variant: ProfileInfoVariantSchema.optional().default("sidebar"),
  showAddress: z.boolean().optional().default(true),
  showDates: z.boolean().optional().default(true),
  showOrganizer: z.boolean().optional().default(true),
  showAttendees: z.boolean().optional().default(true),
});

export const ProfileAboutSectionSchema = z.object({
  type: z.literal("profile-about"),
  showDescription: z.boolean().optional().default(true),
  showShortDescription: z.boolean().optional().default(true),
  markdownEnabled: z.boolean().optional().default(true),
});

export const ProfileMapSectionSchema = z.object({
  type: z.literal("profile-map"),
  height: z.string().optional().default("400px"),
  zoom: z.number().optional().default(15),
  showMarker: z.boolean().optional().default(true),
});

export const ProfileOrganizerSectionSchema = z.object({
  type: z.literal("profile-organizer"),
  title: LocalizedString.optional(),
  showLogo: z.boolean().optional().default(true),
  showDescription: z.boolean().optional().default(true),
  showLink: z.boolean().optional().default(true),
});

export const ProfileMembersSectionSchema = z.object({
  type: z.literal("profile-members"),
  title: LocalizedString.optional(),
  limit: z.number().optional(),
  showRole: z.boolean().optional().default(true),
});

export const ProfileGallerySectionSchema = z.object({
  type: z.literal("profile-gallery"),
  title: LocalizedString.optional(),
  columns: z.number().optional().default(3),
  lightbox: z.boolean().optional().default(true),
});

export const ProfileRelatedSectionSchema = z.object({
  type: z.literal("profile-related"),
  title: LocalizedString.optional(),
  relationType: z.enum(["parent", "children", "projects", "events"]).optional(),
  limit: z.number().optional().default(4),
});

// Profile-specific sections union
const ProfileOnlySectionSchema = z.discriminatedUnion("type", [
  ProfileHeaderSectionSchema,
  ProfileInfoSectionSchema,
  ProfileAboutSectionSchema,
  ProfileMapSectionSchema,
  ProfileOrganizerSectionSchema,
  ProfileMembersSectionSchema,
  ProfileGallerySectionSchema,
  ProfileRelatedSectionSchema,
]);

// Union of profile sections + any site section (to avoid circular dependency)
// Site sections will be validated at runtime by the site schema
export const ProfileSectionSchema = z.union([
  ProfileOnlySectionSchema,
  z.object({
    type: z.string(),
    id: z.string().optional(),
    props: z.any().optional(),
  }).passthrough(), // Allow any site section structure
]);

export type ProfileSection = z.infer<typeof ProfileSectionSchema>;

// Configuration d'un type de profil
export const ProfileConfigSchema = z.object({
  layout: ProfileLayoutVariantSchema.optional().default("default"),
  sections: z.array(ProfileSectionSchema),
  seo: z.object({
    titleTemplate: z.string().optional(),
    descriptionTemplate: z.string().optional(),
  }).optional(),
});

export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;

// Configuration de tous les profils
export const ProfilesConfigSchema = z.record(
  ProfileTypeSchema,
  ProfileConfigSchema
).optional();

export type ProfilesConfig = z.infer<typeof ProfilesConfigSchema>;
