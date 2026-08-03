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
export { ProfileEntityContext, type ProfileEntityContextType } from "./contexts/ProfileEntityContext";
export { useProfileEntity, useOptionalProfileEntity } from "./hooks/useProfileEntity";
export { useFormatProfileEntity } from "./hooks/useFormatProfileEntity";

// Prefetch
export { prefetchProfileQuery } from "./prefetch";

// Types centralisés
export type {
  EntityAction,
  EntityActionsResult,
  UserAction,
  RelationType,
  RelatedEntitiesParams,
  UseRelatedEntitiesResult,
  MemberQueryOptions,
  MemberQueryParams,
  FriendsQueryParams,
  ConfirmationState,
} from "./types";

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
  ProfileDocumentsSection,
  ProfileRelatedSection,
  ProfileActionsSection,
  ProfileEventDatesSection,
  ProfileBadgesSection,
  ProfileTagsSection,
  ProfileOpeningHoursSection,
  ProfileTabLayoutSection,
  MemberSection,
  MemberSectionProps,
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
  ProfileDocumentsSectionSchema,
  ProfileRelatedSectionSchema,
  ProfileActionsSectionSchema,
  ProfileEventDatesSectionSchema,
  ProfileBadgesSectionSchema,
  ProfileTagsSectionSchema,
  ProfileOpeningHoursSectionSchema,
  ProfileTabLayoutSectionSchema,
  MemberSectionSchema,
} from "./schema";

// Query keys centralisés (single source of truth)
export { PROFIL_QUERY_KEYS } from "./constants/queryKeys";
export type { ProfilQueryKeyType } from "./constants/queryKeys";
