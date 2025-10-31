import { lazy } from "react";
import type { ProfileSection } from "@/types/profile-schema";
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
] as const;

export function ProfileSectionRenderer({
  section,
  entity,
  entityType,
}: ProfileSectionRendererProps) {
  // Check if it's a profile-specific section
  const isProfileSection = PROFILE_SECTION_TYPES.includes(section.type as any);

  if (!isProfileSection) {
    // It's a site section - use the SectionRenderer
    return <SectionRenderer section={section as Section} />;
  }

  // Handle profile-specific sections
  switch (section.type) {
    case "profile-header":
      return <ProfileHeader section={section} entity={entity} />;

    case "profile-info":
      return <ProfileInfo section={section} entity={entity} />;

    case "profile-about":
      return <ProfileAbout section={section} entity={entity} />;

    case "profile-map":
      return <ProfileMap section={section} entity={entity} />;

    case "profile-organizer":
      return <ProfileOrganizer section={section} entity={entity} />;

    case "profile-members":
      return <ProfileMembers section={section} entity={entity} />;

    case "profile-gallery":
      return <ProfileGallery section={section} entity={entity} />;

    case "profile-related":
      return <ProfileRelated section={section} entity={entity} entityType={entityType} />;

    default:
      console.warn(`Unknown profile section type: ${(section as any).type}`);
      return null;
  }
}
