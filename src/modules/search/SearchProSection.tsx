import { SearchPropsProvider } from "./contexts/SearchPropsContext";
import SearchPro from "./SearchPro";
import { SearchProProps } from "./types";

export interface SearchSectionWrapperProps {
  id?: string;
  props: SearchProProps;
}

export default function SearchProSection({ id, props }: SearchSectionWrapperProps) {
  return (
    <section id={id} className="relative min-h-[80vh]">
      <SearchPropsProvider props={props}>
        <SearchPro props={props} />
      </SearchPropsProvider>
    </section>
  );
}