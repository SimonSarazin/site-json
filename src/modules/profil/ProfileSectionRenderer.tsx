import { lazy } from "react";
import type {
  ProfileAboutSection,
  ProfileGallerySection,
  ProfileHeaderSection,
  ProfileInfoSection,
  ProfileMapSection,
  ProfileMembersSection,
  ProfileOrganizerSection,
  ProfileRelatedSection,
  ProfileActionsSection,
  ProfileEventDatesSection,
  ProfileBadgesSection,
  ProfileTagsSection,
  ProfileOpeningHoursSection,
  ProfileHeaderCompleteSection,
  ProfileTabLayoutSection,
  ProfileSection
} from "@/modules/profil/schema";
import type { Section } from "@/types/site-schema";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { useProfileEntity } from "./hooks/useProfileEntity";

// Lazy load des sections
const ProfileHeader = lazy(() => import("./components/sections/ProfileHeader"));
const ProfileInfo = lazy(() => import("./components/sections/ProfileInfo"));
const ProfileAbout = lazy(() => import("./components/sections/ProfileAbout"));
const ProfileMap = lazy(() => import("./components/sections/ProfileMap"));
const ProfileOrganizer = lazy(() => import("./components/sections/ProfileOrganizer"));
const ProfileMembers = lazy(() => import("./components/sections/ProfileMembers"));
const ProfileGallery = lazy(() => import("./components/sections/ProfileGallery"));
const ProfileRelated = lazy(() => import("./components/sections/ProfileRelated"));
const ProfileActions = lazy(() => import("./components/sections/ProfileActions"));
const ProfileEventDates = lazy(() => import("./components/sections/ProfileEventDates"));
const ProfileBadges = lazy(() => import("./components/sections/ProfileBadges"));
const ProfileTags = lazy(() => import("./components/sections/ProfileTags"));
const ProfileOpeningHours = lazy(() => import("./components/sections/ProfileOpeningHours"));
const ProfileHeaderComplete = lazy(() => import("./components/sections/ProfileHeaderComplete"));
const ProfileTabLayout = lazy(() => import("./components/sections/ProfileTabLayout"));

// Lazy load des templates
const ProfileTemplateDefault = lazy(() => import("./components/templates/ProfileTemplateDefault"));
const ProfileTemplateDynamic = lazy(() => import("./components/templates/ProfileTemplateDynamic"));

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
  "profile-actions",
  "profile-event-dates",
  "profile-badges",
  "profile-tags",
  "profile-opening-hours",
  "profile-header-complete",
  "profile-tab-layout",
  "profile-template-default",
  "profile-template-dynamic",
] as const;

export function ProfileSectionRenderer({ section }: ProfileSectionRendererProps) {
  const { entity } = useProfileEntity();

  // Check if it's a profile-specific section
  const isProfileSection = PROFILE_SECTION_TYPES.includes(section.type as typeof PROFILE_SECTION_TYPES[number]);

  if (!isProfileSection) {
    // Special handling for news sections - inject profile entity
    if (section.type === 'news') {
      const newsSection = section as Section & { type: 'news' };
      return <SectionRenderer
        section={{
          ...newsSection,
          props: {
            ...newsSection.props,
            entitySlug: entity?.slug
          }
        }}
      />;
    }

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

    case "profile-actions":
      return <ProfileActions section={section as ProfileActionsSection} />;

    case "profile-event-dates":
      return <ProfileEventDates section={section as ProfileEventDatesSection} />;

    case "profile-badges":
      return <ProfileBadges section={section as ProfileBadgesSection} />;

    case "profile-tags":
      return <ProfileTags section={section as ProfileTagsSection} />;

    case "profile-opening-hours":
      return <ProfileOpeningHours section={section as ProfileOpeningHoursSection} />;

    case "profile-header-complete":
      return <ProfileHeaderComplete section={section as ProfileHeaderCompleteSection} />;

    case "profile-tab-layout":
      return <ProfileTabLayout section={section as ProfileTabLayoutSection} />;

    case "profile-template-default":
      return <ProfileTemplateDefault />;

    case "profile-template-dynamic":
      return <ProfileTemplateDynamic />;

    default: {
      const unknownSection = section as { type: string };
      console.warn(`Unknown profile section type: ${unknownSection.type}`);
      return null;
    }
  }
}
