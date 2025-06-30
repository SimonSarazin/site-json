import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";

interface FilterDropdownProps {
  name: string;              // libellé du bouton
  list: (string | Record<string, string>)[]; // accepte aussi LocalizedString
  selected?: string[];
  onChange: (selected: string[]) => void;
}

export default function FilterDropdown({
  name,
  list,
  selected = [],
  onChange,
}: FilterDropdownProps) {
  const t = useT("modules/search");  

  /**  Renvoie la traduction OU la valeur brute si manquante */
  const label = (value: string | Record<string, string>) => {
    // LocalizedString → on le passe directement à t()
    if (typeof value === "object") return t(value);

    const translated = t(value);
    return translated.startsWith("missing") ? value : translated;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {label(name)} ▾
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-auto max-h-72 overflow-y-auto">
        {list.map((item) => {
          const value = typeof item === "string" ? item : (Object.values(item)[0] as string);
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => {
                const next = selected.includes(value)
                  ? selected.filter((i) => i !== value)
                  : [...selected, value];
                onChange(next);
              }}
              className={selected.includes(value) ? "bg-primary/10" : ""}
            >
              {label(item)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
