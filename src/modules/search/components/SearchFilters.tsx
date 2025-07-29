import { useLocalization } from "@/hooks/useLocalization";
import FilterDropdown from "./FilterDropdown";
import SearchTextInput from "./SearchTextInput";
import {type LocalizedString } from "@/types/locale-schema";
import { TagsFilter } from "../schema";

export interface SearchFiltersProps {
  placeholder: LocalizedString;
  filters: Record<string, TagsFilter>;
  searchText: string;
  searchTags: Record<string, string[]>;
  searchType: Record<string, string[]>;
  onTextChange: (text: string) => void;
  onTagChange: (nextTags: Record<string, string[]>) => void;
  onTypeChange: (nextTypes: Record<string, string[]>) => void;
  minimal?: boolean;
}

export default function SearchFilters({ placeholder, filters, searchText, searchTags, searchType, onTextChange, onTagChange, onTypeChange, minimal = false }: SearchFiltersProps) {

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
          className={Object.keys(filters).length === 0 ? "sm:flex-1" : "sm:w-auto"}
        />
      )}
      {Object.entries(filters)
        .map(([key, config]) => {
          if (config.type === "tags" && config.active !== false) {

            return (
              <FilterDropdown
              key={key}
              name={config.name as string}
              list={config.list}
              selected={searchTags[key] || []}
              onChange={(values: string[]) => {
                const updatedTags = { ...searchTags, [key]: values };
                onTagChange(updatedTags);
              }}
              />
            );
          } else if( config.type === "type" && config.active !== false) {
            
            return (
              <FilterDropdown
              key={key}
              name={config.name as string}
              list={config.list}
              selected={searchType[key] || []}
              onChange={(values: string[]) => {
                const updatedTypes = { ...searchType, [key]: values };
                onTypeChange(updatedTypes);
              }}
              />
            );
          }
          return null;
        })}
    </div>
  );
}

