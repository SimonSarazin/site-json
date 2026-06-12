// ------------------------------------------------------------
// filterFields.tsx — champs de filtre compacts (matrice de sélection)
// ------------------------------------------------------------
// Les 3 widgets du pattern « equipements / observatoire », EXTRAITS de
// l'observatoire pour être partagés (l'observatoire dépend déjà du module
// search — jamais l'inverse) :
//   - SelectField        : sélection simple (Radix Select)
//   - MultiCheckboxField : multi SANS recherche (DropdownMenu + cases)
//   - MultiField         : recherche + badges (MultipleSelector) ; `single`
//     = le nouveau choix REMPLACE le précédent
// Valeur = chaîne jointe par virgule (format URL maison partagé).

import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultipleSelector from "@/components/ui/multiple-selector";

export interface FilterFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>;
  /** Libellé « toutes valeurs » — toujours fourni par l'appelant (i18n). */
  allLabel: string;
}

/** Radix Select interdit `value=""` sur un item — sentinelle pour « Tous »
 *  (la valeur de filtre reste `""` côté formulaire/logique). */
const ALL_SENTINEL = "__all__";

export function SelectField({ label, value, onChange, options, allLabel }: FilterFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select
        value={value === "" ? ALL_SENTINEL : value}
        onValueChange={(v) => onChange(v === ALL_SENTINEL ? "" : v)}
      >
        <SelectTrigger className="w-full" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SENTINEL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Multi SANS recherche — combobox shadcn canonique (Popover + Command) :
 *  trigger au look SelectTrigger, items au look SelectItem (coche à DROITE),
 *  le « Select normal multi » que Radix Select (2.2.6, pas de prop multiple)
 *  ne sait pas faire nativement. Reste ouvert pendant la multi-sélection. */
export function MultiCheckboxField({ label, value, onChange, options, allLabel, selectedCountLabel }: FilterFieldProps & { selectedCountLabel: (n: number) => string }) {
  const selected = value.split(",").map((v) => v.trim()).filter(Boolean);
  const triggerLabel =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.label ?? selected[0])
        : selectedCountLabel(selected.length);
  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((v) => v !== id)
      : [...selected, id];
    onChange(next.join(","));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          {/* Aligné visuellement sur le SelectTrigger (bordure/fond/graisse) ;
              le survol vient du Button outline standard (muted — neutre quel
              que soit le thème). */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full justify-between border-input bg-transparent font-normal"
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-48 p-1">
          <Command shouldFilter={false}>
            <CommandList className="max-h-72">
              <CommandGroup>
                <CommandItem onSelect={() => onChange("")}>{allLabel}</CommandItem>
                <CommandSeparator className="my-1" />
                {options.map((o) => (
                  <CommandItem key={o.id} onSelect={() => toggle(o.id)}>
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
    </div>
  );
}

/** Sélection avec RECHERCHE (cmdk intégré + badges) — valeur jointe par
 *  virgule (format URL maison). `single` : le nouveau choix REMPLACE le
 *  précédent (sélection unique avec recherche). */
export function MultiField({ label, value, onChange, options, allLabel, noResult, single }: FilterFieldProps & { noResult: string; single?: boolean }) {
  const selected = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => ({ value: v, label: options.find((o) => o.id === v)?.label ?? v }));
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <MultipleSelector
        value={selected}
        onChange={(opts) => {
          const kept = single ? opts.slice(-1) : opts;
          onChange(kept.map((o) => o.value).join(","));
        }}
        options={options.map((o) => ({ value: o.id, label: o.label }))}
        placeholder={allLabel}
        hidePlaceholderWhenSelected
        emptyIndicator={<p className="text-center text-sm text-muted-foreground">{noResult}</p>}
        // Hauteur EXACTE de 32px (h-8, comme Select/dropdown) quel que soit
        // l'état : padding racine/input neutralisés (ils s'empilaient → 38px),
        // le wrap interne est centré à 30px (+2px de bordure). Avec plusieurs
        // lignes de badges, min-h laisse grandir.
        className="min-h-8 px-3 py-0 [&>div]:min-h-[30px] [&>div]:items-center"
        inputProps={{ className: "px-0 py-0" }}
      />
    </div>
  );
}
