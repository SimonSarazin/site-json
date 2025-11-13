import { Suspense, type ReactNode } from "react";
import { useLazyTab } from "@/hooks/useLazyTab";

interface LazyTabContentProps {
  /** Valeur de cet onglet */
  value: string;

  /** Contenu à afficher dans l'onglet */
  children: ReactNode;

  /** Fallback à afficher pendant le chargement (Suspense) */
  fallback?: ReactNode;

  /** Garder le contenu monté même quand l'onglet n'est plus actif (par défaut: true) */
  keepMounted?: boolean;
}

/**
 * Wrapper pour lazy loading du contenu des onglets avec synchronisation URL
 *
 * Ne monte le contenu que lorsque l'onglet est activé pour la première fois.
 * Supporte React.lazy() et Suspense pour le code-splitting.
 * Le tab actif est détecté automatiquement depuis l'URL.
 *
 * @example Avec code-splitting
 * ```tsx
 * const LazyNewsTab = lazy(() => import('./NewsTab'));
 *
 * <LazyTabContent value="news">
 *   <LazyNewsTab />
 * </LazyTabContent>
 * ```
 *
 * @example Sans code-splitting
 * ```tsx
 * <LazyTabContent value="news">
 *   <NewsTabContent />
 * </LazyTabContent>
 * ```
 */
export function LazyTabContent({
  value,
  children,
  fallback = (
    <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
      <div className="text-center py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-12 w-12 bg-gray-200 rounded-full mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          <div className="h-3 bg-gray-200 rounded w-1/3 mx-auto"></div>
        </div>
      </div>
    </div>
  ),
  keepMounted = true
}: LazyTabContentProps) {
  const { shouldLoad, isActive } = useLazyTab(value);

  // Si pas encore visité, ne rien render
  if (!shouldLoad) {
    return null;
  }

  // Si keepMounted=false et pas actif, démonte le contenu
  if (!keepMounted && !isActive) {
    return null;
  }

  // Wrapper Suspense pour supporter React.lazy()
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}
