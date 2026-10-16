import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import type { AacFacetOption } from "../../lib/directoryFilterActions";

/** Groupe d'options cochables (l'usage en a deux : catégories, sous-catégories). */
export interface FilterGroup {
  legend?: string;
  options: AacFacetOption[];
  selected: string[];
  onToggle: (id: string) => void;
}

/**
 * Filtre de la barre « editorial » : déclencheur façon `Select` ouvrant des cases à cocher
 * (plusieurs valeurs par facette). En chargement : annoncé mais inerte ; sans option : non rendu.
 */
export function FilterPopover({
  name,
  label,
  title,
  groups,
  onClear,
  isLoading = false,
}: {
  /** Nom du filtre, posé en `data-aac-filter` (contrat de conformité). */
  name: string;
  label: string;
  /** Texte long facultatif, en infobulle. */
  title?: string;
  groups: FilterGroup[];
  onClear: () => void;
  isLoading?: boolean;
}) {
  const t = useT("modules/aac");
  const optionCount = groups.reduce((n, g) => n + g.options.length, 0);
  const selectedCount = groups.reduce((n, g) => n + g.selected.length, 0);

  if (isLoading && optionCount === 0) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        data-aac-filter={name}
        className="w-full justify-between font-normal"
        title={title}
      >
        <span className="truncate">{label}</span>
        <Spinner label={String(t("directory.loading"))} />
      </Button>
    );
  }

  if (optionCount === 0) return null;

  const summary =
    selectedCount === 0
      ? String(t("editorial.directory.filters.all"))
      : String(
          t(
            selectedCount > 1 ? "editorial.directory.filters.selected_other" : "editorial.directory.filters.selected_one",
            undefined,
            { count: selectedCount }
          )
        );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          data-aac-filter={name}
          className={cn("w-full justify-between font-normal", selectedCount > 0 && "border-primary/60")}
          title={title}
        >
          <span className="truncate">
            <span className="text-muted-foreground">{label}</span>
            <span aria-hidden="true"> · </span>
            {summary}
          </span>
          <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="max-h-80 space-y-4 overflow-y-auto p-4">
          {groups
            .filter((group) => group.options.length > 0)
            .map((group, gi) => (
              <fieldset key={group.legend ?? gi}>
                {group.legend && (
                  <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.legend}
                  </legend>
                )}
                <ul className="space-y-2">
                  {group.options.map((option) => {
                    const id = `aac-editorial-${name}-${gi}-${option.id}`;
                    return (
                      <li key={option.id} className="flex items-center gap-2">
                        <Checkbox
                          id={id}
                          checked={group.selected.includes(option.id)}
                          onCheckedChange={() => group.onToggle(option.id)}
                        />
                        <label htmlFor={id} className="flex flex-1 cursor-pointer items-center justify-between gap-2 text-sm">
                          {option.label}
                          {typeof option.count === "number" && option.count > 0 && (
                            <span className="text-xs text-muted-foreground">{option.count}</span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            ))}
        </div>
        {selectedCount > 0 && (
          <div className="border-t p-2">
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={onClear}>
              {String(t("editorial.directory.filters.all"))}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
