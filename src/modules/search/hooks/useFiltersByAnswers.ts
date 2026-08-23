import { useQuery, type QueryKey } from "@tanstack/react-query";
import type { LocalizedString } from "@/types/locale-schema";
import { useCocolight } from "@/hooks/useCocolight";

export interface FiltersByAnswersOptions {
  [key: string]: {
    id: string;
    label: LocalizedString;
    type?: string;
    forms?: string;
    path?: string;
    finderPath?: string;
    /** Cf. `FiltersByAnswersSchema.filterTarget` — `answers` = la liste porte les
     *  réponses elles-mêmes (prédicat de chemin) ; défaut = éléments liés (`_id`). */
    filterTarget?: "answers" | "linkedElements";
    value?: {
      [key: string]: {
        id: string;
        finder: string;
      };
    };
  };
}

export interface FilterAnswerType {
  label: LocalizedString;
  values: Record<string, {
    image: string;
    name: string;
    orgaNameArray: string[];
  }>;
}

interface FiltersByAnswersResult {
  data: Record<string, FilterAnswerType>;
  isLoading: boolean;
  error: Error | null;
}

// Référence stable pour le cas "pas encore chargé / disabled" — éviter une
// nouvelle référence à chaque render qui ferait re-fire les useEffect côté caller.
const EMPTY_DATA: Record<string, FilterAnswerType> = {};

/**
 * Interface minimale attendue par `fetchFiltersByAnswers` — duck-typing pour
 * accepter indifféremment une `Organization`, un `Project`, ou tout autre
 * porteur de `coformFiltersSearch` (ex: l'`entity` retournée par `initApi`).
 */
interface CoformFiltersEntity {
  coformFiltersSearch(params: { searchedData: FiltersByAnswersOptions }): Promise<unknown>;
}

/**
 * QueryKey partagée hook + prefetch SSR. Sérialise `options` pour stabilité.
 */
export function filtersByAnswersQueryKey(
  query: string,
  options: FiltersByAnswersOptions
): QueryKey {
  return ["filters-by-answers", query, JSON.stringify(options)] as const;
}

/**
 * Fetcher + transformation partagés hook + prefetch SSR.
 */
export async function fetchFiltersByAnswers(
  entity: CoformFiltersEntity,
  options: FiltersByAnswersOptions
): Promise<Record<string, FilterAnswerType>> {
  const result = await entity.coformFiltersSearch({ searchedData: options });

  const transformed: Record<string, FilterAnswerType> = {};
  if (!result || typeof result !== "object") return transformed;

  for (const [key, rawItem] of Object.entries(result as Record<string, unknown>)) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as { results?: unknown };
    if (!item.results || typeof item.results !== "object") continue;

    const label = options[key]?.label ?? key;
    const filteredResults = Object.fromEntries(
      Object.entries(item.results as Record<string, unknown>).filter(
        ([resultKey]) => resultKey !== "distinctElements"
      )
    ) as FilterAnswerType["values"];

    transformed[key] = {
      label: (typeof label === "string" ? { fr: label } : label) as LocalizedString,
      values: filteredResults,
    };
  }

  return transformed;
}

/**
 * Pré-calcule, pour chaque clé de `options`, la liste des orgas matchant
 * chaque valeur (`orgaNameArray`). Un seul appel backend
 * (`entity.coformFiltersSearch`) dédupe le travail de filtrage answer→org.
 */
export function useFiltersByAnswersQuery(
  query: string,
  options: FiltersByAnswersOptions = {}
): FiltersByAnswersResult {
  const { entity } = useCocolight();

  const result = useQuery<Record<string, FilterAnswerType>, Error>({
    queryKey: filtersByAnswersQueryKey(query, options),
    queryFn: () => {
      if (!entity) throw new Error("API non initialisée - entity manquante");
      return fetchFiltersByAnswers(entity as unknown as CoformFiltersEntity, options);
    },
    enabled: !!entity && Object.keys(options).length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: result.data ?? EMPTY_DATA,
    isLoading: result.isLoading,
    error: result.error ?? null,
  };
}
