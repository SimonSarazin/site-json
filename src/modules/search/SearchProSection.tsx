import SearchPro from "./SearchPro";
import { SearchProProps } from "./types";

export interface SearchSectionWrapperProps {
  id?: string;
  props: SearchProProps;
}

export default function SearchProSection({ id, props }: SearchSectionWrapperProps) {
  return (
    <section id={id} className="relative min-h-[80vh]">
      <SearchPro props={props} />
    </section>
  );
}