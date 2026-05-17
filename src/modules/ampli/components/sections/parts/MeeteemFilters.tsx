import { ChevronDown, FunnelIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";

interface MeeteemFiltersProps {
  availableTags: string[];
  activeFilters: string[];
  onToggleFilter: (tag: string) => void;
}

/**
 * Accordéon de filtres par tags pour MeeteemSection.
 * Extrait pour réduire MeeteemSection.tsx — gère son propre `collapsed` state local.
 */
export function MeeteemFilters({ availableTags, activeFilters, onToggleFilter }: MeeteemFiltersProps) {
  const t = useT("modules/ampli");
  const [collapsed, setCollapsed] = useState(false);

  if (availableTags.length === 0) return null;

  return (
    <div className="flex flex-col flex-1 mb-6">
      <div className="bg-transparent border border-border rounded-xl shadow-sm overflow-hidden transition-all">
        {/* Titre des filtres avec accordéon */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="w-full px-5 py-4 cursor-pointer flex items-center justify-between transition-all hover:bg-primary/10 select-none text-left"
        >
          <div className="flex items-center gap-3 flex-1">
            <FunnelIcon className="w-5 h-5 text-foreground" />
            <span className="text-base font-semibold text-foreground">
              {String(t("MeeteemSection.filters.title"))}
            </span>
            {activeFilters.length > 0 && (
              <div className="bg-primary text-primary-foreground rounded-full min-w-6 h-6 flex items-center justify-center text-xs font-semibold">
                {activeFilters.length}
              </div>
            )}
          </div>
          <ChevronDown
            className={cn("w-5 h-5 text-foreground transition-transform", collapsed ? "" : "rotate-180")}
          />
        </button>

        {/* Contenu des filtres */}
        {!collapsed && (
          <div className="p-5 transition-all">
            <div className="flex flex-wrap gap-3">
              {availableTags.map((tag) => {
                const active = activeFilters.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggleFilter(tag)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-all flex items-center gap-2",
                      active
                        ? "bg-primary border border-primary text-primary-foreground -translate-y-0.5 shadow-lg shadow-primary/30"
                        : "border border-border text-foreground hover:bg-primary hover:border-primary hover:text-primary-foreground hover:-translate-y-0.5 hover:shadow-md",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
