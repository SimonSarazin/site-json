import { useQuery, type QueryKey } from "@tanstack/react-query";
import type { CoformFilterByPathResult } from "@communecter/cocolight-api-client";
import type { LocalizedString } from "@/types/locale-schema";
import { useCocolight } from "@/hooks/useCocolight";
import type { FilterAnswerType } from "./useFiltersByAnswers";

/**
 * Config d'un filtre par thématique CoForm (cf. schéma `filtersByPath`).
 * Chaque entrée déclenche un appel `coformFilterByPath` dédié.
 */
export interface FiltersByPathOptions {
  [key: string]: {
    id?: string;
    label: LocalizedString;
    thematicPath: string;
    finderPath?: string;
    notSourceKey?: boolean;
    /** Cf. `FiltersByAnswersSchema.filterTarget` — `answers` = la liste porte les
     *  réponses elles-mêmes (prédicat de chemin) ; défaut = éléments liés (`_id`). */
    filterTarget?: "answers" | "linkedElements";
  };
}

interface FiltersByPathResult {
  data: Record<string, FilterAnswerType>;
  isLoading: boolean;
  error: Error | null;
}

const EMPTY_DATA: Record<string, FilterAnswerType> = {};

/**
 * Interface minimale (duck-typing) : tout porteur de `coformFilterByPath`
 * (le project costum de contexte, ou l'`entity` de `initApi` côté SSR).
 */
interface CoformFilterByPathEntity {
  coformFilterByPath(data: {
    params: { thematicPath: string; finderPath?: string };
    fields?: string[];
    filters?: Record<string, unknown>;
    notSourceKey?: boolean;
  }): Promise<CoformFilterByPathResult>;
}

/** QueryKey partagée hook + prefetch SSR. */
export function filtersByPathQueryKey(
  query: string,
  options: FiltersByPathOptions,
): QueryKey {
  return ["filters-by-path", query, JSON.stringify(options)] as const;
}

/**
 * UNE entrée (`coformFilterByPath` + transformation vers le shape de `filtersByAnswers`, record
 * `values` indexé par `name`). REJETTE en cas d'échec : c'est ce que le mémo serveur
 * (`prefetch/facetCache`) doit voir pour ne rien mémoriser — un `{ values: {} }` de repli serait
 * pris pour un succès et servi vide à tous les visiteurs pendant toute sa durée de vie.
 */
export async function fetchFilterByPathEntry(
  entity: CoformFilterByPathEntity,
  opt: FiltersByPathOptions[string],
): Promise<FilterAnswerType> {
  const thematicAnswerPath = `answers.${opt.thematicPath}`;
  const res = await entity.coformFilterByPath({
    params: { thematicPath: opt.thematicPath, finderPath: opt.finderPath },
    fields: [thematicAnswerPath, ...(opt.finderPath ? [opt.finderPath] : [])],
    filters: { [thematicAnswerPath]: { $exists: true } },
    ...(opt.notSourceKey ? { notSourceKey: true } : {}),
  });

  const values: FilterAnswerType["values"] = {};
  for (const v of res.values ?? []) {
    if (!v.name) continue;
    values[v.name] = {
      name: v.name,
      image: v.image ?? "",
      // Dédoublonne les orgas (le backend peut renvoyer des doublons).
      orgaNameArray: Array.from(new Set(v.orgaNameArray ?? [])),
    };
  }
  return { label: opt.label, values };
}

/**
 * Fetcher partagé hook client + prefetch SSR. Un appel `coformFilterByPath` par entrée (en
 * parallèle, `fetchFilterByPathEntry`), **best-effort** : une entrée en échec est journalisée et
 * rendue vide, les autres s'affichent. Côté SSR, le prefetch mémorise entrée par entrée AVANT ce
 * repli — un échec n'y est jamais mémorisé.
 */
export async function fetchFiltersByPath(
  entity: CoformFilterByPathEntity,
  options: FiltersByPathOptions,
): Promise<Record<string, FilterAnswerType>> {
  const resolved = await Promise.all(
    Object.entries(options).map(async ([key, opt]) => {
      try {
        return [key, await fetchFilterByPathEntry(entity, opt)] as const;
      } catch (error) {
        console.error(`[fetchFiltersByPath] échec pour "${key}":`, error);
        return [key, { label: opt.label, values: {} }] as const;
      }
    }),
  );
  return Object.fromEntries(resolved);
}

/**
 * Filtres par thématique CoForm (`coformFilterByPath`). Produit le même shape
 * que `useFiltersByAnswersQuery` → mergeable dans le même `filterAnswerData`.
 */
export function useFiltersByPathQuery(
  query: string,
  options: FiltersByPathOptions = {},
): FiltersByPathResult {
  const { entity } = useCocolight();

  const result = useQuery<Record<string, FilterAnswerType>, Error>({
    queryKey: filtersByPathQueryKey(query, options),
    queryFn: () => {
      if (!entity) throw new Error("API non initialisée - entity manquante");
      return fetchFiltersByPath(entity as unknown as CoformFilterByPathEntity, options);
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
