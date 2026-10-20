import { ArrowRight, LayoutGrid, List, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import NavLink from "@/components/layout/NavLink";
import { useT } from "@/hooks/useT";
import { AacDirectoryResults } from "../../components/directory/AacDirectoryResults";
import { AacDepositButton } from "../../components/directory/AacDepositButton";
import type { AacDirectoryShellProps } from "../../components/directory/variants/shells";
import { AAC_SORT_KEYS, hasActiveFilters, type AacSortKey } from "../../lib/filtersKey";
import {
  maturityOptionsOf,
  resetFilters,
  toggleIn,
  toggleUsageCategory,
  visibleUsageSubs,
} from "../../lib/directoryFilterActions";
import type { AacDisplayMode } from "../../schema";
import { FilterPopover } from "./FilterPopover";

/** Valeur sentinelle du tri « par défaut » : un `SelectItem` Radix refuse la chaîne vide. */
const NO_SORT = "__none";

/**
 * Annuaire, disposition « editorial » (page projets de la maquette projets.re) : barre de filtres
 * au-dessus des résultats, puis compteur, réinitialisation, tri et bascule.
 * Vue du contrôleur : état et options de `vm.filters`, gestes de `lib/directoryFilterActions`.
 * Chaque contrôle porte `data-aac-filter` ; un filtre sans option n'est pas rendu.
 */
export default function DirectoryShellEditorial({ id, vm }: AacDirectoryShellProps) {
  const t = useT("modules/aac");
  const { header } = vm;
  const { filters, onChange, enabled, usageTree, tagOptions, communeOptions, maturityField, isLoading } =
    vm.filters;
  const isPreview = vm.mode === "preview";
  const subs = visibleUsageSubs(usageTree, filters.usage);

  return (
    <section id={id} className={cn("py-12", vm.className)}>
      {header && (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {header.title !== null && <h2 className="font-display text-4xl font-semibold">{header.title}</h2>}
            {header.description !== null && (
              <p className="mt-2 max-w-2xl text-muted-foreground">{header.description}</p>
            )}
          </div>
          {header.deposit && <AacDepositButton {...header.deposit} />}
        </header>
      )}

      {isPreview ? (
        <div className="mt-8 space-y-8">
          <AacDirectoryResults {...vm.results} />
          {vm.moreLink && (
            <div className="flex justify-center">
              <Button asChild variant="outline">
                <NavLink to={vm.moreLink.href}>
                  {vm.moreLink.label ?? String(t("directory.more"))}
                  <ArrowRight className="ml-1 size-4" aria-hidden="true" />
                </NavLink>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-6">
            {enabled.search && (
              <div className="relative md:col-span-2">
                <Search
                  className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  data-aac-filter="search"
                  value={filters.q}
                  onChange={(e) => onChange({ ...filters, q: e.target.value })}
                  placeholder={String(t("editorial.directory.searchPlaceholder"))}
                  aria-label={String(t("directory.search.label"))}
                  maxLength={100}
                  className="pl-9"
                />
              </div>
            )}

            {enabled.tags && (
              <FilterPopover
                name="tags"
                label={String(t("editorial.directory.filters.tags"))}
                isLoading={isLoading}
                groups={[
                  {
                    options: tagOptions,
                    selected: filters.tags,
                    onToggle: (tag) => onChange({ ...filters, tags: toggleIn(filters.tags, tag) }),
                  },
                ]}
                onClear={() => onChange({ ...filters, tags: [] })}
              />
            )}

            {enabled.commune && (
              <FilterPopover
                name="commune"
                label={String(t("editorial.directory.filters.commune"))}
                isLoading={isLoading}
                groups={[
                  {
                    options: communeOptions,
                    selected: filters.commune,
                    onToggle: (commune) =>
                      onChange({ ...filters, commune: toggleIn(filters.commune, commune) }),
                  },
                ]}
                onClear={() => onChange({ ...filters, commune: [] })}
              />
            )}

            {enabled.usage && (
              <FilterPopover
                name="usage"
                label={String(t("editorial.directory.filters.usage"))}
                isLoading={isLoading}
                groups={[
                  {
                    options: usageTree.map((c) => ({ id: c.id, label: c.label, count: c.count })),
                    selected: filters.usage,
                    // Les sous-catégories inatteignables tombent avec leur catégorie.
                    onToggle: (category) => onChange(toggleUsageCategory(filters, usageTree, category)),
                  },
                  {
                    legend: String(t("editorial.directory.filters.usageSubCategory")),
                    options: subs.map((s) => ({ id: s.id, label: s.label, count: s.count })),
                    selected: filters.usageSub,
                    onToggle: (sub) => onChange({ ...filters, usageSub: toggleIn(filters.usageSub, sub) }),
                  },
                ]}
                onClear={() => onChange({ ...filters, usage: [], usageSub: [] })}
              />
            )}

            {enabled.maturity && (
              <FilterPopover
                name="maturity"
                label={String(t("editorial.directory.filters.maturity"))}
                // Question complète du formulaire en infobulle.
                title={maturityField?.label}
                isLoading={isLoading}
                groups={[
                  {
                    options: maturityOptionsOf(maturityField),
                    selected: filters.maturity,
                    onToggle: (value) => onChange({ ...filters, maturity: toggleIn(filters.maturity, value) }),
                  },
                ]}
                onClear={() => onChange({ ...filters, maturity: [] })}
              />
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {String(
                t(vm.count > 1 ? "editorial.directory.count_other" : "editorial.directory.count_one", undefined, {
                  count: vm.count,
                })
              )}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!hasActiveFilters(filters)}
                onClick={() => onChange(resetFilters())}
              >
                {String(t("editorial.directory.reset"))}
              </Button>

              {enabled.sort && (
                <Select
                  value={filters.sort || NO_SORT}
                  onValueChange={(value) =>
                    onChange({ ...filters, sort: (value === NO_SORT ? "" : value) as AacSortKey })
                  }
                >
                  <SelectTrigger
                    size="sm"
                    data-aac-filter="sort"
                    aria-label={String(t("editorial.directory.filters.sort"))}
                    className="w-56"
                  >
                    {/* Libellé explicite : fermé, le `Select` ne connaît pas le texte de ses options. */}
                    <SelectValue>
                      {filters.sort
                        ? String(t(`directory.sort.${filters.sort}`))
                        : String(t("editorial.directory.filters.sortDefault"))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SORT}>{String(t("editorial.directory.filters.sortDefault"))}</SelectItem>
                    {AAC_SORT_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {String(t(`directory.sort.${key}`))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

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
                  <LayoutGrid className="size-4" aria-hidden="true" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label={String(t("directory.display.list"))}>
                  <List className="size-4" aria-hidden="true" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="mt-4">
            <AacDirectoryResults {...vm.results} />
          </div>
        </>
      )}
    </section>
  );
}
