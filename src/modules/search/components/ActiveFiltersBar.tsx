import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/useT";

interface ActiveFiltersBarProps {
  filters: Record<string, string[]>;
  onRemove: (key: string, value: string) => void;
}

/**
 * @param {Object} filters - ex: { typePlace: ['Bureaux'], role: ['Partenaire'] }
 * @param {Function} onRemove - ex: (key, value) => {}
 */
export default function ActiveFiltersBar({ filters, onRemove }: ActiveFiltersBarProps) {
  const t = useT("modules/search");  

  const activeEntries = Object.entries(filters).filter(([_, values]) => values?.length);

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
              {value}
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
