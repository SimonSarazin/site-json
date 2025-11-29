import { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/useT";

interface EntityGridProps<T> {
  items: T[];
  isLoading: boolean;
  isFetchingNext: boolean;
  hasNextPage: boolean;
  lastItemRef: (node: HTMLElement | null) => void;
  renderItem: (
    item: T,
    index: number,
    isLast: boolean,
    ref?: (node: HTMLElement | null) => void
  ) => ReactNode;
  emptyState?: ReactNode;
  columns?: { sm?: number; md?: number; lg?: number; xl?: number };
  // Recherche
  searchEnabled?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  // Header optionnel
  header?: ReactNode;
}

export function EntityGrid<T>({
  items,
  isLoading,
  isFetchingNext,
  hasNextPage,
  lastItemRef,
  renderItem,
  emptyState,
  columns = { sm: 1, md: 2, lg: 3, xl: 4 },
  searchEnabled = false,
  searchValue = "",
  onSearchChange,
  searchPlaceholder,
  header,
}: EntityGridProps<T>) {
  const t = useT("modules/profil");

  // Génère les classes de colonnes
  const getGridCols = () => {
    const classes = ["grid", "gap-4"];
    if (columns.sm) classes.push(`grid-cols-${columns.sm}`);
    if (columns.md) classes.push(`md:grid-cols-${columns.md}`);
    if (columns.lg) classes.push(`lg:grid-cols-${columns.lg}`);
    if (columns.xl) classes.push(`xl:grid-cols-${columns.xl}`);
    return classes.join(" ");
  };

  return (
    <div className="space-y-4">
      {/* Header et recherche */}
      {(searchEnabled || header) && (
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          {header}
          {searchEnabled && onSearchChange && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={searchPlaceholder || t("common.search")}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
        </div>
      )}

      {/* État de chargement initial */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-muted-foreground mt-2">{t("common.loading")}</p>
        </div>
      ) : items.length === 0 ? (
        // État vide
        emptyState || (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t("common.noResults")}</p>
          </div>
        )
      ) : (
        // Grille d'éléments
        <div className={getGridCols()}>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return renderItem(
              item,
              index,
              isLast,
              isLast && hasNextPage ? lastItemRef : undefined
            );
          })}
        </div>
      )}

      {/* Indicateur de chargement pour les pages suivantes */}
      {isFetchingNext && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-muted-foreground text-sm mt-2">
            {t("common.loading")}
          </p>
        </div>
      )}
    </div>
  );
}
