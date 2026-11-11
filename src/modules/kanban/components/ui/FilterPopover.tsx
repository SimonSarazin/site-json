import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { normalizeSearchText } from "@/modules/kanban/lib/boardFilter";
import { ChoiceRow } from "./ChoiceRow";

export interface FilterChoice {
  value: string;
  label: string;
  /** Cartes portant cette valeur, sur TOUT le tableau (cf. `boardFilterOptions`). */
  count?: number;
  /** Repère visuel DÉCORATIF (point de priorité, portrait, pastille) : le libellé dit tout. */
  leading?: ReactNode;
}

export interface FilterPopoverProps {
  /** Libellé du déclencheur ET nom accessible du panneau (« Priorité »). */
  label: string;
  choices: readonly FilterChoice[];
  /** Valeurs cochées. */
  selected: readonly string[];
  onToggle: (value: string) => void;
  /** Vide la facette (les autres filtres restent). */
  onClear: () => void;
  /** Ce que dit le panneau quand la facette n'a aucun choix (« Aucune étiquette »). */
  emptyText: string;
  /** Champ de recherche interne : utile dès que la liste dépasse un écran. */
  searchable?: boolean;
}

/**
 * Popover de filtre : un déclencheur + une liste de cases à cocher, sur le `Popover` du site.
 * Repris de co-kanban (`components/ui/FilterPopover.tsx`).
 *
 * Présentationnel pur : il ne connaît ni le tableau ni le moteur de filtrage. Actif, le
 * déclencheur prend le filet et la teinte de la couleur primaire ET affiche le nombre de
 * valeurs cochées — jamais la couleur seule.
 */
export function FilterPopover({ label, choices, selected, onToggle, onClear, emptyText, searchable = false }: FilterPopoverProps) {
  const { t } = useTranslation("modules/kanban");
  const count = selected.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("shrink-0 pointer-coarse:min-h-11", count > 0 && "border-primary bg-primary/10 hover:bg-primary/15")}>
          {label}
          {count > 0 ? (
            <>
              <span aria-hidden className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold text-primary-foreground tabular-nums">
                {count}
              </span>
              <span className="sr-only">{t("filterBar.selectedCount", { count })}</span>
            </>
          ) : null}
          <ChevronDown aria-hidden className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      {/* `kanban-module` : le panneau est rendu dans un PORTAIL, hors de la racine du module ; sans
          elle, les points de priorité et la barre de défilement perdaient leurs variables `--ck-*`. */}
      <PopoverContent align="start" aria-label={label} className="kanban-module w-72 p-0">
        <FilterPanel label={label} choices={choices} selected={selected} onToggle={onToggle} onClear={onClear} emptyText={emptyText} searchable={searchable} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Contenu du panneau, dans un composant à part : le popover ne le monte qu'à l'ouverture, donc
 * la recherche interne repart VIDE à chaque fois — retrouver une liste filtrée par une frappe
 * d'il y a dix minutes ferait croire à des choix disparus.
 */
function FilterPanel({ label, choices, selected, onToggle, onClear, emptyText, searchable }: FilterPopoverProps) {
  const { t } = useTranslation("modules/kanban");
  const searchId = useId();
  const [query, setQuery] = useState("");
  const needle = normalizeSearchText(query.trim());
  const visible = needle === "" ? choices : choices.filter((choice) => normalizeSearchText(choice.label).includes(needle));

  return (
    <div className="flex flex-col">
      {searchable && choices.length > 0 ? (
        <div className="relative border-b border-border p-2">
          <label htmlFor={searchId} className="sr-only">
            {t("filterBar.searchIn", { label })}
          </label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id={searchId} type="search" value={query} placeholder={t("filterBar.searchPlaceholder")} autoComplete="off" className="pl-9" onChange={(event) => setQuery(event.target.value)} />
        </div>
      ) : null}

      {choices.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">{emptyText}</p>
      ) : visible.length === 0 ? (
        <p role="status" className="px-3 py-4 text-sm text-muted-foreground">
          {t("filterBar.noMatch")}
        </p>
      ) : (
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">{label}</legend>
          <ul className="flex max-h-72 flex-col overflow-y-auto overscroll-contain p-1 [scrollbar-color:var(--ck-scrollbar)_transparent] [scrollbar-width:thin]">
            {visible.map((choice) => (
              <li key={choice.value}>
                <ChoiceRow
                  checked={selected.includes(choice.value)}
                  onChange={() => onToggle(choice.value)}
                  leading={
                    choice.leading ? (
                      <span aria-hidden className="flex shrink-0 items-center">
                        {choice.leading}
                      </span>
                    ) : undefined
                  }
                  trailing={choice.count}
                >
                  <span className="block truncate">{choice.label}</span>
                </ChoiceRow>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="flex justify-end border-t border-border p-2">
        <Button variant="ghost" size="sm" disabled={selected.length === 0} onClick={onClear}>
          {t("filterBar.clear")}
        </Button>
      </div>
    </div>
  );
}
