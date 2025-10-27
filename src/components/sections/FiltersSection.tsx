import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import type { SectionPropsMap } from "@/types/site";
import { useState } from "react";
import { ChevronDown, SlidersHorizontal} from "lucide-react";

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
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleFilter = (groupId: string, filterId: string) => {
    setSelectedFilters(prev => {
      const current = prev[groupId] || [];
      const updated = current.includes(filterId)
        ? current.filter(id => id !== filterId)
        : [...current, filterId];
      return { ...prev, [groupId]: updated };
    });
  };

  const clearFilters = () => {
    setSelectedFilters({});
  };

  const isGroupOpen = (groupId: string) => openGroups.includes(groupId);
  const isFilterSelected = (groupId: string, filterId: string) => 
    (selectedFilters[groupId] || []).includes(filterId);

  const hasActiveFilters = Object.values(selectedFilters).some(arr => arr.length > 0);

  return (
    <aside id={id} className={cn("bg-white border border-gray-200 rounded-lg p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-700" />
          <h3 className="font-semibold text-gray-900">
            {title ? t(title) : "Filtres"}
          </h3>
        </div>
        
        {/* Clear Button */}
        <button
          onClick={clearFilters}
          className={cn(
            "text-xs font-medium transition-colors",
            hasActiveFilters 
              ? "text-teal-600 hover:text-teal-700" 
              : "text-gray-400 cursor-not-allowed"
          )}
          disabled={!hasActiveFilters}
        >
          Effacer
        </button>
      </div>

      {/* Filter Groups */}
      <div className="space-y-1">
        {filterGroups?.map((group) => (
          <div key={group.id} className="border-b border-gray-100 last:border-b-0">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 transition px-2 rounded"
            >
              <span className="font-medium text-sm text-gray-900">
                {t(group.label)}
              </span>
              <ChevronDown 
                className={cn(
                  "w-4 h-4 text-gray-600 transition-transform",
                  isGroupOpen(group.id) && "rotate-180"
                )}
              />
            </button>

            {/* Group Content */}
            {isGroupOpen(group.id) && (
              <div className="pb-3 px-2 space-y-2">
                {group.options.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-start gap-2 cursor-pointer group"
                  >
                    {/* Checkbox */}
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={isFilterSelected(group.id, option.id)}
                        onChange={() => toggleFilter(group.id, option.id)}
                        className="w-4 h-4 border-2 border-gray-300 rounded cursor-pointer appearance-none checked:bg-teal-500 checked:border-teal-500 transition"
                      />
                      {isFilterSelected(group.id, option.id) && (
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

                    <span className="text-sm text-gray-700 group-hover:text-gray-900 flex-1">
                      {t(option.label)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}