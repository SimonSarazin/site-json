import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import type { SectionPropsMap } from "@/types/site";
import { useState, useEffect } from "react";
import { ChevronDown, SlidersHorizontal} from "lucide-react";
import { usePageFilters } from "@/contexts/PageFiltersContext";

export function FiltersSection({
  id,
  props
}: {
  id?: string;
  props: SectionPropsMap["filters"]
}) {
  const { t } = useLocalization();
  const { title, filterGroups, defaultOpenGroups = [], className } = props;

  const [openGroups, setOpenGroups] = useState<string[]>(defaultOpenGroups);

  // Utiliser le context partagé
  const { selectedFilters, setSelectedFilters, searchQuery, setSearchQuery, clearFilters: clearFiltersContext } = usePageFilters();

  // Initialiser les filtres par défaut (defaultChecked)
  useEffect(() => {
    const initialFilters: Record<string, string[]> = {};

    filterGroups?.forEach(group => {
      const defaultCheckedIds = group.options
        .filter(option => option.defaultChecked)
        .map(option => option.name || option.id);

      if (defaultCheckedIds.length > 0) {
        initialFilters[group.id] = defaultCheckedIds;
      }
    });

    if (Object.keys(initialFilters).length > 0) {
      setSelectedFilters(initialFilters);
    }
  }, [filterGroups, setSelectedFilters]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleFilter = (groupId: string, filterName: string) => {
    setSelectedFilters(prev => {
      const current = prev[groupId] || [];
      const updated = current.includes(filterName)
        ? current.filter(name => name !== filterName)
        : [...current, filterName];
      return { ...prev, [groupId]: updated };
    });
  };

  const clearFilters = () => {
    clearFiltersContext();
  };

  const isGroupOpen = (groupId: string) => openGroups.includes(groupId);
  const isFilterSelected = (groupId: string, filterName: string) =>
    (selectedFilters[groupId] || []).includes(filterName);

  const hasActiveFilters = Object.values(selectedFilters).some(arr => arr.length > 0) || searchQuery.length > 0;

  return (
    <aside id={id} className={cn("bg-card border border-border rounded-lg p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">
            {title ? t(title) : "Filtres"}
          </h3>
        </div>
        
        {/* Clear Button */}
        <button
          onClick={clearFilters}
          className={cn(
            "text-xs font-medium transition-colors",
            hasActiveFilters 
              ? "text-primary hover:text-primary/80" 
              : "text-gray-400 cursor-not-allowed"
          )}
          disabled={!hasActiveFilters}
        >
          Effacer
        </button>
      </div>

      <div className="pb-4 border-b border-border">
        <div className="relative">
          <input
            type="text"
            placeholder={t({ fr: "Rechercher par nom...", en: "Search by name..." })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-input bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          />
          <svg
            className="w-5 h-5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Filter Groups */}
      <div className="space-y-1">
        {filterGroups?.map((group) => (
          <div key={group.id} className="border-b border-border last:border-b-0">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between py-3 text-left hover:bg-muted transition px-2 rounded"
            >
              <span className="font-medium text-sm text-foreground">
                {t(group.label)}
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  isGroupOpen(group.id) && "rotate-180"
                )}
              />
            </button>

            {/* Group Content */}
            {isGroupOpen(group.id) && (
              <div className="pb-3 px-2 space-y-2">
                {group.options.map((option) => {
                  const filterName = option.name || option.id;
                  return (
                    <label
                      key={option.id}
                      className="flex items-start gap-2 cursor-pointer group"
                    >
                      {/* Checkbox */}
                      <div className="relative flex items-center justify-center mt-0.5">
                        <input
                          type="checkbox"
                          checked={isFilterSelected(group.id, filterName)}
                          onChange={() => toggleFilter(group.id, filterName)}
                          className="w-4 h-4 border-2 border-gray-300 rounded cursor-pointer appearance-none checked:bg-primary checked:border-primary transition"
                        />
                        {isFilterSelected(group.id, filterName) && (
                          <svg
                            className="w-3 h-3 text-white absolute pointer-events-none"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white flex-1">
                        {t(option.label)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}