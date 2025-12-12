import { Loader2, LayoutGrid, List, Plus, Search, X } from "lucide-react";
import { useState, type ReactNode, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "@/modules/profil/i18n";

interface EntityGridViewProps<T> {
  items: T[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage?: boolean;

  renderGridItem: (item: T, isLastItem: boolean) => ReactNode;
  renderDetailedItem?: (item: T, isLastItem: boolean) => ReactNode;
  emptyIcon: ReactNode;
  endIcon: ReactNode;

  emptyTitle: string;
  emptyDescription: string;
  loadingText: string;
  allLoadedTitle: string;
  allLoadedDescription: string;
  gridViewLabel?: string;
  detailedViewLabel?: string;
  createLabel?: string;

  canCreate?: boolean;
  onCreateClick?: () => void;

  showViewToggle?: boolean;
  gridCols?: string;

  searchEnabled?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}

export function EntityGridView<T>({
  items,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  renderGridItem,
  renderDetailedItem,
  emptyIcon,
  endIcon,
  emptyTitle,
  emptyDescription,
  loadingText,
  allLoadedTitle,
  allLoadedDescription,
  gridViewLabel,
  detailedViewLabel,
  createLabel,
  canCreate = false,
  onCreateClick,
  showViewToggle = true,
  gridCols = "md:grid-cols-2 lg:grid-cols-3",
  searchEnabled = false,
  searchValue = "",
  onSearchChange,
  searchPlaceholder,
}: EntityGridViewProps<T>) {
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const [isDetailedView, setIsDetailedView] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gridLabel = gridViewLabel || t("EntityGridView.gridView");
  const detailedLabel = detailedViewLabel || t("EntityGridView.detailedView");
  const defaultSearchPlaceholder = searchPlaceholder || t("EntityGridView.searchPlaceholder");

  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearchValue(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        onSearchChange?.(value);
      }, 300);
    },
    [onSearchChange]
  );

  const handleClearSearch = useCallback(() => {
    setLocalSearchValue("");
    onSearchChange?.("");
  }, [onSearchChange]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-12 sm:py-16">
          <div className="animate-pulse space-y-3 sm:space-y-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-muted rounded-full mx-auto"></div>
            <div className="h-3 sm:h-4 bg-muted rounded w-1/2 mx-auto"></div>
            <div className="h-2 sm:h-3 bg-muted rounded w-1/3 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {canCreate && createLabel && onCreateClick && (
          <div className="flex justify-end">
            <Button
              onClick={onCreateClick}
              className="bg-primary hover:bg-primary/90 text-xs sm:text-sm text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              {createLabel}
            </Button>
          </div>
        )}

        <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
          <div className="text-center py-12 sm:py-16">
            <div className="text-muted-foreground mb-3 sm:mb-4">
              {emptyIcon}
            </div>
            <p className="text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2 px-4">
              {emptyTitle}
            </p>
            <p className="text-sm sm:text-base text-muted-foreground px-4">
              {emptyDescription}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasDetailedView = !!renderDetailedItem;

  return (
    <div className="space-y-4 sm:space-y-6">
      {(showViewToggle || canCreate || searchEnabled) && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {showViewToggle && hasDetailedView && (
              <>
                <Button
                  variant={!isDetailedView ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsDetailedView(false)}
                  className={!isDetailedView ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}
                >
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  {gridLabel}
                </Button>
                <Button
                  variant={isDetailedView ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsDetailedView(true)}
                  className={isDetailedView ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}
                >
                  <List className="w-4 h-4 mr-2" />
                  {detailedLabel}
                </Button>
              </>
            )}

            {searchEnabled && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={localSearchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={defaultSearchPlaceholder}
                  className="pl-9 pr-8 h-9 w-48 sm:w-56"
                />
                {localSearchValue && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-sm"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            )}
          </div>

          {canCreate && createLabel && onCreateClick && (
            <Button
              onClick={onCreateClick}
              className="bg-primary hover:bg-primary/90 text-xs sm:text-sm text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              {createLabel}
            </Button>
          )}
        </div>
      )}

      {!isDetailedView && (
        <div className={`grid gap-4 ${gridCols}`}>
          {items.map((item, index) => renderGridItem(item, index === items.length - 1))}
        </div>
      )}

      {isDetailedView && hasDetailedView && (
        <div className="space-y-4">
          {items.map((item, index) => renderDetailedItem!(item, index === items.length - 1))}
        </div>
      )}

      {isFetchingNextPage && (
        <div className="bg-background p-8 rounded-xl border border-border shadow-sm">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-3 font-medium">
              {loadingText}
            </p>
          </div>
        </div>
      )}

      {!hasNextPage && items.length > 0 && (
        <div className="bg-background p-6 sm:p-8 rounded-xl border border-border shadow-sm">
          <div className="text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
              {endIcon}
            </div>
            <p className="text-sm sm:text-base text-foreground font-semibold mb-1">
              {allLoadedTitle}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {allLoadedDescription}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
