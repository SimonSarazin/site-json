import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { SelectObject } from "@/components/ui/select-objet";
import { useT } from "@/hooks/useT";
import type { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";

type SearchType = NonNullable<GlobalAutocompleteCostumData["searchType"]>[number];

interface ParentValue {
  type: string;
  name?: string;
}

interface SelectOptionBase {
  id: string;
  label: string;
  type?: string;
  thumb?: string;
  name?: string;
}

interface SelectOption extends SelectOptionBase {
  value: SelectOptionBase;
}

interface SelectParentProps {
  value: Record<string, ParentValue> | undefined;
  onChange: (value: Record<string, ParentValue> | undefined) => void;
  placeholder?: string;
  searchTypes?: SearchType[];
  multiple?: boolean;
  className?: string;
  /** Fonction de recherche personnalisée. Si non fournie, utilise entity.searchCostum */
  onSearch?: (query: string) => Promise<SelectOption[]>;
  /** Si true, ajoute l'utilisateur connecté en premier dans les résultats */
  includeMe?: boolean;
  /** Filtres additionnels pour la recherche (ex: { tags: ["tag1"], locality: "..." }) */
  filters?: Partial<GlobalAutocompleteCostumData>;
}

/**
 * SelectParent - Composant pour sélectionner une entité parente
 *
 * Convertit le format parent MongoDB ({ id: { type, name } }) vers/depuis
 * le format SelectObject et utilise entity.searchCostum pour la recherche.
 *
 * @param value - Valeur au format { "mongoId": { type: "organizations", name: "Nom" } }
 * @param onChange - Callback appelé avec le nouveau format parent
 * @param placeholder - Placeholder du select
 * @param searchTypes - Types d'entités à rechercher (ex: ["organizations", "projects"])
 * @param multiple - Permet la sélection multiple
 * @param className - Classes CSS additionnelles
 * @param onSearch - Fonction de recherche personnalisée (optionnel)
 * @param includeMe - Si true, ajoute l'utilisateur connecté en premier dans les résultats
 * @param filters - Filtres additionnels pour la recherche
 */
export function SelectParent({
  value,
  onChange,
  placeholder,
  searchTypes = ["citoyens", "organizations", "projects"] as SearchType[],
  multiple = false,
  className,
  onSearch: customSearch,
  includeMe = false,
  filters,
}: SelectParentProps) {
  const { entity, me } = useCocolight();
  const t = useT("modules/profil");

  // Ref pour tracker si on a modifié la valeur nous-mêmes
  const hasLocalChangeRef = useRef(false);

  // State local pour l'affichage - initialisé avec value
  const [displayValue, setDisplayValue] = useState<Record<string, ParentValue> | undefined>(value);

  // Sync avec value prop seulement si on n'a pas fait de changement local
  // ou au premier rendu
  const prevValueRef = useRef(value);
  useEffect(() => {
    // Si value a changé depuis l'extérieur et on n'a pas de changement local en cours
    if (!hasLocalChangeRef.current) {
      setDisplayValue(value);
    }
    prevValueRef.current = value;
  }, [value]);

  // Convertir value (Record<id, {type, name}>) → array pour SelectObject
  const normalizedValue = useMemo((): SelectOption[] => {
    if (!displayValue || typeof displayValue !== "object" || Array.isArray(displayValue)) {
      return [];
    }
    return Object.entries(displayValue).map(([id, entry]) => {
      const opt = {
        id,
        type: entry.type,
        name: entry.name,
        label: entry.name || "",
      };
      // value doit être l'objet complet pour que SelectObject le retourne correctement
      return { ...opt, value: opt };
    });
  }, [displayValue]);

  // Créer l'option "me" si includeMe est activé
  const meOption = useMemo((): SelectOption | null => {
    if (!includeMe || !me?.serverData) return null;
    const opt = {
      id: me.serverData.id as string,
      label: me.serverData.name as string,
      name: me.serverData.name as string,
      type: "citoyens",
      thumb: me.serverData?.profilThumbImageUrl
        ? `${me.serverData.profilThumbImageUrl}`
        : undefined,
    };
    return { ...opt, value: opt };
  }, [includeMe, me]);

  // Recherche par défaut via API
  const defaultSearch = useCallback(
    async (q: string): Promise<SelectOption[]> => {
      if (!entity) return [];

      const param: Partial<GlobalAutocompleteCostumData> = {
        searchType: searchTypes,
        name: q || "",
        fediverse: false,
        indexMin: 0,
        indexStep: 30,
        notSourceKey: true,
        ...filters,
      };

      try {
        const result = await entity.searchCostum(param);
        if (!result?.results) return [];

        const results = result.results.map((item) => {
          const opt = {
            id: item.serverData.id as string,
            label: item.serverData.name as string,
            name: item.serverData.name as string,
            type: item.serverData.collection as string,
            thumb: item.serverData?.profilThumbImageUrl
              ? `${item.serverData.profilThumbImageUrl}`
              : undefined,
          };
          // value doit être l'objet complet pour que SelectObject le retourne correctement
          return { ...opt, value: opt };
        });

        // Ajouter "me" en premier si activé et pas déjà dans les résultats
        if (meOption && !results.some(r => r.id === meOption.id)) {
          return [meOption, ...results];
        }

        return results;
      } catch (error) {
        console.error("Error fetching search results:", error);
        if (error && typeof error === "object") {
          console.error("Error details:", {
            message: (error as Record<string, unknown>).message,
            validationErrors: (error as Record<string, unknown>).validationErrors,
            details: (error as Record<string, unknown>).details,
            response: (error as Record<string, unknown>).response,
            data: (error as Record<string, unknown>).data,
          });
        }
        return [];
      }
    },
    [entity, searchTypes, meOption, filters]
  );

  // Utiliser la recherche personnalisée si fournie, sinon la recherche par défaut
  const handleSearch = customSearch || defaultSearch;

  // State pour stocker les options de recherche
  const [searchOptions, setSearchOptions] = useState<SelectOption[]>([]);

  // Wrapper de recherche qui stocke les résultats
  const wrappedSearch = useCallback(
    async (q: string): Promise<SelectOption[]> => {
      const results = await handleSearch(q);
      setSearchOptions(results);
      return results;
    },
    [handleSearch]
  );

  // Options à passer au SelectObject : inclure la valeur sélectionnée si pas dans searchOptions
  const optionsWithSelected = useMemo(() => {
    if (normalizedValue.length === 0) return searchOptions;

    // Vérifier si les valeurs sélectionnées sont déjà dans les options
    const missingOptions = normalizedValue.filter(
      (v) => !searchOptions.some((opt) => opt.id === v.id)
    );

    if (missingOptions.length === 0) return searchOptions;

    // Ajouter les options manquantes
    return [...missingOptions, ...searchOptions];
  }, [searchOptions, normalizedValue]);

  // Convertir array → Record pour onChange
  // SelectObject retourne opt.value qui est SelectOptionBase
  const handleChange = useCallback(
    (arr: SelectOptionBase | SelectOptionBase[] | null) => {
      // Marquer qu'on a fait un changement local
      hasLocalChangeRef.current = true;

      // Cas null/undefined OU array vide (quand on supprime le dernier élément en mode multiple)
      if (arr === null || arr === undefined || (Array.isArray(arr) && arr.length === 0)) {
        setDisplayValue(undefined);
        onChange(undefined);
        return;
      }

      let newValue: Record<string, ParentValue>;
      if (!Array.isArray(arr)) {
        // Single selection
        newValue = {
          [arr.id]: { type: arr.type || "", name: arr.name },
        };
      } else {
        // Multiple selection
        newValue = arr.reduce(
          (acc: Record<string, ParentValue>, item: SelectOptionBase) => {
            acc[item.id] = { type: item.type || "", name: item.name };
            return acc;
          },
          {} as Record<string, ParentValue>
        );
      }

      const finalValue = Object.keys(newValue).length > 0 ? newValue : undefined;
      setDisplayValue(finalValue);
      onChange(finalValue);
    },
    [onChange]
  );

  return (
    <SelectObject
      value={normalizedValue}
      onChange={handleChange}
      options={optionsWithSelected}
      onSearch={wrappedSearch}
      placeholder={placeholder}
      multiple={multiple}
      className={className}
      placeholderSearch={t("common.searchPlaceholder")}
    />
  );
}
