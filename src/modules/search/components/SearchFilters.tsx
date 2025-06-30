import { useLocalization } from "@/hooks/useLocalization";
import FilterDropdown from "./FilterDropdown";
import SearchTextInput from "./SearchTextInput";
import {type LocalizedString } from "@/types/locale-schema";
import { TagsFilter } from "../types";

export interface SearchFiltersProps {
  placeholder: LocalizedString;
  filters: Record<string, TagsFilter>;
  searchText: string;
  searchTags: Record<string, string[]>;
  onTextChange: (text: string) => void;
  onTagChange: (nextTags: Record<string, string[]>) => void;
  minimal?: boolean;
}

export default function SearchFilters({ placeholder, filters, searchText, searchTags, onTextChange, onTagChange, minimal = false }: SearchFiltersProps) {

  const { t } = useLocalization();

  if (minimal) {
    // Version mobile minimale : juste l'input
    return (
      <div className="flex items-center gap-2 w-full">
        {placeholder && (
          <SearchTextInput
            placeholder={t(placeholder)}
            value={searchText}
            onChange={onTextChange}
            className="flex-1"
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
      {placeholder && (
        <SearchTextInput
          placeholder={t(placeholder)}
          value={searchText}
          onChange={onTextChange}
          className="w-full sm:w-auto"
        />
      )}
      {Object.entries(filters)
        .filter(([key]) => key !== "text")
        .map(([key, config]) => {
          if (config.type === "tags") {
            const list = Array.isArray(config.list)
              ? config.list
              : Object.values(config.list);
            
            return (
              <FilterDropdown
              key={key}
              name={config.name as string}
              list={list as string[]}
              selected={searchTags[key] || []}
              onChange={(values: string[]) => {
                const updatedTags = { ...searchTags, [key]: values };
                onTagChange(updatedTags);
              }}
              />
            );
          }
          return null;
        })}
    </div>
  );
}

