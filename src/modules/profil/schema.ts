import { z } from "zod";
import { LocalizedString } from "../../types/locale-schema";

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
export const ProfileHeaderVariantSchema = z.enum(["hero", "simple", "cover", "minimal", "banner-overlay"]);
export const ProfileInfoVariantSchema = z.enum(["sidebar", "inline", "tabs"]);
export const ProfileLayoutVariantSchema = z.enum(["default", "modern", "compact", "full-width"]);

// Sections de profil
export const ProfileHeaderSectionSchema = z.object({
  type: z.literal("profile-header"),
  variant: ProfileHeaderVariantSchema.optional().default("hero"),
  showBackButton: z.boolean().optional().default(true),
  showShareButton: z.boolean().optional().default(true),
  showEditButton: z.boolean().optional().default(false),
  // Props pour variant "banner-overlay"
  showBanner: z.boolean().optional().default(true),
  showAvatar: z.boolean().optional().default(true),
  bannerHeight: z.string().optional().default("384px"),
  avatarSize: z.string().optional().default("160px"),
  avatarOverlap: z.boolean().optional().default(true),
  showLocation: z.boolean().optional().default(true),
  allowUpload: z.boolean().optional().default(true),
});

export const ProfileInfoSectionSchema = z.object({
  type: z.literal("profile-info"),
  variant: ProfileInfoVariantSchema.optional().default("sidebar"),
  sticky: z.boolean().optional().default(true),
  // Contact info
  showUsername: z.boolean().optional().default(true),
  showEmail: z.boolean().optional().default(true),
  showPhone: z.boolean().optional().default(true),
  showWebsite: z.boolean().optional().default(true),
  // Location & dates
  showAddress: z.boolean().optional().default(true),
  showDates: z.boolean().optional().default(true),
  showOpeningDate: z.boolean().optional().default(true),
  // Related info
  showOrganizer: z.boolean().optional().default(true),
  showAttendees: z.boolean().optional().default(true),
  showCounts: z.boolean().optional().default(true),
  // Actions
  showRegistrationButton: z.boolean().optional().default(true),
});

export const ProfileAboutSectionSchema = z.object({
  type: z.literal("profile-about"),
  showDescription: z.boolean().optional().default(true),
  showShortDescription: z.boolean().optional().default(true),
  showLongDescription: z.boolean().optional().default(true),
  markdownEnabled: z.boolean().optional().default(true),
  layout: z.enum(["column", "grid"]).optional().default("column"),
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
  showManagement: z.boolean().optional().default(false),
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

export const ProfileActionsSectionSchema = z.object({
  type: z.literal("profile-actions"),
  showEditButton: z.boolean().optional().default(true),
  showEntityActions: z.boolean().optional().default(true),
  showEmailButton: z.boolean().optional().default(true),
  showReservationButton: z.boolean().optional().default(false),
  emailButtonLabel: LocalizedString.optional(),
  reservationButtonLabel: LocalizedString.optional(),
  layout: z.enum(["horizontal", "vertical", "grid"]).optional().default("horizontal"),
});

export const ProfileEventDatesSectionSchema = z.object({
  type: z.literal("profile-event-dates"),
  showType: z.boolean().optional().default(true),
  dateFormat: z.string().optional(),
});

export const ProfileBadgesSectionSchema = z.object({
  type: z.literal("profile-badges"),
  title: LocalizedString.optional(),
  showIcon: z.boolean().optional().default(true),
  layout: z.enum(["grid", "flex", "list"]).optional().default("flex"),
  maxDisplay: z.number().optional(),
});

export const ProfileTagsSectionSchema = z.object({
  type: z.literal("profile-tags"),
  title: LocalizedString.optional(),
  maxDisplay: z.number().optional().default(20),
  linkable: z.boolean().optional().default(false),
  searchOnClick: z.boolean().optional().default(false),
});

export const ProfileOpeningHoursSectionSchema = z.object({
  type: z.literal("profile-opening-hours"),
  title: LocalizedString.optional(),
  format: z.enum(["table", "list", "compact"]).optional().default("table"),
  showCurrentStatus: z.boolean().optional().default(false),
});

export const ProfileHeaderCompleteSectionSchema = z.object({
  type: z.literal("profile-header-complete"),
  showBanner: z.boolean().optional().default(true),
  showAvatar: z.boolean().optional().default(true),
  showLocation: z.boolean().optional().default(true),
  showActions: z.boolean().optional().default(true),
});

export const ProfileTabLayoutSectionSchema = z.object({
  type: z.literal("profile-tab-layout"),
  leftSections: z.array(z.unknown()),
  rightSections: z.array(z.unknown()),
});

export const ProfileTemplateDefaultSchema = z.object({
  type: z.literal("profile-template-default"),
  showBackButton: z.boolean().optional().default(true),
  showShareButton: z.boolean().optional().default(true),
  showAddress: z.boolean().optional().default(true),
  showMap: z.boolean().optional().default(true),
  markdownEnabled: z.boolean().optional().default(true),
});

export const ProfileTemplateDynamicSchema = z.object({
  type: z.literal("profile-template-dynamic"),
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
  ProfileActionsSectionSchema,
  ProfileEventDatesSectionSchema,
  ProfileBadgesSectionSchema,
  ProfileTagsSectionSchema,
  ProfileOpeningHoursSectionSchema,
  ProfileHeaderCompleteSectionSchema,
  ProfileTabLayoutSectionSchema,
  ProfileTemplateDefaultSchema,
  ProfileTemplateDynamicSchema,
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

// Schema pour les conditions d'affichage des tabs
export const ProfileTabConditionSchema = z.object({
  entityTypes: z.array(ProfileTypeSchema).optional(),
  permissions: z.array(z.string()).optional(),
  userContext: z.enum(["own", "other", "any"]).optional(),
}).optional();

// Schema pour les sous-routes d'un tab
export const ProfileTabSubRouteSchema = z.object({
  path: z.string(), // ex: ":newsId" pour /profil/:slug/news/:newsId
  component: z.string(), // ex: "NewsDetailPage"
  loader: z.string().optional(), // nom de la fonction loader optionnelle
});

// Schema pour un tab de profil
export const ProfileTabSchema = z.object({
  id: z.string(),
  label: LocalizedString,
  path: z.string().optional(), // chemin URL personnalisé (par défaut = id)

  // Option 1 : Utiliser des sections composables
  sections: z.array(ProfileSectionSchema).optional(),

  // Option 2 : Utiliser un composant dédié
  component: z.enum(["SocialTab", "MembershipTab", "NewsTab"]).optional(),

  // Sous-routes pour les pages de détail (ex: news/:newsId)
  subRoutes: z.array(ProfileTabSubRouteSchema).optional(),

  condition: ProfileTabConditionSchema,
}).refine(
  (data) => (data.sections && data.sections.length > 0) || data.component,
  { message: "Un tab doit avoir soit 'sections' soit 'component'" }
);

export type ProfileTab = z.infer<typeof ProfileTabSchema>;
export type ProfileTabCondition = z.infer<typeof ProfileTabConditionSchema>;
export type ProfileTabSubRoute = z.infer<typeof ProfileTabSubRouteSchema>;

// Configuration d'un type de profil
export const ProfileConfigSchema = z.object({
  layout: ProfileLayoutVariantSchema.optional().default("default"),
  tabs: z.array(ProfileTabSchema).optional(), // NOUVEAU: tabs configurables
  sections: z.array(ProfileSectionSchema), // sections globales (hors tabs)
  hideHeader: z.boolean().optional().default(false), // Option pour cacher le header principal
  hideFooter: z.boolean().optional().default(false), // Option pour cacher le footer principal
  seo: z.object({
    titleTemplate: z.string().optional(),
    descriptionTemplate: z.string().optional(),
  }).optional(),
});

export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;

// Configuration de tous les profils
export const ProfilesConfigSchema = z.object({
  default: ProfileConfigSchema.optional(), // Configuration par défaut pour tous les types
  events: ProfileConfigSchema.optional(),
  organizations: ProfileConfigSchema.optional(),
  projects: ProfileConfigSchema.optional(),
  citoyens: ProfileConfigSchema.optional(),
  poi: ProfileConfigSchema.optional(),
}).optional();

export type ProfilesConfig = z.infer<typeof ProfilesConfigSchema>;

// Types inférés depuis les schémas Zod
export type ProfileHeaderSection = z.infer<typeof ProfileHeaderSectionSchema>;
export type ProfileInfoSection = z.infer<typeof ProfileInfoSectionSchema>;
export type ProfileAboutSection = z.infer<typeof ProfileAboutSectionSchema>;
export type ProfileMapSection = z.infer<typeof ProfileMapSectionSchema>;
export type ProfileOrganizerSection = z.infer<typeof ProfileOrganizerSectionSchema>;
export type ProfileMembersSection = z.infer<typeof ProfileMembersSectionSchema>;
export type ProfileGallerySection = z.infer<typeof ProfileGallerySectionSchema>;
export type ProfileRelatedSection = z.infer<typeof ProfileRelatedSectionSchema>;
export type ProfileActionsSection = z.infer<typeof ProfileActionsSectionSchema>;
export type ProfileEventDatesSection = z.infer<typeof ProfileEventDatesSectionSchema>;
export type ProfileBadgesSection = z.infer<typeof ProfileBadgesSectionSchema>;
export type ProfileTagsSection = z.infer<typeof ProfileTagsSectionSchema>;
export type ProfileOpeningHoursSection = z.infer<typeof ProfileOpeningHoursSectionSchema>;
export type ProfileHeaderCompleteSection = z.infer<typeof ProfileHeaderCompleteSectionSchema>;
export type ProfileTabLayoutSection = z.infer<typeof ProfileTabLayoutSectionSchema>;
export type ProfileTemplateDefaultSection = z.infer<typeof ProfileTemplateDefaultSchema>;