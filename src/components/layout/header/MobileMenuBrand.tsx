import { Header } from "@/types/site-schema";
import HeaderLogo from "./HeaderLogo";
import NavLink from "../NavLink";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";

interface MobileMenuBrandProps {
  header: Header;
  /** Surface claire (`default`) ou sombre (`onColor`, ex. TransparentDark). */
  tone?: "default" | "onColor";
  /** Câblé sur `close()` du tiroir — referme après navigation vers l'accueil. */
  onNavigate?: () => void;
}

/**
 * En-tête de MARQUE du menu mobile (logo + titre + sous-titre) — partagé par
 * les 6 headers via la prop `brand` de `MobileMenuSheet`. Réutilise les champs
 * que chaque header possède déjà (`logo`/`logoIcon`/`logoTitle`/`logoSubtitle`) :
 * le tiroir s'ouvre sur l'identité du site au lieu d'un grand vide.
 */
export default function MobileMenuBrand({ header, tone = "default", onNavigate }: MobileMenuBrandProps) {
  const t = useT("components/layout");
  if (!header.logo && !header.logoIcon && !header.logoTitle) return null;

  const onColor = tone === "onColor";
  return (
    <NavLink
      to={header.path || "/"}
      onClick={onNavigate}
      className="flex min-w-0 items-center gap-3"
    >
      {/* Hauteur fixe, largeur LIBRE (max-w-40) : les logos horizontaux
          (ex. tiers-lieux) seraient écrasés par un carré h-8 w-8. */}
      <HeaderLogo
        header={header}
        iconTone={onColor ? "white" : "primary"}
        imageHeight={36}
        imageClassName="h-9 w-auto max-w-40 shrink-0 object-contain"
        iconClassName="h-8 w-8 shrink-0"
      />
      {(header.logoTitle || header.logoSubtitle) && (
        <span className="flex min-w-0 flex-col leading-tight">
          {header.logoTitle && (
            <span className={cn("truncate text-base font-bold", onColor ? "text-white" : "text-foreground")}>
              {t(header.logoTitle)}
            </span>
          )}
          {header.logoSubtitle && (
            <span className={cn("truncate text-xs font-medium", onColor ? "text-white/70" : "text-muted-foreground")}>
              {t(header.logoSubtitle)}
            </span>
          )}
        </span>
      )}
    </NavLink>
  );
}
