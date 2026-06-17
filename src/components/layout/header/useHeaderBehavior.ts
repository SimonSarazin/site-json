import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import type { Header } from "@/types/site-schema";

/** Un chemin courant `pathname` correspond au préfixe `p` : égalité exacte ou
 *  sous-chemin (`/profil` matche `/profil/x` mais PAS `/profilage`). `/` = home stricte. */
const pathMatches = (pathname: string, p: string): boolean =>
  pathname === p || pathname.startsWith(p.replace(/\/+$/, "") + "/");

/** Un type de section est un « héro » (plein écran, fond connu) → l'overlay du header
 *  transparent y est lisible. Convention : tout type commençant par `hero`. */
export const isHeroSectionType = (type?: string): boolean => !!type && type.startsWith("hero");

/**
 * Hooks partagés des headers — factorisent la logique dupliquée entre variantes
 * (scroll-aware, scroll-to-top, item de nav actif). Aucune logique de site : tout
 * est générique et piloté par le routeur.
 *
 * La logique d'authentification vit désormais dans le module auth
 * (`useAuthActions` / `useAuthModal` / `<AuthMenu>`), pas ici.
 */

/** `true` dès que la page a défilé au-delà de `threshold` px (header transparent→opaque). */
export function useScrollAware(threshold = 50): boolean {
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);
  return isScrolled;
}

/** Remonte en haut (smooth) à chaque changement de route. */
export function useScrollToTopOnRouteChange(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);
}

/**
 * Décide si un header `transparent-scroll` doit être OPAQUE **au repos** (hors scroll)
 * sur la route courante. Le scroll (`useScrollAware`) est combiné à part par le header.
 *
 * Précédence (quand `transparent !== false`) :
 *   opaqueOnPaths > overlayOnPaths > transparentMode("auto" → opaque si pas de héro) > "always"(overlay).
 *
 * `pageHasHero` est calculé par `SiteHeader` (la page config courante débute-t-elle par un héro ?).
 * Pour une route module (ex. `/profil/:slug`, sans page config) il vaut `false` → opaque en mode auto.
 */
export function useHeaderOpaqueAtRest(header: Header, pageHasHero: boolean): boolean {
  const { pathname } = useLocation();
  if (header.transparent === false) return true; // jamais d'overlay → toujours opaque (+ spacer)
  if (header.opaqueOnPaths?.some((p) => pathMatches(pathname, p))) return true;
  if (header.overlayOnPaths?.some((p) => pathMatches(pathname, p))) return false;
  if (header.transparentMode === "auto") return !pageHasHero;
  return false; // "always" (défaut) : overlay sur toutes les pages
}

/** Renvoie un prédicat `(path) => boolean` indiquant si l'item de nav est actif. */
export function useNavItemActive(): (itemPath?: string) => boolean {
  const { pathname } = useLocation();
  return (itemPath?: string) => {
    if (!itemPath) return false;
    if (itemPath === "/" && pathname === "/") return true;
    if (itemPath !== "/" && pathname.startsWith(itemPath)) return true;
    return false;
  };
}
