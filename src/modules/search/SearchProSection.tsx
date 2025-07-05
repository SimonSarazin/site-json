import { SearchPropsProvider } from "./contexts/SearchPropsContext";
import { SearchProSectionProps } from "./schema";
import SearchPro from "./SearchPro";

export interface SearchSectionWrapperProps {
  id?: string;
  props: SearchProSectionProps;
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