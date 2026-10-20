import { ArrowRight, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import NavLink from "@/components/layout/NavLink";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useT } from "@/hooks/useT";
import { AacDirectoryFilters } from "../AacDirectoryFilters";
import { AacDirectoryResults } from "../AacDirectoryResults";
import { AacDepositButton } from "../AacDepositButton";
import type { AacDisplayMode } from "../../../schema";
import type { AacDirectoryShellProps } from "./shells";

/**
 * Annuaire, disposition par défaut : colonne de filtres à gauche, compteur et bascule
 * au-dessus des résultats. Vue du contrôleur (`useAacDirectoryController`).
 */
export default function AacDirectoryShellDefault({ id, vm }: AacDirectoryShellProps) {
  const t = useT("modules/aac");
  const { header } = vm;
  const isPreview = vm.mode === "preview";

  return (
    <section id={id} className={cn("space-y-8 py-12", vm.className)}>
      {/* Bouton de dépôt sur la ligne du titre, comme le legacy. */}
      {header && (
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            {header.title !== null && (
              <h2 className="text-3xl font-bold tracking-tight">{header.title}</h2>
            )}
            {header.description !== null && (
              <p className="text-muted-foreground">{header.description}</p>
            )}
          </div>

          {header.deposit && (
            <AacDepositButton {...header.deposit} />
          )}
        </header>
      )}

      {/* Aperçu : la grille et son lien, sans filtres, compteur ni bascule. */}
      {isPreview ? (
        <div className="space-y-8">
          <AacDirectoryResults {...vm.results} />

          {vm.moreLink && (
            <div className="flex justify-center">
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <NavLink to={vm.moreLink.href}>
                  {vm.moreLink.label ?? String(t("directory.more"))}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </NavLink>
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Filtres en colonne (accordéons sans repousser la grille), empilés sous `lg`. */
        <div className="grid gap-8 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:items-start">
          <AacDirectoryFilters {...vm.filters} />

          <div className="space-y-4">
            {/* Compteur à gauche, bascule d'affichage à droite (disposition du legacy). */}
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {vm.count}{" "}
                {String(t(vm.count > 1 ? "directory.count_other" : "directory.count_one"))}
              </p>

              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={vm.display.value}
                // Ignore la désélection (`""`) qu'autorise un groupe Radix `single`.
                onValueChange={(value) => {
                  if (value) vm.display.onChange(value as AacDisplayMode);
                }}
                aria-label={String(t("directory.display.label"))}
              >
                <ToggleGroupItem value="grid" aria-label={String(t("directory.display.grid"))}>
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label={String(t("directory.display.list"))}>
                  <List className="h-4 w-4" aria-hidden="true" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <AacDirectoryResults {...vm.results} />
          </div>
        </div>
      )}
    </section>
  );
}
