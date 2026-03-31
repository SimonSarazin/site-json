import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import type { FiltersSectionProps, SectionPropsMap } from "@/types/site";
import { useState, useEffect, useMemo } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { usePageFilters } from "@/contexts/PageFiltersContext";
import { useFiltersByAnswersQuery } from "@/hooks/useFiltersByAnswers";
import { useSearchZoneQuery } from "@/hooks/useSearchZone";

export function FiltersSection({
  id,
  props
}: {
  id?: string;
  props: SectionPropsMap["filters"]
}) {
  const { t } = useLocalization();
  const { title, filterGroups: propsFiltersGroups, defaultOpenGroups = [], filtersByAnswers, className } = props;
  const [filterGroups, setFilterGroups] = useState<FiltersSectionProps["filterGroups"]>([]);
  const [openGroups, setOpenGroups] = useState<string[]>(defaultOpenGroups);

  const filtersByAnswersOptions = filtersByAnswers ?? {};
  const filterAnswerResult = useFiltersByAnswersQuery(`filters-answers-${id}`, filtersByAnswersOptions as Parameters<typeof useFiltersByAnswersQuery>[1]);
  const filterAnswerData = filtersByAnswers ? filterAnswerResult.data : null;

  const zoneQueryParams = useMemo(() => {
    const hasScopeList = propsFiltersGroups.some(group => group.type === "scopeList");
    if (!hasScopeList) return null;

    return propsFiltersGroups.filter(group => group.type === "scopeList").reduce((acc, group) => {
      if (!acc.countryCode) {
        acc.countryCode = []
      }
      if (!acc.level) {
        acc.level = []
      }
      if (group.config?.countryCode) {
        acc.countryCode.push(...group.config.countryCode);
      }
      if (group.config?.level) {
        acc.level.push(...group.config.level);
      }
      // Rendre les valeurs uniques
      acc.countryCode = [...new Set(acc.countryCode)];
      acc.level = [...new Set(acc.level)];
      return acc;
    }, {} as { countryCode: string[]; level: string[] });
  }, [propsFiltersGroups]);

  const zoneResult = useSearchZoneQuery(`filters-zone-${id}`, zoneQueryParams ?? { countryCode: [], level: [] });
  const filterZoneData = zoneQueryParams ? zoneResult.data : null;

  // Utiliser le context partagé
  const { selectedFilters, setSelectedFilters, searchQuery, setSearchQuery, clearFilters: clearFiltersContext, searchByFields, setSearchByFields } = usePageFilters();
  // Initialiser les filtres par défaut (defaultChecked)
  useEffect(() => {
    const initialFilters: Record<string, string[]> = {};
    const newFilterGroups: FiltersSectionProps["filterGroups"] = [];
    propsFiltersGroups?.forEach(group => {

      if (group.type === "scopeList") {
        group.options = [];
        // Remplir les options à partir des données de zone
        filterZoneData?.forEach(zone => {
          if (group.config && group.config.level && !zone.level.some(lvl => group.config?.level?.includes(lvl))) {
            return;
          }
          const data: {
            id: string;
            label: Record<string, string>,
            level: ("cities" | "level1" | "level2" | "level3" | "level4" | "level5")
          } = {
            id: zone.id as string,
            label: {
              "fr": zone.name,
              "en": zone.name,
              "es": zone.name
            },
            level: (zone.level.length === 1 ? `level${zone.level[0]}` : `level${group.config?.level ? Math.min(...group.config.level.map(lvl => parseInt(lvl, 10))) : zone.level[0]}`) as ("cities" | "level1" | "level2" | "level3" | "level4" | "level5")
          }
          if (zone.translate && typeof zone.translate === "object" && typeof (zone.translate as Record<string, unknown>).translates === "object") {
            Object.keys((zone.translate as Record<string, Record<string, string>>).translates).forEach((lang) => {
              data.label[lang.toLowerCase()] = (zone.translate as Record<string, Record<string, string>>).translates[lang];
            })
          }
          group.options.push(data);
        });
        newFilterGroups.push(group);
      } else {
        const defaultCheckedIds = group.options
          .filter(option => option.defaultChecked)
          .map(option => option.name || option.id);

        if (defaultCheckedIds.length > 0) {
          initialFilters[group.id] = defaultCheckedIds;
        }
        newFilterGroups.push(group);
      }
    });

    if (Object.keys(initialFilters).length > 0) {
      setSelectedFilters(initialFilters);
    }
    setFilterGroups(newFilterGroups);
  }, [propsFiltersGroups, filterZoneData, setSelectedFilters]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleFilter = (groupId: string, filterName: string, field: string | null = null, value: string | string[] | null = null, level: "cities" | "level1" | "level2" | "level3" | "level4" | "level5" | null = null) => {
    if (field && value !== null) {
      setSearchByFields(prev => {
        const isActive = Object.keys(prev).includes(filterName);
        if (isActive) {
          const { [filterName]: _removed, ...rest } = prev;
          void _removed;
          return rest;
        } else {
          if (level) {
            return {
              ...prev,
              [filterName]: {
                field: field,
                type: "scopeList",
                value: {
                  id: value,
                  type: level
                }
              } as unknown as typeof prev[string]
            };
          } else {
            const valueToSet = Array.isArray(value) ? value : [value];
            return {
              ...prev,
              [filterName]: {
                field,
                value: valueToSet
              }
            };
          }
        }
      });
    } else {
      setSelectedFilters(prev => {
        const current = prev[groupId] || [];
        const updated = current.includes(filterName)
          ? current.filter(name => name !== filterName)
          : [...current, filterName];
        return { ...prev, [groupId]: updated };
      });
    }
  };

  const clearFilters = () => {
    clearFiltersContext();
  };

  const isGroupOpen = (groupId: string) => openGroups.includes(groupId);
  const isFilterSelected = (groupId: string, filterName: string) =>
    (selectedFilters[groupId] || []).includes(filterName) || Object.keys(searchByFields).includes(filterName);

  const hasActiveFilters = Object.values(selectedFilters).some(arr => arr.length > 0) || searchQuery.length > 0 || Object.keys(searchByFields).length > 0;

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
              : "text-muted-foreground/50 cursor-not-allowed"
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
                          onChange={() => group.type === "scopeList" ? toggleFilter(group.id, filterName, group.field ?? `${option.id}${option.level}`, filterName, option.level as "cities" | "level1" | "level2" | "level3" | "level4" | "level5") : toggleFilter(group.id, filterName)}
                          className="w-4 h-4 border-2 border-border rounded cursor-pointer appearance-none checked:bg-primary checked:border-primary transition"
                        />
                        {isFilterSelected(group.id, filterName) && (
                          <svg
                            className="w-3 h-3 text-primary-foreground absolute pointer-events-none"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      <span className="text-sm text-muted-foreground group-hover:text-foreground flex-1">
                        {t(option.label)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {Object.keys(filterAnswerData ?? {}).map((group) => {
          const groupData = filterAnswerData?.[group];
          if (!groupData) return null;
          return (
            <div key={group} className="border-b border-border last:border-b-0">
              {/* Group Header */}
              {
                Object.keys(groupData.values).length > 0 ? (Object.keys(groupData.values).length === 1 ?
                  (
                    <button
                      onClick={() => {
                        const singleKey = Object.keys(groupData.values)[0];
                        const singleValue = groupData.values[singleKey];
                        toggleFilter(group, group, "_id", singleValue.orgaNameArray);
                      }}
                      className="w-full flex items-center justify-between py-3 text-left hover:bg-muted transition px-2 rounded"
                    >
                      <span className="font-medium text-sm text-foreground">
                        {t(groupData.label)}
                      </span>
                    </button>
                  ) :
                  (
                    <button
                      onClick={() => toggleGroup(group)}
                      className="w-full flex items-center justify-between py-3 text-left hover:bg-muted transition px-2 rounded"
                    >
                      <span className="font-medium text-sm text-foreground">
                        {t(groupData.label)}
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform",
                          isGroupOpen(group) && "rotate-180"
                        )}
                      />
                    </button>
                  )
                ) : null
              }

              {/* Group Content */}
              {isGroupOpen(group) && (
                <div className="pb-3 px-2 space-y-2">
                  {Object.keys(groupData.values).map((optionKey) => {
                    const option = groupData.values[optionKey];
                    const filterName = optionKey;
                    return (
                      <label
                        key={optionKey}
                        className="flex items-start gap-2 cursor-pointer group"
                      >
                        {/* Checkbox */}
                        <div className="relative flex items-center justify-center mt-0.5">
                          <input
                            type="checkbox"
                            checked={isFilterSelected(group, filterName)}
                            onChange={() => toggleFilter(group, filterName, "_id", option.orgaNameArray)}
                            className="w-4 h-4 border-2 border-input rounded cursor-pointer appearance-none checked:bg-primary checked:border-primary transition"
                          />
                          {isFilterSelected(group, filterName) && (
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

                        <span className="text-sm text-muted-foreground group-hover:text-foreground flex-1">
                          {option.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  );
}
export default FiltersSection;
