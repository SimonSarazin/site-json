import { SearchPropsProvider } from "./contexts/SearchPropsProvider";
import { SearchProSectionProps } from "./schema";
import SearchPro from "./SearchPro";
import useInSections from "../../hooks/useInSection";

export interface SearchSectionWrapperProps {
  id?: string;
  props: SearchProSectionProps;
}

export default function SearchProSection({ id, props }: SearchSectionWrapperProps) {
  const inSection = useInSections(id || "");
  return (
    <section id={id} className="relative flex-1">
      <SearchPropsProvider props={props} inSection={inSection}>
        <SearchPro props={props} />
      </SearchPropsProvider>
    </section>
  );
}