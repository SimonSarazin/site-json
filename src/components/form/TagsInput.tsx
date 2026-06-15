import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { Tag, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { toast } from "sonner";
import { TagSuggestions } from "./TagSuggestions";

interface TagsInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  maxTags?: number;
  /** Active l'autocomplétion sur les tags existants (`TagSuggestions`/`useSearchTags`).
   *  `false` → saisie libre uniquement (pour des valeurs qui ne sont PAS des tags). */
  searchable?: boolean;
  /** Textes pour l'internationalisation */
  texts?: {
    placeholder?: string;
    maxReached?: string;
    // Pour TagSuggestions
    searching?: string;
    noResults?: string;
    typeToSearch?: string;
  };
}

const defaultTexts = {
  placeholder: "Ajouter des tags...",
  maxReached: "Maximum {{max}} tags autorisés",
  searching: "Recherche...",
  noResults: "Aucun tag trouvé",
  typeToSearch: "Tapez au moins 2 caractères",
};

export function TagsInput({
  tags,
  onTagsChange,
  maxTags = 10,
  searchable = true,
  texts,
}: TagsInputProps) {
  const t = { ...defaultTexts, ...texts };
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSelectingRef = useRef(false);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    // Suggestions (recherche de tags via `useSearchTags`) : uniquement si `searchable`.
    // Sinon saisie libre seule (Entrée / virgule pour valider).
    if (searchable && value.trim().length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    } else if (e.key === "Escape" && showSuggestions) {
      setShowSuggestions(false);
    }
  };

  const addTag = (tagValue?: string) => {
    const trimmedValue = (tagValue || inputValue).trim().replace(/^#/, "");

    if (trimmedValue === "") return;
    if (tags.length >= maxTags) {
      toast.error(t.maxReached.replace("{{max}}", String(maxTags)));
      return;
    }
    if (tags.includes(trimmedValue)) {
      setInputValue("");
      setShowSuggestions(false);
      return;
    }

    onTagsChange([...tags, trimmedValue]);
    setInputValue("");
    setShowSuggestions(false);

    // Refocus sur l'input après ajout
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const selectTag = (tag: string) => {
    isSelectingRef.current = true;
    addTag(tag);
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 300);
  };

  const removeTag = (index: number) => {
    onTagsChange(tags.filter((_, i) => i !== index));
  };

  // Fermer les suggestions si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-radix-popper-content-wrapper]")) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSuggestions]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary rounded-full text-xs sm:text-sm font-medium border border-primary/30 dark:border-primary/40"
          >
            <Tag className="w-3 h-3" />
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="ml-1 hover:text-primary/80 dark:hover:text-primary/80"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
          <PopoverAnchor>
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // Delay pour permettre au clic sur suggestion de fonctionner
                setTimeout(() => {
                  if (!isSelectingRef.current && inputValue.trim()) {
                    addTag();
                  }
                }, 200);
              }}
              placeholder={t.placeholder}
              className="text-xs sm:text-sm pr-16"
              disabled={tags.length >= maxTags}
            />
          </PopoverAnchor>
          {tags.length > 0 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              {tags.length}/{maxTags}
            </span>
          )}

          <PopoverContent
            className="w-80 p-0"
            side="bottom"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <TagSuggestions
              query={inputValue}
              onSelect={selectTag}
              texts={{
                searching: t.searching,
                noResults: t.noResults,
                typeToSearch: t.typeToSearch,
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export type { TagsInputProps };
