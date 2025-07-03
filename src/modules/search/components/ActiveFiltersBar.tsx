import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/useT";
import { TagsFilter } from "../types";

interface ActiveFiltersBarProps {
  filters: Record<string, TagsFilter>;
  filtersSearchTags: Record<string, string[]>;
  onRemove: (key: string, value: string) => void;
}

/**
 * @param {Object} filters - ex: { typePlace: ['Bureaux'], role: ['Partenaire'] }
 * @param {Function} onRemove - ex: (key, value) => {}
 */
export default function ActiveFiltersBar({ filters, filtersSearchTags, onRemove }: ActiveFiltersBarProps) {
  const t = useT("modules/search");

  const activeEntries = Object.entries(filtersSearchTags).filter(([_, values]) => values?.length);


  const label = (key: string, value: string | Record<string, string>) => {
    // LocalizedString → on le passe directement à t()
    
    let label = value;
    if (key && value && typeof value === 'string' && filters?.[key]?.list && 
        typeof filters[key].list === 'object' && value in (filters[key].list as Record<string, any>)) {
      label = (filters[key].list as Record<string, any>)[value];
    }

    if (typeof label === "object") return t(label);

    const translated = t(label);
    return translated.startsWith("missing") ? label : translated;
  };

  if (activeEntries.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="font-medium">{t("Filtres actifs :")}</div>
      <div className="flex flex-wrap gap-2">
        {activeEntries.map(([key, values]) =>
          values.map((value) => (
            <Badge
              key={`${key}-${value}`}
              className="gap-0"
            >
              {label(key, value)}
              <button
                className="focus-visible:border-ring focus-visible:ring-ring/50 text-primary-foreground/60 hover:text-primary-foreground -my-px -ms-px -me-1.5 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[inherit] p-0 transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
                onClick={() => onRemove(key, value)}
                aria-label={`Supprimer ${value}`}
              >
                <XIcon size={12} aria-hidden="true" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
