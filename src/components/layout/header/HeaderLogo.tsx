import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { IconOrSvg } from "@/components/ui/icon-or-svg";
import { useT } from "@/hooks/useT";
import type { Header } from "@/types/site-schema";
import { resolveHeaderLogo } from "./resolveHeaderLogo";

type IconTone = NonNullable<Header["logoIconTone"]>;

const ICON_TONE_CLASS: Record<IconTone, string> = {
  foreground: "text-foreground",
  primary: "text-primary",
  white: "text-white",
};

interface HeaderLogoProps {
  header: Header;
  /**
   * Le header transparent est-il posé sur un héro (état non opaque) ? Pilote la
   * sélection de `logoOverlay`. Laisser `false` pour les headers opaques.
   */
  isOverlay?: boolean;
  /** Classes de l'IMAGE (taille/forme) — propre à chaque header. */
  imageClassName?: string;
  /** Classes de l'ICÔNE (taille) — propre à chaque header. */
  iconClassName?: string;
  /**
   * Ton par défaut du `logoIcon` quand le config ne précise pas `logoIconTone`.
   * Permet à chaque header de garder son comportement historique
   * (transparent-scroll/minimal = "primary"). Le config (`logoIconTone`) gagne.
   */
  iconTone?: IconTone;
  /** Hint de hauteur intrinsèque de l'image (défaut 32). */
  imageHeight?: number;
  /** Hint de largeur intrinsèque (active le srcSet 1x/2x ; ex. logos larges). */
  imageWidth?: number;
  /**
   * Source d'image EXTERNE résolue au runtime (ex. logo costum communecter via
   * `entityLogoOverride`). Fournie → court-circuite la résolution config /
   * `<OptimizedImage>` et rend un `<img>` brut (URL hors all-list `/img`).
   */
  overrideSrc?: string;
}

/**
 * Marque (logo) partagée par les headers — rend l'IMAGE (`logo` / `logoDark` /
 * `logoOverlay`, résolues par {@link resolveHeaderLogo}) ou, à défaut, l'icône
 * (`logoIcon`). Ne rend PAS le titre/sous-titre : ils restent dans chaque header
 * (couleurs spécifiques, ex. `text-white` sur barre colorée).
 *
 * Cas couverts :
 * - `overrideSrc` (logo costum runtime) → `<img>` brut (URL externe) ;
 * - image + `logoDark` → swap clair/sombre en CSS (`dark:`), sans flash SSR ;
 * - image + `logoOverlay` + `isOverlay` → variante posée sur le héro ;
 * - `logoIcon` (SVG/Lucide en `currentColor`) → couleur = `logoIconTone` (config)
 *   sinon `iconTone` (défaut header), sinon "foreground".
 */
export default function HeaderLogo({
  header,
  isOverlay = false,
  imageClassName,
  iconClassName,
  iconTone = "foreground",
  imageHeight = 32,
  imageWidth,
  overrideSrc,
}: HeaderLogoProps) {
  const t = useT();
  const alt = header.logoAlt ? t(header.logoAlt) : "";

  // Override runtime (costum) : URL externe → `<img>` brut, hors optimiseur
  // (le costum communecter sert des URLs hors all-list `/img`).
  if (overrideSrc) {
    return <img src={overrideSrc} alt={alt} className={imageClassName} />;
  }

  const resolved = resolveHeaderLogo(header, { isOverlay });
  if (resolved) {
    // Variante sombre distincte → on rend les deux images, CSS choisit (SSR-safe).
    if (resolved.srcDark) {
      return (
        <>
          <OptimizedImage
            src={resolved.src}
            alt={alt}
            height={imageHeight}
            width={imageWidth}
            className={`${imageClassName ?? ""} dark:hidden`}
          />
          <OptimizedImage
            src={resolved.srcDark}
            alt={alt}
            height={imageHeight}
            width={imageWidth}
            className={`hidden dark:block ${imageClassName ?? ""}`}
          />
        </>
      );
    }
    return (
      <OptimizedImage
        src={resolved.src}
        alt={alt}
        height={imageHeight}
        width={imageWidth}
        className={imageClassName}
      />
    );
  }

  if (header.logoIcon) {
    const tone = ICON_TONE_CLASS[header.logoIconTone ?? iconTone];
    return (
      <IconOrSvg value={header.logoIcon} className={`${iconClassName ?? ""} ${tone}`} />
    );
  }

  return null;
}
