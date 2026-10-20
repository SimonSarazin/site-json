// import { Suspense } from "react";
import { useMemo } from "react";
import SearchProStatic from "@/modules/search/SearchProStatic";
import { SearchProStaticSectionProps } from "@/modules/search/schema";
// import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { SearchPropsProvider } from "../contexts/SearchPropsProvider";
import useInSections from "@/hooks/useInSection";
import { useCocolight } from "@/hooks/useCocolight";
import { sectionBgClass } from "@/components/sections/sectionBg";

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
  const widthClass = props.width === "container" ? "mx-auto max-w-6xl" : "w-full";
  const sectionBg = sectionBgClass(props.bg);

  const { entity } = useCocolight();
  const dataCostum = entity?.serverData?.costum as Record<string, unknown> | undefined;

  // Créer une copie locale de props avec baseParams modifiés si nécessaire
  const finalProps = useMemo(() => {
    const baseParams = props.baseParams || {};
    
    if (dataCostum?.cocity) {
      const localityId = entity?.serverData?.address?.localityId as string | undefined;
      const defaultFilters = {
        ...(baseParams.defaultFilters || {}),
      } as Record<string, Record<string, string | undefined>>;
      
      defaultFilters["$or"] = {
        "source.key": entity?.serverData?.slug,
        "address.localityId": localityId,
        "source.keys": entity?.serverData?.slug,
      };

      return {
        ...props,
        baseParams: {
          ...baseParams,
          defaultFilters,
        },
      };
    }

    return props;
  }, [props, dataCostum, entity?.serverData?.slug, entity?.serverData?.address?.localityId]);

  return (
    <section
      id={id}
      className={`relative flex flex-col items-center justify-center ${widthClass} ${sectionBg}`}
    >
      <SearchPropsProvider props={finalProps} inSection={inSection}>
        <SearchProStatic props={finalProps} />
      </SearchPropsProvider>
    </section>
  );
}

export default SearchProStaticSection;