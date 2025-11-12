import { lazy } from "react";
import type { ProfileAboutSection, ProfileGallerySection, ProfileHeaderSection, ProfileInfoSection, ProfileMapSection, ProfileMembersSection, ProfileOrganizerSection, ProfileRelatedSection, ProfileSection, ProfileTemplateDefaultSection } from "@/types/profile-schema";
import type { SearchEntity } from "@/modules/search/schema";
import type { Section } from "@/types/site-schema";
import { SectionRenderer } from "@/components/sections/SectionRenderer";

// Lazy load des sections
const ProfileHeader = lazy(() => import("./sections/ProfileHeader"));
const ProfileInfo = lazy(() => import("./sections/ProfileInfo"));
const ProfileAbout = lazy(() => import("./sections/ProfileAbout"));
const ProfileMap = lazy(() => import("./sections/ProfileMap"));
const ProfileOrganizer = lazy(() => import("./sections/ProfileOrganizer"));
const ProfileMembers = lazy(() => import("./sections/ProfileMembers"));
const ProfileGallery = lazy(() => import("./sections/ProfileGallery"));
const ProfileRelated = lazy(() => import("./sections/ProfileRelated"));

// Lazy load des templates
const ProfileTemplateDefault = lazy(() => import("./templates/ProfileTemplateDefault"));

interface ProfileSectionRendererProps {
  section: ProfileSection;
  entity: SearchEntity;
  entityType: string;
}

// Profile-specific section types
const PROFILE_SECTION_TYPES = [
  "profile-header",
  "profile-info",
  "profile-about",
  "profile-map",
  "profile-organizer",
  "profile-members",
  "profile-gallery",
  "profile-related",
  "profile-template-default",
] as const;

export function ProfileSectionRenderer({
  section,
  entity,
  entityType,
}: ProfileSectionRendererProps) {
  // Check if it's a profile-specific section
  const isProfileSection = PROFILE_SECTION_TYPES.includes(section.type as typeof PROFILE_SECTION_TYPES[number]);

  if (!isProfileSection) {
    // It's a site section - use the SectionRenderer
    return <SectionRenderer section={section as Section} />;
  }

  // Handle profile-specific sections
  switch (section.type) {
    case "profile-header":
      return <ProfileHeader section={section as ProfileHeaderSection} entity={entity} />;

    case "profile-info":
      return <ProfileInfo section={section as ProfileInfoSection} entity={entity} />;

    case "profile-about":
      return <ProfileAbout section={section as ProfileAboutSection} entity={entity} />;

    case "profile-map":
      return <ProfileMap section={section as ProfileMapSection} entity={entity} />;

    case "profile-organizer":
      return <ProfileOrganizer section={section as ProfileOrganizerSection} entity={entity} />;

    case "profile-members":
      return <ProfileMembers section={section as ProfileMembersSection} entity={entity} />;

    case "profile-gallery":
      return <ProfileGallery section={section as ProfileGallerySection} entity={entity} />;

    case "profile-related":
      return <ProfileRelated section={section as ProfileRelatedSection} entity={entity} entityType={entityType} />;

    case "profile-template-default": {
      const templateSection = section as ProfileTemplateDefaultSection;
      return <ProfileTemplateDefault entity={entity} entityType={entityType} config={templateSection} />;
    }

    default: {
      const unknownSection = section as { type: string };
      console.warn(`Unknown profile section type: ${unknownSection.type}`);
      return null;
    }
  }
}
