import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { ToolsCatalogFacets } from "@communecter/cocolight-api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { ToolFilters } from "./ToolFilters";
import { ToolFiltersSkeleton } from "./ToolsCatalogSkeleton";

interface ToolFiltersSheetProps {
  facets: ToolsCatalogFacets;
  category: string;
  usage: string;
  showCategory: boolean;
  showUsage: boolean;
  /** Facettes chargées ? Sinon squelette, exactement comme la barre latérale. */
  hasFacets: boolean;
  onCategoryChange: (v: string) => void;
  onUsageChange: (v: string) => void;
  className?: string;
}

/**
 * Accès aux filtres du catalogue sur petit écran.
 *
 * En dessous de `lg`, la barre latérale n'était pas rétrécie mais **empilée**
 * au-dessus de la colonne principale : toutes les pastilles de catégorie et de
 * sous-catégorie repoussaient la recherche et les résultats sous la ligne de
 * flottaison. Elle est remplacée par un bouton qui ouvre les mêmes filtres dans
 * un panneau, la recherche restant visible en permanence.
 *
 * Le rendu des filtres reste `ToolFilters` : une seule définition, partagée avec
 * le desktop — ce composant n'apporte qu'un contenant.
 *
 * Pattern repris de `observatoire/Filters` et `search/FiltersSection` : bouton à
 * compteur, `Sheet` par le bas, pied « réinitialiser » / « voir les résultats ».
 * Le compteur n'est pas décoratif : panneau refermé, c'est le seul indice qu'un
 * filtre reste appliqué.
 */
export function ToolFiltersSheet({
  facets,
  category,
  usage,
  showCategory,
  showUsage,
  hasFacets,
  onCategoryChange,
  onUsageChange,
  className,
}: ToolFiltersSheetProps) {
  const t = useT("modules/toolsCatalog");
  const [open, setOpen] = useState(false);

  // On ne compte que ce que CE panneau pilote. Le filtre « open source » et la
  // bascule grille/liste restent dans la barre d'outils : les compter
  // afficherait un compteur pour un réglage que l'utilisateur a sous les yeux.
  const activeCount = (category ? 1 : 0) + (usage ? 1 : 0);

  const reinitialiser = () => {
    onCategoryChange("");
    onUsageChange("");
  };

  return (
    <div className={cn("shrink-0", className)}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            {t("filter.title")}
            {activeCount > 0 && <Badge className="rounded-full px-2">{activeCount}</Badge>}
          </Button>
        </SheetTrigger>

        <SheetContent side="bottom" className="max-h-[85vh] gap-0 rounded-t-2xl p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              {t("filter.title")}
              {activeCount > 0 && <Badge className="rounded-full px-2">{activeCount}</Badge>}
            </SheetTitle>
          </SheetHeader>

          <div className="overflow-y-auto p-4">
            {hasFacets ? (
              <ToolFilters
                facets={facets}
                category={category}
                usage={usage}
                showCategory={showCategory}
                showUsage={showUsage}
                onCategoryChange={onCategoryChange}
                onUsageChange={onUsageChange}
              />
            ) : (
              <ToolFiltersSkeleton />
            )}
          </div>

          <SheetFooter className="flex-row gap-2 border-t border-border">
            {activeCount > 0 && (
              <Button variant="ghost" className="flex-1" onClick={reinitialiser}>
                {t("filter.reset")}
              </Button>
            )}
            <SheetClose asChild>
              <Button className="flex-1">{t("filter.showResults")}</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
