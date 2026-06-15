import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export interface MultiComboboxOption {
  id: string;
  label: React.ReactNode;
}

interface MultiComboboxProps {
  /** Élément déclencheur (monté en `asChild` — typiquement un Button outline). */
  children: React.ReactNode;
  options: MultiComboboxOption[];
  /** Ids sélectionnés (coche à droite). */
  selected: string[];
  onToggle: (id: string) => void;
  /** Item « Tous » en tête (efface la sélection via `onClear`). Omis si absent. */
  allLabel?: React.ReactNode;
  onClear?: () => void;
  align?: "start" | "center" | "end";
  contentClassName?: string;
}

/**
 * Combobox MULTI sans recherche — le pattern canonique shadcn (Popover +
 * Command) là où Radix Select n'a pas de multi natif : items au look
 * SelectItem avec coche à DROITE, popover qui RESTE OUVERT pendant la
 * multi-sélection. Source unique des trois usages historiques (champs de
 * filtre compacts, dropdowns du searchHeader, modal de filtres SearchPro).
 */
export function MultiCombobox({
  children,
  options,
  selected,
  onToggle,
  allLabel,
  onClear,
  align = "start",
  contentClassName,
}: MultiComboboxProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn("w-(--radix-popover-trigger-width) min-w-48 p-1", contentClassName)}
      >
        <Command shouldFilter={false}>
          <CommandList className="max-h-72">
            <CommandGroup>
              {allLabel !== undefined && (
                <>
                  <CommandItem onSelect={() => onClear?.()}>{allLabel}</CommandItem>
                  {options.length > 0 && <CommandSeparator className="my-1" />}
                </>
              )}
              {options.map((o) => (
                <CommandItem key={o.id} onSelect={() => onToggle(o.id)}>
                  {o.label}
                  <Check
                    className={cn("ml-auto h-4 w-4", selected.includes(o.id) ? "opacity-100" : "opacity-0")}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
