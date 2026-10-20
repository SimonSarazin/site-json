import { useContext } from "react";
import { cn } from "@/lib/utils";
import { PageContext } from "@/contexts/PageContext";
import { useSearchPropsOptional } from "./useSearchProps";

/**
 * Classe du CONTENEUR de la vue carte — SOURCE UNIQUE, partagée par
 * `SearchMap` et `MapSkeleton` (le squelette doit occuper exactement
 * l'espace que prendra la carte, dans les DEUX modes d'affichage) :
 *
 * - page carte plein écran (footer masqué ET hors section) :
 *   `absolute inset-0` — remplit le parent ;
 * - sinon (footer visible OU carte dans une section) :
 *   `relative min-h-screen`.
 *
 * Contextes LUS EN OPTIONNEL : le stack carte est monté hors du module search
 * (Meeteem/ampli embarque `SearchMapWrapper` dans sa propre section, sans
 * `SearchPropsProvider` ni route de page). Sans provider on retombe sur le cas
 * « en section » — le seul correct pour une carte embarquée, qui de toute façon
 * fournit son propre `containerClass`. Les appels depuis une section search
 * gardent exactement le comportement d'avant (mêmes contextes, mêmes valeurs).
 */
export function useMapContainerClass(base?: string) {
  const searchProps = useSearchPropsOptional();
  const pageContext = useContext(PageContext);
  const inSection = searchProps?.inSection ?? true;
  const hideFooter = pageContext?.page.hideFooter ?? false;
  return cn(base, hideFooter && !inSection ? "absolute inset-0" : "relative min-h-screen");
}
