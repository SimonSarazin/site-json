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
  ProfileHeaderSection,
  ProfileInfoSection,
  ProfileAboutSection,
  ProfileMapSection,
  ProfileOrganizerSection,
  ProfileMembersSection,
  ProfileGallerySection,
  ProfileRelatedSection,
  ProfileTemplateDefaultSection,
} from "./schema";

export {
  ProfileConfigSchema,
  ProfilesConfigSchema,
  ProfileTypeSchema,
  ProfileSectionSchema,
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
  ProfileTemplateDefaultSchema,
} from "./schema";
