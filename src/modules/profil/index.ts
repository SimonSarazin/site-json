/**
 * Module profil - Export centralisé
 *
 * Ce fichier facilite l'import des fonctionnalités du module profil
 * depuis l'extérieur du module.
 */

// Routes
export { routes } from "./routes";
export type { ModuleRouteFactory } from "@/lib/modules";

// Pages
export { default as ProfilePage } from "./pages/ProfilePage";

// Composants
export { ProfileRenderer } from "./ProfileRenderer";
export { ProfileSectionRenderer } from "./ProfileSectionRenderer";
export { ProfileSeo } from "./ProfileSeo";

// Contexts & Hooks
export { ProfileEntityProvider } from "./contexts/ProfileEntityProvider";
export { ProfileEntityContext } from "./contexts/ProfileEntityContext";
export { useProfileEntity } from "./hooks/useProfileEntity";
export { useFormatProfileEntity } from "./hooks/useFormatProfileEntity";
export { useProfilNewsQuery } from "./hooks/useProfilNewsQuery";
export { useEntityBySlugQuery } from "./hooks/useEntityBySlugQuery";

// Schemas & Types
export type {
  ProfileConfig,
  ProfilesConfig,
  ProfileType,
  ProfileSection,
  ProfileTab,
  ProfileTabCondition,
  ProfileHeaderSection,
  ProfileInfoSection,
  ProfileAboutSection,
  ProfileMapSection,
  ProfileOrganizerSection,
  ProfileMembersSection,
  ProfileGallerySection,
  ProfileRelatedSection,
  ProfileActionsSection,
  ProfileEventDatesSection,
  ProfileBadgesSection,
  ProfileTagsSection,
  ProfileOpeningHoursSection,
  ProfileHeaderCompleteSection,
  ProfileTabLayoutSection,
  ProfileTemplateDefaultSection,
} from "./schema";

export {
  ProfileConfigSchema,
  ProfilesConfigSchema,
  ProfileTypeSchema,
  ProfileSectionSchema,
  ProfileTabSchema,
  ProfileTabConditionSchema,
  ProfileHeaderVariantSchema,
  ProfileInfoVariantSchema,
  ProfileLayoutVariantSchema,
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
} from "./schema";
