// import { Suspense } from "react";
import SearchProStatic from "@/modules/search/SearchProStatic";
import { SearchProStaticSectionProps } from "@/modules/search/schema";
// import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
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
        <SearchProStatic props={props} />
      </SearchPropsProvider>
    </section>
  );
}

export default SearchProStaticSection;