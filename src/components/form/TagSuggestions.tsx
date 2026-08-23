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
  /**
   * Suggestions LOCALES (liste déjà chargée). Fournies → filtrage en mémoire, sans requête ni debounce ;
   * absentes → recherche serveur sur le référentiel global de tags (`useSearchTags`).
   * Sert les listes de costum, dont l'intégralité tient en quelques kilooctets : les charger une fois et
   * filtrer dans le navigateur est plus rapide qu'une recherche préfixe serveur (mesuré).
   */
  items?: string[];
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

export function TagSuggestions({ query, onSelect, items, texts }: TagSuggestionsProps) {
  const t = { ...defaultTexts, ...texts };
  const local = items !== undefined;
  const debouncedQuery = useDebounce(query, 300);
  // Mode local : aucune requête (`enabled: false`), on filtre la liste déjà en mémoire. Le hook reste appelé
  // inconditionnellement — règle des hooks.
  const { data: remote = [], isLoading: remoteLoading } = useSearchTags(debouncedQuery, !local && debouncedQuery.length >= 2);
  const q = query.trim().toLocaleLowerCase();
  const tags = local
    ? (q ? items.filter((v) => v.toLocaleLowerCase().includes(q)) : items).slice(0, 50)
    : remote;
  const isLoading = local ? false : remoteLoading;

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
              {!local && query.length < 2 ? t.typeToSearch : t.noResults}
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
                <span className="text-sm font-medium">{local ? tag : `#${tag}`}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}

export type { TagSuggestionsProps };
