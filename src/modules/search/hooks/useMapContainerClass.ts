import { cn } from "@/lib/utils";
import { usePage } from "@/hooks/usePage";
import { useSearchProps } from "./useSearchProps";

/**
 * Classe du CONTENEUR de la vue carte — SOURCE UNIQUE, partagée par
 * `SearchMap` et `MapSkeleton` (le squelette doit occuper exactement
 * l'espace que prendra la carte, dans les DEUX modes d'affichage) :
 *
 * - page carte plein écran (footer masqué ET hors section) :
 *   `absolute inset-0` — remplit le parent ;
 * - sinon (footer visible OU carte dans une section) :
 *   `relative min-h-screen`.
 */
export function useMapContainerClass(base?: string) {
  const { inSection } = useSearchProps();
  const { page } = usePage();
  return cn(
    base,
    page.hideFooter && !inSection ? "absolute inset-0" : "relative min-h-screen",
  );
}
