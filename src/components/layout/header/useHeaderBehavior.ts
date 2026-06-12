import { useEffect, useState } from "react";
import { useLocation } from "react-router";

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
