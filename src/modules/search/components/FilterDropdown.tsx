import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { type LocalizedString } from "@/types/locale-schema";

interface FilterDropdownProps {
  name: string; // libellé du bouton
  list:
    | (string | LocalizedString | Record<string, LocalizedString>)[]
    | Record<string, LocalizedString | string>;
  selected?: string[];
  onChange: (selected: string[]) => void;
}

type Item = { value: string; label: string | LocalizedString };

export default function FilterDropdown({
  name,
  list,
  selected = [],
  onChange,
}: FilterDropdownProps) {
  const t = useT("modules/search");

  /* ------------------------------------------------------------------ */
  /*  Normalisation : tableau [{ value, label }]                        */
  /* ------------------------------------------------------------------ */
  const items: Item[] = Array.isArray(list)
    ? list.map((it) => {
        /* Cas tableau : value = chaîne brute (ou première value d’un objet) */
        const value =
          typeof it === "string" ? it : (Object.values(it)[0] as string);
        return { value, label: it };
      })
    : Object.entries(list).map(([key, label]) => ({
        /* Cas objet : value = clé (🆕)                                    */
        value: key,
        label,
      }));

  /* ------------------------------------------------------------------ */
  /*  Renvoie la traduction OU la valeur brute si manquante             */
  /* ------------------------------------------------------------------ */
  const tr = (val: string | LocalizedString) => {
    if (typeof val === "object") return t(val);
    const translated = t(val);
    return translated.startsWith("missing") ? val : translated;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {tr(name)} ▾
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-auto max-h-72 overflow-y-auto"
      >
        {items.map(({ value, label }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => {
              const next = selected.includes(value)
                ? selected.filter((v) => v !== value)
                : [...selected, value];
              onChange(next);
            }}
            className={selected.includes(value) ? "bg-primary/10" : ""}
          >
            {tr(label)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
