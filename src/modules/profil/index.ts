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

// Schemas & Types
export type {
  ProfileConfig,
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
  ProfileSectionSchema,
} from "./schema";
