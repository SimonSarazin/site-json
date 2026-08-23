import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export interface MultiComboboxOption {
  id: string;
  label: React.ReactNode;
  /** Texte de recherche quand le libellé n'est pas une chaîne (badge, compteur…). */
  searchText?: string;
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
  /** Placeholder du champ de recherche (i18n : fourni par l'appelant, comme `SelectObject`). */
  searchPlaceholder?: string;
  /** Message « aucun résultat » de la recherche. */
  noResultLabel?: React.ReactNode;
  /** Au-delà de ce nombre d'options, un champ de recherche apparaît. `0` = jamais. */
  searchThreshold?: number;
  /** Nombre d'options RENDUES au maximum (cf. plafond de rendu ci-dessous). */
  maxRendered?: number;
  /** Pied de liste quand le plafond coupe (`n` = options non rendues). */
  moreLabel?: (n: number) => React.ReactNode;
  /**
   * Notifie le parent à chaque frappe. Le filtrage LOCAL reste fait ici ; ce rappel sert au parent qui
   * doit aller chercher plus loin — une liste que le serveur a coupée contient des valeurs absentes du
   * popover, et seul lui peut les retrouver.
   */
  onSearchChange?: (terme: string) => void;
}

/** Comparaison tolérante casse/accents — « economie » trouve « Économie ». */
const canon = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const texteOption = (o: MultiComboboxOption): string =>
  o.searchText ?? (typeof o.label === "string" ? o.label : o.id);

/**
 * Combobox MULTI — le pattern canonique shadcn (Popover + Command) là où Radix
 * Select n'a pas de multi natif : items au look SelectItem avec coche à DROITE,
 * popover qui RESTE OUVERT pendant la multi-sélection. Source unique des quatre
 * usages historiques (champs de filtre compacts, dropdowns du searchHeader,
 * modal de filtres SearchPro, tags de l'agenda).
 *
 * RECHERCHE — apparaît d'elle-même au-delà de `searchThreshold` options, et
 * seulement là : un dropdown à 9 entrées ne gagne rien à un champ de saisie.
 * Le filtrage est fait ICI (`shouldFilter={false}`), pas par cmdk, pour deux
 * raisons : la tolérance aux accents (les valeurs saisies librement s'écrivent
 * « économie » ou « economie »), et le plafond de rendu ci-dessous, qui suppose
 * de connaître la liste filtrée.
 *
 * PLAFOND DE RENDU — les valeurs viennent maintenant des DONNÉES (listes
 * dynamiques `costum.lists`), dont la taille n'est plus décidée par un
 * administrateur : la plus grosse mesurée compte 1 209 entrées (institutBleu,
 * tags des documents). Au-delà de `maxRendered`, on rend le début et on annonce
 * le reste — la recherche est le chemin normal vers une valeur lointaine.
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
  searchPlaceholder,
  noResultLabel,
  searchThreshold = 10,
  maxRendered = 200,
  moreLabel,
  onSearchChange,
}: MultiComboboxProps) {
  const [recherche, setRecherche] = React.useState("");
  const avecRecherche = searchThreshold > 0 && options.length > searchThreshold;

  const filtrees = React.useMemo(() => {
    const q = canon(recherche);
    if (!q) return options;
    return options.filter((o) => canon(texteOption(o)).includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, recherche]);

  // Les options SÉLECTIONNÉES passent en tête AVANT le plafond : sinon une valeur cochée au-delà du
  // rang `maxRendered` disparaît du popover et ne peut plus être décochée là où on l'a cochée.
  const ordonnees = React.useMemo(() => {
    if (filtrees.length <= maxRendered) return filtrees;
    const coche = new Set(selected);
    return [...filtrees].sort((a, b) => Number(coche.has(b.id)) - Number(coche.has(a.id)));
  }, [filtrees, maxRendered, selected]);

  const rendues = ordonnees.slice(0, maxRendered);
  const reste = ordonnees.length - rendues.length;

  return (
    <Popover onOpenChange={(o) => { if (!o) { setRecherche(""); onSearchChange?.(""); } }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn("w-(--radix-popover-trigger-width) min-w-48 p-1", contentClassName)}
      >
        <Command shouldFilter={false}>
          {avecRecherche && (
            <CommandInput
              placeholder={searchPlaceholder}
              value={recherche}
              onValueChange={(v) => { setRecherche(v); onSearchChange?.(v); }}
              className="h-8"
            />
          )}
          <CommandList className="max-h-72">
            {avecRecherche && filtrees.length === 0 && noResultLabel !== undefined && (
              <CommandEmpty>{noResultLabel}</CommandEmpty>
            )}
            <CommandGroup>
              {allLabel !== undefined && !recherche && (
                <>
                  <CommandItem onSelect={() => onClear?.()}>{allLabel}</CommandItem>
                  {options.length > 0 && <CommandSeparator className="my-1" />}
                </>
              )}
              {rendues.map((o) => (
                <CommandItem key={o.id} onSelect={() => onToggle(o.id)}>
                  {o.label}
                  <Check
                    className={cn("ml-auto h-4 w-4", selected.includes(o.id) ? "opacity-100" : "opacity-0")}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            {reste > 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {moreLabel ? moreLabel(reste) : `+${reste}`}
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
