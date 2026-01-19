import type { ProfileHeaderSection } from "../../schema";
import {
  ProfileHeaderHero,
  ProfileHeaderSimple,
  ProfileHeaderComplete,
  ProfileHeaderCover,
  ProfileHeaderMinimal,
  ProfileHeaderBannerOverlay,
} from "./headers";

interface ProfileHeaderProps {
  section: ProfileHeaderSection;
}

export default function ProfileHeader({ section }: ProfileHeaderProps) {
  const variant = section.variant || "hero";

  switch (variant) {
    case "hero":
      return <ProfileHeaderHero section={section} />;
    case "complete":
      return <ProfileHeaderComplete section={section} />;
    case "cover":
      return <ProfileHeaderCover section={section} />;
    case "minimal":
      return <ProfileHeaderMinimal section={section} />;
    case "banner-overlay":
      return <ProfileHeaderBannerOverlay section={section} />;
    case "simple":
    default:
      return <ProfileHeaderSimple section={section} />;
  }
}
