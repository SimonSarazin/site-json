import { CheckIcon, Loader2Icon, X as XIcon, Frown, Plus as PlusIcon } from "lucide-react";
import { useId, useState, useEffect, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useDebounce } from "../../hooks/useDebounce";

interface SelectOption {
  id: string;
  label: string;
  value: unknown;
  type?: string;
  thumb?: string;
}

function isSameValue(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  if (typeof a === "object" && typeof b === "object") {
    return "id" in a && "id" in b && a.id === b.id;
  }
  return a === b;
}

interface SelectObjectProps {
  value: unknown | unknown[];
  onChange: (value: unknown) => void;
  options?: SelectOption[];
  delay?: number;
  onSearch?: (query: string) => Promise<SelectOption[]>;
  placeholder?: string;
  placeholderSearch?: string;
  multiple?: boolean;
  /** Autorise une valeur ABSENTE de la liste : la saisie devient une proposition à ajouter. */
  creatable?: boolean;
  /** Libellé de la proposition d'ajout (défaut : `Ajouter « X »`). */
  createLabel?: (query: string) => string;
  loadingIndicator?: ReactNode;
  emptyIndicator?: ReactNode;
  className?: string;
  buttonClassName?: string;
  placeholderClassName?: string;
  pillContainerClassName?: string;
  pillClassName?: string;
  pillLabelClassName?: string;
  pillTypeClassName?: string;
  pillRemoveClassName?: string;
  listClassName?: string;
  itemClassName?: string;
  inputClassName?: string;
  itemLabelClassName?: string;
  itemTypeClassName?: string;
  thumbClassName?: string;
  checkIconClassName?: string;
  deleteIconClassName?: string;
}

/**
 * SelectObject thèmeable :
 * - Conserve l'agencement par défaut via props de style par défaut
 * - Expose des props pour override tout en gardant la structure
 */
export function SelectObject({
  value,
  onChange,
  options: arrayOptions,
  delay = 300,
  onSearch,
  placeholder,
  placeholderSearch = "Search...",
  multiple = false,
  creatable = false,
  createLabel = (q: string) => `Ajouter « ${q} »`,
  loadingIndicator = <Loader2Icon className="animate-spin" />,
  emptyIndicator = <Frown
    className="w-6 h-6 text-muted-foreground"
    aria-label="Aucun résultat"
  />,
  // Style props with defaults
  className = "w-full",
  // `min-h-9` : sans lui, un champ SANS sélection ET SANS placeholder n'a aucun contenu, et `h-auto`
  // le réduit à ses seuls paddings — 18 px mesurés, contre 36-38 px pour les champs voisins. La
  // hauteur ne doit pas dépendre de la présence d'un libellé d'invite.
  buttonClassName = "w-full max-w-full min-w-0 overflow-hidden h-auto min-h-9 py-2 text-left flex flex-wrap items-start gap-1 " +
                    "border border-input rounded-md " +
                    "focus:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
  placeholderClassName = "text-muted-foreground truncate",
  pillContainerClassName = "flex flex-wrap items-start gap-1 w-full min-w-0",
  pillClassName = "bg-primary rounded-md px-2 py-1 flex items-start space-x-1 break-words max-w-full min-w-0",
  pillLabelClassName = "font-medium text-primary-foreground truncate",
  pillTypeClassName = "text-xs text-muted",
  pillRemoveClassName = "inline-flex items-center justify-center p-1 rounded cursor-pointer text-muted-foreground hover:bg-muted-foreground hover:text-foreground",
  listClassName = "max-h-60 overflow-auto w-full bg-popover text-popover-foreground",
  itemClassName = "flex items-center w-full space-x-2 py-2 px-3 hover:bg-muted-foreground hover:text-foreground",
  inputClassName = "w-full px-3 py-2",
  itemLabelClassName = "font-medium text-foreground truncate",
  itemTypeClassName = "text-xs text-muted-foreground",
  thumbClassName = "w-8 h-8 rounded object-cover flex-shrink-0",
  checkIconClassName = "h-4 w-4 flex-shrink-0 text-foreground",
  deleteIconClassName = "h-4 w-4",
}: SelectObjectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debSearch = useDebounce(search, delay);

  const [options, setOptions] = useState(arrayOptions ?? []);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setOptions(arrayOptions ?? []);
  }, [arrayOptions]);

  useEffect(() => {
    if (!onSearch) return;
    let active = true;
    setIsLoading(true);
    onSearch(debSearch)
      .then((res) => { if (active) setOptions(res); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [debSearch, onSearch]);

  const isSelected = (optVal: unknown): boolean => multiple
    ? (Array.isArray(value) ? value : []).some((v: unknown) => isSameValue(v, optVal))
    : isSameValue(value, optVal);

  const toggleVal = (optVal: unknown): void => {
    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      const exists = current.some((v: unknown) => isSameValue(v, optVal));
      onChange(exists ? current.filter((v: unknown) => !isSameValue(v, optVal)) : [...current, optVal]);
    } else {
      onChange(optVal);
      setOpen(false);
    }
  };
  
  return (
    <div className={className}>
      {/* PAS de `modal` : dans un Dialog, un Popover `modal` pose un 2e scroll-lock react-remove-scroll sur
          le même compteur → quand le Dialog se ferme après ouverture d'un select, le compteur se désynchronise
          et `overflow:hidden` reste coincé sur <body> (scroll perdu). Le combobox n'a pas besoin de `modal`
          (le Dialog gère la modalité ; hors Dialog un dropdown ne doit pas bloquer le scroll de page). */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            id={id}
            className={buttonClassName}
          >
            <div className={pillContainerClassName}>
              {multiple ? (
                Array.isArray(value) && value.length > 0 ? (
                  value.map((v: unknown) => {
                    const opt = options.find((o: SelectOption) => isSameValue(o.value ?? o, v));
                    const label = String(opt?.label ?? (typeof v === "object" && v !== null && "name" in v ? (v as Record<string, unknown>).name : v));
                    const type = opt?.type ?? (typeof v === "object" && v !== null && "type" in v ? String((v as Record<string, unknown>).type) : undefined);
                    return (
                      <div key={opt?.id ?? String(label)} className={pillClassName}>
                        <div className="flex flex-col min-w-0">
                          <span className={pillLabelClassName}>{label}</span>
                          {type && <span className={pillTypeClassName}>{type}</span>}
                        </div>
                        <span
                          role="button"
                          aria-label="Remove"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); toggleVal(v); }}
                          className={pillRemoveClassName}
                        >
                          <XIcon className={deleteIconClassName} />
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <span className={placeholderClassName}>{placeholder}</span>
                )
              ) : (
                (() => {
                  const opt = options.find((o: SelectOption) => isSameValue(o.value ?? o, Array.isArray(value) ? value[0] : value));
                  if (!opt) return <span className={placeholderClassName}>{placeholder}</span>;
                  const label = opt.label;
                  const type = opt.type;
                  return (
                    <div className={pillClassName}>
                      <div className="flex flex-col min-w-0">
                        <span className={pillLabelClassName}>{label}</span>
                        {type && <span className={pillTypeClassName}>{type}</span>}
                      </div>
                      <span
                        role="button"
                        aria-label="Clear"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
                        className={pillRemoveClassName}
                      >
                        <XIcon className={deleteIconClassName} />
                      </span>
                    </div>
                  );
                })()
              )}
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent side="bottom" align="start" className="p-0 w-[var(--radix-popover-trigger-width)]">
          <Command shouldFilter={(arrayOptions?.length ?? 0) > 0} className="w-full">
            <CommandInput
              placeholder={placeholderSearch}
              value={search}
              onValueChange={setSearch}
              className={inputClassName}
            />
            <CommandList className={listClassName}>
              {/* Proposition d'AJOUT : `value={search}` pour que cmdk ne la filtre jamais (il apparie sur
                  `value`, et la recherche se contient elle-même). Masquée dès qu'une option existante
                  porte déjà exactement ce libellé, pour ne pas proposer un doublon. */}
              {creatable && search.trim() !== ""
                && !options.some((o) => String(o.label).toLowerCase() === search.trim().toLowerCase()) && (
                <CommandItem
                  key="__creer__"
                  value={search}
                  onSelect={() => { toggleVal(search.trim()); setSearch(""); }}
                  className={itemClassName}
                >
                  <PlusIcon className="h-4 w-4 flex-shrink-0" />
                  <span className={itemLabelClassName}>{createLabel(search.trim())}</span>
                </CommandItem>
              )}
              {isLoading ? (
                <div className="flex justify-center p-2">{loadingIndicator}</div>
              ) : options.length > 0 ? (
                options.map((opt: SelectOption) => {
                  const val = opt.value ?? opt;
                  return (
                    <CommandItem
                      key={opt.id ?? String(opt.value ?? opt.label)}
                      onSelect={() => toggleVal(val)}
                      className={itemClassName}
                    >
                      {opt.thumb && (
                        <OptimizedImage src={opt.thumb} alt={opt.label} width={32} className={thumbClassName} />
                      )}
                      <div className="flex-1 flex flex-col">
                        <span className={itemLabelClassName}>{opt.label}</span>
                        {opt.type && <span className={itemTypeClassName}>{opt.type}</span>}
                      </div>
                      {isSelected(val) && <CheckIcon className={checkIconClassName} />}
                    </CommandItem>
                  );
                })
              ) : creatable && search.trim() !== "" ? null : (
                <CommandEmpty className="w-full h-12 flex items-center justify-center">
                  <p className="text-center text-lg leading-10">
                    {emptyIndicator}
                  </p>
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}