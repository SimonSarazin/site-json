import { Suspense } from "react";
import SearchProStatic from "@/modules/search/SearchProStatic";
import { SearchProStaticSectionProps } from "@/modules/search/schema";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { SearchPropsProvider } from "./contexts/SearchPropsProvider";
import useInSections from "@/hooks/useInSection";

export interface SearchSectionStaticWrapperProps {
  id?: string;
  props: SearchProStaticSectionProps;
}

/**
 * Section wrapper pour SearchProStatic
 * Affichage statique de résultats de recherche sans synchronisation URL
 * Utilisé pour afficher plusieurs sections de recherche sur une même page
 */
export function SearchProStaticSection({
  id,
  props,
}: SearchSectionStaticWrapperProps) {
  const inSection = useInSections(id || "");

  return (
    <section
      id={id}
      className="relative flex flex-col items-center justify-center w-full"
    >
      <SearchPropsProvider props={props} inSection={inSection}>
        <Suspense
          fallback={
            <div className="w-full h-64 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                Chargement...
              </div>
            </div>
          }
        >
          <ErrorBoundary fallback={<section className="p-4 bg-red-100 text-red-800">
              <p>Erreur lors du chargement de la section</p>
            </section>}>
            <SearchProStatic props={props} />
          </ErrorBoundary>
        </Suspense>
      </SearchPropsProvider>
    </section>
  );
}
