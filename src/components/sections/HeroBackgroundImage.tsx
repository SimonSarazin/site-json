import type { CSSProperties } from "react";
import { buildOptimizedUrl, buildResponsiveSrcSet } from "@/lib/imageUtils";

/** Largeurs du srcSet de l'image mobile dédiée (≤640px CSS × DPR 1-3 → ~1280px réels). */
const DEFAULT_MOBILE_WIDTHS = [480, 768, 1280];

interface HeroBackgroundImageProps {
  /** Image de fond (paysage / desktop). Rendue via /img en srcSet responsive (`w`). */
  src: string;
  /** Art-direction : image dédiée mobile (≤640px), ex. un cadrage portrait. Optionnelle. */
  mobileSrc?: string;
  /** CSS object-position (maîtrise le recadrage object-cover, surtout en portrait). Défaut "center". */
  position?: string;
  /** LCP : chargement prioritaire (loading="eager" + fetchPriority="high"). À true pour le héro above-the-fold. */
  priority?: boolean;
  alt?: string;
  /** Classes de l'<img> (défaut full-bleed cover). Surcharge pour les cas spécifiques (parallaxe, hauteur partielle…). */
  className?: string;
  /** Style additionnel de l'<img> (ex. transform de parallaxe). `objectPosition` est déjà géré via `position`. */
  style?: CSSProperties;
  /** Largeurs du srcSet mobile (défaut [480,768,1280]). */
  mobileWidths?: number[];
}

/**
 * Rendu d'image de fond de HÉRO, centralisé : `<picture>` avec
 *   - srcSet responsive en descripteurs de largeur (`w`) via /img (avif/webp + resize) ;
 *   - `<source>` mobile optionnel (art-direction) ;
 *   - `object-position` configurable + priorité LCP.
 *
 * Source UNIQUE de vérité du rendu image pour tous les héros (HeroQuickAccess, HeroParallax,
 * HeroSection, HeroTintedOverlay, HeroEntityBanner, HeroSearch). Les `srcSet`/`sizes`
 * correspondent EXACTEMENT au preload LCP (`buildResponsiveSrcSet` + `imagesizes="100vw"`,
 * cf. extractCriticalResources/generatePreloadTags) → le navigateur dédoublonne (pas de
 * double téléchargement brute + optimisée).
 */
export function HeroBackgroundImage({
  src,
  mobileSrc,
  position = "center",
  priority = false,
  alt = "",
  className = "w-full h-full object-cover",
  style,
  mobileWidths = DEFAULT_MOBILE_WIDTHS,
}: HeroBackgroundImageProps) {
  if (!src) return null;
  return (
    <picture>
      {mobileSrc && (
        <source
          media="(max-width: 640px)"
          srcSet={buildResponsiveSrcSet(mobileSrc, mobileWidths)}
          sizes="100vw"
        />
      )}
      <img
        src={buildOptimizedUrl(src, { w: 1280, q: 80, f: "auto" })}
        srcSet={buildResponsiveSrcSet(src)}
        sizes="100vw"
        alt={alt}
        className={className}
        style={{ objectPosition: position, ...style }}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
      />
    </picture>
  );
}

export default HeroBackgroundImage;
