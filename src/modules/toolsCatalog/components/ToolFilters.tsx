import type { ToolsCatalogFacets } from "@communecter/cocolight-api-client";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";

interface ToolFiltersProps {
  facets: ToolsCatalogFacets;
  category: string;
  usage: string;
  showCategory: boolean;
  showUsage: boolean;
  onCategoryChange: (v: string) => void;
  onUsageChange: (v: string) => void;
}

/** Pastille de filtre (état actif = fond foncé, comme le legacy). */
function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * Filtres du catalogue en barre latérale de pastilles (inspiré du legacy) :
 * « Catégorie d'usage » puis « Sous-catégorie d'usage ». « Tous » = pas de filtre.
 * La sous-catégorie se restreint à la catégorie sélectionnée (`usagesByCategory`).
 */
export function ToolFilters({
  facets,
  category,
  usage,
  showCategory,
  showUsage,
  onCategoryChange,
  onUsageChange,
}: ToolFiltersProps) {
  const t = useT("modules/toolsCatalog");

  // Sous-catégories restreintes à la catégorie choisie (fallback : toutes).
  const usages =
    category && facets.usagesByCategory?.[category] ? facets.usagesByCategory[category] : facets.usages;

  return (
    <div className="space-y-6">
      {showCategory && facets.categories.length > 0 && (
        <FilterGroup title={t("filter.categoryTitle")}>
          <Pill active={category === ""} onClick={() => onCategoryChange("")}>
            {t("filter.all")}
          </Pill>
          {facets.categories.map((c) => (
            <Pill key={c} active={category === c} onClick={() => onCategoryChange(c)}>
              {c}
            </Pill>
          ))}
        </FilterGroup>
      )}

      {showUsage && usages.length > 0 && (
        <FilterGroup title={t("filter.subCategoryTitle")}>
          <Pill active={usage === ""} onClick={() => onUsageChange("")}>
            {t("filter.all")}
          </Pill>
          {usages.map((u) => (
            <Pill key={u} active={usage === u} onClick={() => onUsageChange(u)}>
              {u}
            </Pill>
          ))}
        </FilterGroup>
      )}
    </div>
  );
}
