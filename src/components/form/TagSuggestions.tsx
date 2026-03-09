import { Loader2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useSearchTags } from "@/hooks/useSearchTags";
import { useDebounce } from "@/hooks/useDebounce";

interface TagSuggestionsProps {
  query: string;
  onSelect: (tag: string) => void;
  /** Textes pour l'internationalisation */
  texts?: {
    searching?: string;
    noResults?: string;
    typeToSearch?: string;
  };
}

const defaultTexts = {
  searching: "Recherche...",
  noResults: "Aucun tag trouvé",
  typeToSearch: "Tapez au moins 2 caractères",
};

export function TagSuggestions({ query, onSelect, texts }: TagSuggestionsProps) {
  const t = { ...defaultTexts, ...texts };
  const debouncedQuery = useDebounce(query, 300);
  const { data: tags = [], isLoading } = useSearchTags(debouncedQuery, debouncedQuery.length >= 2);

  return (
    <Command className="rounded-lg border shadow-md" shouldFilter={false}>
      <CommandList
        className="max-h-[200px] overflow-y-auto"
        onWheel={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              {t.searching}
            </span>
          </div>
        )}

        {!isLoading && tags.length === 0 && (
          <CommandEmpty>
            <p className="text-sm text-muted-foreground">
              {query.length < 2 ? t.typeToSearch : t.noResults}
            </p>
          </CommandEmpty>
        )}

        {!isLoading && tags.length > 0 && (
          <CommandGroup>
            {tags.map((tag, index) => (
              <CommandItem
                key={`${tag}-${index}`}
                value={tag}
                onSelect={() => onSelect(tag)}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer"
              >
                <span className="text-sm font-medium">#{tag}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}

export type { TagSuggestionsProps };
