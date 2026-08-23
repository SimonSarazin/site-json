import { ChevronDown } from "lucide-react";
import { MultiCombobox } from "@/components/ui/multi-combobox";
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
  count?: Record<string, number>;
}

type Item = { value: string; label: string | LocalizedString };

export default function FilterDropdown({
  name,
  list,
  selected = [],
  onChange,
  count,
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
    // Combobox multi partagé (ui/multi-combobox) — coche à droite, reste
    // ouvert pendant la sélection.
    <MultiCombobox
      options={items.map(({ value, label }) => ({
        id: value,
        label: `${tr(label)}${count?.[value] ? ` (${count[value]})` : ""}`,
      }))}
      // Une liste DYNAMIQUE (`optionsFrom`) suit les données : 64 territoires là où la config en
      // déclare 12, 1 209 tags côté documents. Recherche et plafond de rendu s'activent d'eux-mêmes.
      searchPlaceholder={t("Rechercher…")}
      noResultLabel={t("Aucun résultat")}
      moreLabel={(n) => t("+{{count}} autres — précisez la recherche", undefined, { count: n })}
      selected={selected}
      onToggle={(value) => {
        const next = selected.includes(value)
          ? selected.filter((v) => v !== value)
          : [...selected, value];
        onChange(next);
      }}
      contentClassName="w-auto"
    >
      <Button variant="outline">
        {tr(name)}
        <ChevronDown className="ml-1 h-4 w-4 opacity-50" />
      </Button>
    </MultiCombobox>
  );
}

