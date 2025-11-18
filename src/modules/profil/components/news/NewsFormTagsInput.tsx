import { useState, KeyboardEvent } from "react";
import { Tag, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface NewsFormTagsInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  maxTags?: number;
}

export function NewsFormTagsInput({
  tags,
  onTagsChange,
  maxTags = 10,
}: NewsFormTagsInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const addTag = () => {
    const trimmedValue = inputValue.trim().replace(/^#/, "");

    if (trimmedValue === "") return;
    if (tags.length >= maxTags) {
      alert(`${maxTags} tags  maximum allowed.`);
      return;
    }
    if (tags.includes(trimmedValue)) {
      setInputValue("");
      return;
    }

    onTagsChange([...tags, trimmedValue]);
    setInputValue("");
  };

  const removeTag = (index: number) => {
    onTagsChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 rounded-full text-xs sm:text-sm font-medium border border-teal-200 dark:border-teal-700"
          >
            <Tag className="w-3 h-3" />
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="ml-1 hover:text-teal-900 dark:hover:text-teal-200"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder="Ajouter des tags (appuyez sur Entrée ou virgule)"
          className="text-xs sm:text-sm pr-16"
          disabled={tags.length >= maxTags}
        />
        {tags.length > 0 && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {tags.length}/{maxTags}
          </span>
        )}
      </div>
    </div>
  );
}
