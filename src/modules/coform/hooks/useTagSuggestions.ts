import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCocolightOptional } from "@/hooks/useCocolight";
import { useDebounce } from "@/hooks/useDebounce";
import { COFORM_QUERY_KEYS } from "../constants/queryKeys";
import { filterLocalTags, parseSearchTagsResponse } from "../utils/tags";

/** Aligné sur le finder — même ressenti de frappe d'un champ à l'autre. */
const TAG_DEBOUNCE_MS = 300;

interface UseTagSuggestionsReturn {
  /** Libellés proposés, déjà filtrés et privés de ceux déjà sélectionnés. */
  suggestions: string[];
  isLoading: boolean;
  /** `true` quand les suggestions viennent de l'index global (et non du formulaire). */
  isRemote: boolean;
}

/**
 * Suggestions d'un champ `tags`, avec les DEUX sources du legacy.
 *
 * `tags.php` choisit son URL selon le type du formulaire parent :
 *
 *  - formulaire **aap** → `/co2/aap/searchtags/` (`SearchTagsAction`), qui filtre par
 *    préfixe le vocabulaire propre du formulaire, `form.params.<inputKey>.list` —
 *    la liste qu'alimente `PushTagsAction` à chaque tag saisi ;
 *  - **sinon** → `/api/tags/search`, l'index global de la plateforme.
 *
 * Ici la même bascule se joue sur la DONNÉE plutôt que sur le type : `params` étant
 * déjà chargé avec le formulaire, un vocabulaire non vide est filtré **en local**,
 * sans aucune requête — c'est exactement ce que fait `SearchTagsAction`, en
 * supprimant l'aller-retour par frappe. Vide ou absent, on retombe sur l'index
 * global via `api.searchTags` (`auth: none`, déjà publié dans le SDK).
 *
 * Mesuré sur le parc (2026-08-19) : 40 des 124 inputs `tags` ont un vocabulaire
 * peuplé (médiane 83 entrées, max 166) ; les 84 autres passent donc par l'index
 * global. Dans les deux cas la saisie libre reste possible — le legacy le permet
 * via `createSearchChoice`, et c'est ce qui fait grossir le vocabulaire.
 */
export function useTagSuggestions({
  query,
  vocabulary,
  selected,
  enabled = true,
}: {
  /** Texte en cours de frappe (non debouncé — le hook s'en charge). */
  query: string;
  /** `params.<inputKey>.list` du formulaire. Vide → index global. */
  vocabulary: string[];
  /** Tags déjà posés, à ne pas re-proposer. */
  selected: string[];
  enabled?: boolean;
}): UseTagSuggestionsReturn {
  // Variante TOLÉRANTE : `CoFormReadOnly` se rend hors `CocolightProvider`.
  // Sans API la requête est simplement désactivée — le mode lecture n'a de
  // toute façon aucune suggestion à afficher.
  const cocolight = useCocolightOptional();
  const api = cocolight?.api ?? null;

  const hasVocabulary = vocabulary.length > 0;
  const debounced = useDebounce(query, TAG_DEBOUNCE_MS);

  // L'index global n'est interrogé que faute de vocabulaire local, et seulement
  // à partir d'un caractère (contrainte de `api.searchTags`, qui rejette `q` vide).
  const remoteEnabled = enabled && !hasVocabulary && !!api && debounced.trim().length >= 1;

  const { data: remote, isFetching } = useQuery({
    queryKey: COFORM_QUERY_KEYS.TAG_SEARCH(remoteEnabled ? debounced.trim() : null),
    enabled: remoteEnabled,
    queryFn: async () => parseSearchTagsResponse(await api!.searchTags(debounced.trim())),
    staleTime: 5 * 60 * 1000,
  });

  const suggestions = useMemo(() => {
    const pool = hasVocabulary ? vocabulary : (remote ?? []);
    return filterLocalTags(pool, hasVocabulary ? query : "", selected);
  }, [hasVocabulary, vocabulary, remote, query, selected]);

  return { suggestions, isLoading: remoteEnabled && isFetching, isRemote: !hasVocabulary };
}
