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
const BG_MAP: Record<string, string> = {
  card: "bg-card",
  muted: "bg-muted",
  primary: "bg-primary/10",
  secondary: "bg-secondary",
  accent: "bg-accent/10",
  transparent: "bg-transparent",
};

export function SearchProStaticSection({
  id,
  props,
}: SearchSectionStaticWrapperProps) {
  const inSection = useInSections(id || "");
  const widthClass = props.width === "container" ? "mx-auto max-w-6xl" : "w-full";
  const sectionBg = props.bg && props.bg !== "default" ? BG_MAP[props.bg] : "";

  return (
    <section
      id={id}
      className={`relative flex flex-col items-center justify-center ${widthClass} ${sectionBg}`}
    >
      <SearchPropsProvider props={props} inSection={inSection}>
        <SearchProStatic props={props} />
      </SearchPropsProvider>
    </section>
  );
}

export default SearchProStaticSection;