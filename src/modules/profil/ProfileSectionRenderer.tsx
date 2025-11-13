import { lazy } from "react";
import type { ProfileAboutSection, ProfileGallerySection, ProfileHeaderSection, ProfileInfoSection, ProfileMapSection, ProfileMembersSection, ProfileOrganizerSection, ProfileRelatedSection, ProfileSection } from "@/modules/profil/schema";
import type { Section } from "@/types/site-schema";
import { SectionRenderer } from "@/components/sections/SectionRenderer";

// Lazy load des sections
const ProfileHeader = lazy(() => import("./components/sections/ProfileHeader"));
const ProfileInfo = lazy(() => import("./components/sections/ProfileInfo"));
const ProfileAbout = lazy(() => import("./components/sections/ProfileAbout"));
const ProfileMap = lazy(() => import("./components/sections/ProfileMap"));
const ProfileOrganizer = lazy(() => import("./components/sections/ProfileOrganizer"));
const ProfileMembers = lazy(() => import("./components/sections/ProfileMembers"));
const ProfileGallery = lazy(() => import("./components/sections/ProfileGallery"));
const ProfileRelated = lazy(() => import("./components/sections/ProfileRelated"));

// Lazy load des templates
const ProfileTemplateDefault = lazy(() => import("./components/templates/ProfileTemplateDefault"));

interface ProfileSectionRendererProps {
  section: ProfileSection;
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

export function ProfileSectionRenderer({ section }: ProfileSectionRendererProps) {
  // Check if it's a profile-specific section
  const isProfileSection = PROFILE_SECTION_TYPES.includes(section.type as typeof PROFILE_SECTION_TYPES[number]);

  if (!isProfileSection) {
    // It's a site section - use the SectionRenderer
    return <SectionRenderer section={section as Section} />;
  }

  // Handle profile-specific sections
  switch (section.type) {
    case "profile-header":
      return <ProfileHeader section={section as ProfileHeaderSection} />;

    case "profile-info":
      return <ProfileInfo section={section as ProfileInfoSection} />;

    case "profile-about":
      return <ProfileAbout section={section as ProfileAboutSection} />;

    case "profile-map":
      return <ProfileMap section={section as ProfileMapSection} />;

    case "profile-organizer":
      return <ProfileOrganizer section={section as ProfileOrganizerSection} />;

    case "profile-members":
      return <ProfileMembers section={section as ProfileMembersSection} />;

    case "profile-gallery":
      return <ProfileGallery section={section as ProfileGallerySection} />;

    case "profile-related":
      return <ProfileRelated section={section as ProfileRelatedSection} />;

    case "profile-template-default":
      return <ProfileTemplateDefault />;

    default: {
      const unknownSection = section as { type: string };
      console.warn(`Unknown profile section type: ${unknownSection.type}`);
      return null;
    }
  }
}
