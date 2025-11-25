import { Tag } from "lucide-react";

interface TagSuggestionsProps {
  tags: string[];
  onSelect: (tag: string) => void;
  isLoading?: boolean;
}

export function TagSuggestions({ tags, onSelect, isLoading = false }: TagSuggestionsProps) {
  if (isLoading) {
    return (
      <div className="bg-background border border-border rounded-md shadow-lg p-2">
        <div className="text-sm text-muted-foreground p-2">Chargement...</div>
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="bg-background border border-border rounded-md shadow-lg p-2">
        <div className="text-sm text-muted-foreground p-2">Aucun tag trouvé</div>
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
      {tags.map((tag) => (
        <button
          key={tag}
          className="w-full flex items-center gap-2 p-2 hover:bg-muted transition-colors text-left"
          onClick={() => onSelect(tag)}
        >
          <Tag className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">#{tag}</span>
        </button>
      ))}
    </div>
  );
}