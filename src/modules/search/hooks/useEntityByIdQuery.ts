import { useQuery } from "@tanstack/react-query";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { useCocolightOptional } from "@/hooks/useCocolight";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
import type { ListConf } from "../schema";

/** Collections ouvrables par identifiant (cf. `list.previewFetch`). */
export type PreviewFetchKind = NonNullable<ListConf["previewFetch"]>;

/**
 * Charge UNE entité par son identifiant, pour ouvrir sa fiche sans dépendre de
 * la page de résultats affichée.
 *
 * POURQUOI : `?preview=<id>` est résolu par `SearchListView` DANS `results` —
 * or une liste n'en charge que 10 par défaut (24 sur l'annuaire Saint-Paul).
 * Un lien venu d'une autre page (fiche d'un équipement → fiche du club usager)
 * vise presque toujours un item absent de cette tranche : sans ce repli, l'URL
 * n'ouvrirait rien, sans le moindre signal.
 *
 * L'entité renvoyée est la fiche COMPLÈTE (plus riche que la projection
 * `defaultFields` d'un résultat de recherche) : les previews y lisent leurs
 * champs comme d'habitude, `getEntryId` y trouve l'id racine.
 *
 * Requête paresseuse (`enabled`) : rien ne part tant qu'aucun identifiant
 * manquant n'est demandé.
 */
export function useEntityByIdQuery(
  kind: PreviewFetchKind | undefined,
  id: string | undefined,
) {
  // Variante TOLÉRANTE : `SearchListView` est monté dans bien des contextes
  // (agenda, observatoire, membres d'un profil, tests de composant). Hors
  // provider, la feature se dégrade — aucune requête — au lieu de jeter.
  const cocolight = useCocolightOptional();
  const api = cocolight?.api ?? null;
  const loading = cocolight?.loading ?? false;

  return useQuery<SearchEntity | null>({
    queryKey: SEARCH_QUERY_KEYS.ENTITY_BY_ID(kind ?? "", id ?? ""),
    enabled: Boolean(api && kind && id) && !loading,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Une fiche introuvable (id périmé, entité supprimée) est un cas NORMAL
    // d'un lien partagé : on ne rejoue pas l'appel trois fois pour l'apprendre.
    retry: false,
    queryFn: async () => {
      if (!api || !kind || !id) return null;
      const data = { id };
      switch (kind) {
        case "poi":
          return (await api.poi(data)) as unknown as SearchEntity;
        case "organizations":
          return (await api.organization(data)) as unknown as SearchEntity;
        case "projects":
          return (await api.project(data)) as unknown as SearchEntity;
        case "events":
          return (await api.event(data)) as unknown as SearchEntity;
        case "citoyens":
          return (await api.user(data)) as unknown as SearchEntity;
        default:
          return null;
      }
    },
  });
}
