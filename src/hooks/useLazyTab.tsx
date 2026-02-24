import { useState } from "react";
import { useLocation } from "react-router";

/**
 * Hook pour gérer le lazy loading des onglets avec synchronisation URL
 *
 * Ne charge le contenu d'un onglet que lorsqu'il est activé pour la première fois.
 * Garde en mémoire quels onglets ont déjà été visités pour éviter de les démonter.
 * Le tab actif est détecté depuis l'URL (ex: /@slug/news → tab "news")
 *
 * @param tabValue - Valeur de l'onglet (ex: "news", "coworking", "about")
 * @returns Objet avec isActive, hasBeenActive, et shouldLoad
 *
 * @example
 * ```tsx
 * function NewsTab() {
 *   const { shouldLoad } = useLazyTab("news");
 *
 *   const { data } = useQuery({
 *     queryKey: ["news"],
 *     queryFn: fetchNews,
 *     enabled: shouldLoad  // Ne fetch que si onglet visité
 *   });
 *
 *   if (!shouldLoad) return null;
 *   return <div>{data}</div>;
 * }
 * ```
 */
export function useLazyTab(tabValue: string) {
  const location = useLocation();
  const [hasBeenActive, setHasBeenActive] = useState(false);

  // Déterminer le tab actif depuis l'URL
  // Exemples: /profil/slug → "about", /profil/slug/news → "news"
  const pathSegments = location.pathname.split('/').filter(Boolean);
  // pathSegments: ["profil", "slug", "news"] ou ["profil", "slug"]
  const currentValue = pathSegments.length > 2 ? pathSegments[2] : 'about';

  const isActive = currentValue === tabValue;

  if (isActive && !hasBeenActive) {
    setHasBeenActive(true);
  }

  return {
    /** L'onglet est-il actuellement actif ? */
    isActive,

    /** L'onglet a-t-il déjà été activé au moins une fois ? */
    hasBeenActive,

    /** Faut-il charger le contenu ? (true si actif OU déjà visité) */
    shouldLoad: hasBeenActive || isActive
  };
}
