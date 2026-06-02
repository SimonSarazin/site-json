import type { ProfileHeaderSection } from "../../schema";
import { lazy } from "vite-preload";

/**
 * Variants de ProfileHeader en `lazy()`. À un profil donné, un seul
 * variant est utilisé (cf. config `profileHeader.variant`). Les 5 autres
 * chunks ne sont pas téléchargés côté client.
 */
const ProfileHeaderHero = lazy(() => import("./headers/ProfileHeaderHero"));
const ProfileHeaderSimple = lazy(() => import("./headers/ProfileHeaderSimple"));
const ProfileHeaderComplete = lazy(() => import("./headers/ProfileHeaderComplete"));
const ProfileHeaderCover = lazy(() => import("./headers/ProfileHeaderCover"));
const ProfileHeaderMinimal = lazy(() => import("./headers/ProfileHeaderMinimal"));
const ProfileHeaderBannerOverlay = lazy(() => import("./headers/ProfileHeaderBannerOverlay"));

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
