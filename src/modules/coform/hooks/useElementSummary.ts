import { useQuery } from "@tanstack/react-query";
import type { Api } from "@communecter/cocolight-api-client";
import { useCocolightOptional } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../constants/queryKeys";
import { pickProfileImageUrl } from "../utils/helpers";
import type { FinderElementType } from "../types";

/**
 * Types d'éléments résolubles via une méthode entity du SDK
 * (`api.<type>({id})`). Les autres (things, classified, news…) n'ont pas de
 * factory dédiée → pas de résolution (icône / nom de repli côté UI).
 */
export const RESOLVABLE_TYPES = new Set<FinderElementType>([
  "organizations",
  "citoyens",
  "projects",
  "events",
  "poi",
]);

export const ELEMENT_SUMMARY_STALE_TIME_MS = 5 * 60 * 1000;

/** Résumé minimal d'un élément, dérivé de sa fiche. */
export interface ElementSummary {
  name?: string;
  img?: string;
}

/**
 * Résout le résumé (nom + image) d'un élément via la méthode entity du SDK.
 * `api.<type>({id})` appelle `.get()` en interne (cf. `Api.ts`) et peuple
 * `serverData` (URLs déjà normalisées en absolu par l'ApiClient).
 *
 * NB : le SDK n'expose pas de fetch « léger » par id — `getElementsAbout`
 * renvoie la fiche complète (`getElementsKey` est par slug). On lit donc juste
 * ce dont l'UI a besoin (nom + image), le reste du payload est ignoré. Une
 * vraie optimisation nécessiterait un endpoint backend dédié (résumé par ids).
 *
 * Image : priorité medium → pleine → thumb (le thumb est un crop carré souvent
 * peu net), aligné sur la fiche élément.
 */
export async function fetchElementSummary(
  api: Api,
  id: string,
  type: FinderElementType,
): Promise<ElementSummary> {
  let entity: { serverData?: Record<string, unknown> };
  switch (type) {
    case "organizations":
      entity = await api.organization({ id });
      break;
    case "citoyens":
      entity = await api.user({ id });
      break;
    case "projects":
      entity = await api.project({ id });
      break;
    case "events":
      entity = await api.event({ id });
      break;
    case "poi":
      entity = await api.poi({ id });
      break;
    default:
      return {};
  }
  const sd = entity.serverData ?? {};
  const name = typeof sd.name === "string" && sd.name.trim() !== "" ? sd.name : undefined;
  return { name, img: pickProfileImageUrl(sd) };
}

/**
 * Hook : résout le résumé (nom + image) d'UN élément par id+type.
 * Désactivé proprement si id/type/api manquent, hors `CocolightProvider`
 * (tests), ou type non résoluble. Mutualise le cache avec
 * `useFinderElementImages` via `COFORM_QUERY_KEYS.ELEMENT_SUMMARY`.
 */
export function useElementSummary(
  id: string | null | undefined,
  type: FinderElementType | null | undefined,
): { summary: ElementSummary | undefined; isLoading: boolean } {
  const api = useCocolightOptional()?.api ?? null;
  const enabled = !!api && !!id && !!type && RESOLVABLE_TYPES.has(type);

  const query = useQuery({
    queryKey: COFORM_QUERY_KEYS.ELEMENT_SUMMARY(type ?? null, id ?? null),
    enabled,
    staleTime: ELEMENT_SUMMARY_STALE_TIME_MS,
    queryFn: () => fetchElementSummary(api!, id!, type!),
  });

  return {
    summary: query.data,
    isLoading: enabled && query.isLoading,
  };
}
