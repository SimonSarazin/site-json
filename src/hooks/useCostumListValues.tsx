import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COSTUM_QUERY_KEYS } from "@/constants/queryKeys";

/**
 * Valeurs d'une liste **DYNAMIQUE** déclarée du costum (`costum.lists.<nom>`), résolues par le serveur.
 *
 * CE HOOK NE SERT QUE LES DYNAMIQUES, et c'est tout son intérêt. Une liste dynamique
 * (`{collection, distinct, where}`, `{type:"badges", category}`) n'est qu'une RECETTE : le costum ne
 * transporte jamais son résultat — `Costum::getAndConvertLists` n'est appelée qu'au rendu des pages PHP
 * legacy, et sa sortie part dans un cache. Seul `costum/co/listvalues` peut la résoudre, et lui seul
 * donne des valeurs FRAÎCHES : indispensable à un champ à saisie libre, où ce qu'un premier a saisi doit
 * être proposé aux suivants.
 *
 * Une liste STATIQUE ne passe PAS par ici : ses valeurs sont écrites dans sa déclaration, donc déjà
 * livrées au front par le chemin ordinaire du moteur de formulaire (`listsFromCarrier` → `listsOptions`
 * → `optionsKey`, cf. `GenericForm`). L'endpoint la refuse d'ailleurs, pour la même raison.
 *
 * CHARGEMENT INTÉGRAL, FILTRAGE LOCAL — mesuré : un `distinct` scopé au costum coûte 0,3 à 7,6 ms et
 * tient dans 1,7 Ko gzip pour 196 valeurs ; la recherche préfixe côté serveur n'apporte rien sans index
 * dédié (elle est parfois plus lente). On charge donc la liste UNE fois, et on filtre à la frappe dans
 * le navigateur : réponse instantanée, ni debounce ni longueur minimale.
 *
 * Un refus ou une panne rend une liste vide : l'appelant retombe sur la saisie libre seule, il ne casse pas.
 *
 * @param slug     slug du costum porteur (cf. `costumSlugOf`)
 * @param list     nom de la liste déclarée dans `costum.lists`
 * @param options  `enabled` : à couper quand les propositions sont déjà connues (liste statique)
 */
/** Client minimal attendu — évite de coupler ce module au type complet de l'API. */
type ApiLike = { endpointApi: { costumListValues: (p: { slug: string; list: string; q?: string; limit?: number }) => Promise<unknown> } };

/**
 * Valeurs retenues + graphies regroupées (`variants[valeur] = [toutes les graphies]`).
 *
 * `tronque` dit que le serveur a COUPÉ : ce qu'on tient n'est qu'une tranche, et une valeur cherchée
 * peut être au-delà. C'est le signal qui fait basculer un consommateur de la recherche LOCALE (filtrer
 * ce qu'on a) à la recherche SERVEUR (redemander avec `q`). `total` donne la taille réelle.
 */
export interface ValeursCostum {
  values: string[];
  variants: Record<string, string[]>;
  tronque?: boolean;
  total?: number;
}

/** Recherche et plafond serveur — cf. le contrat de `costum/co/listvalues`. */
export interface OptionsListe {
  /** Terme cherché CÔTÉ SERVEUR (comparaison canonique : casse, accents et ponctuation neutralisés). */
  q?: string;
  /** Nombre maximal de valeurs rendues. Absent = tout (comportement historique). */
  limit?: number;
}

/**
 * Options de requête d'UNE liste — extraites pour être réutilisables par `useQueries` (plusieurs listes
 * d'un coup, cas des filtres d'une page) autant que par le hook unitaire ci-dessous.
 */
export function costumListValuesQuery(
  api: ApiLike | null | undefined,
  slug: string | null | undefined,
  list: string | null | undefined,
  enabled = true,
  options?: OptionsListe,
) {
  const q = options?.q?.trim() || undefined;
  const limit = options?.limit && options.limit > 0 ? options.limit : undefined;
  return {
    queryKey: COSTUM_QUERY_KEYS.LIST_VALUES(slug ?? null, list ?? null, q, limit),
    queryFn: async (): Promise<ValeursCostum> => {
      const vide: ValeursCostum = { values: [], variants: {} };
      if (!api || !slug || !list) return vide;
      try {
        const res = (await api.endpointApi.costumListValues({
          slug, list, ...(q ? { q } : {}), ...(limit ? { limit } : {}),
        })) as
          { result?: boolean; values?: unknown; variants?: unknown; msg?: string;
            truncated?: boolean; total?: number } | null;
        if (!res?.result) {
          // Refus attendu et documenté (liste non déclarée, liste statique, liste d'entités…).
          if (res?.msg) console.warn(`[costumListValues] ${slug}/${list} : ${res.msg}`);
          return vide;
        }
        const values = Array.isArray(res.values)
          ? res.values.filter((v): v is string => typeof v === "string" && v !== "")
          : [];
        // `variants` n'est présent qu'en cas de doublons d'écriture — absent, chaque valeur est seule
        // de son groupe et il n'y a rien à élargir.
        const variants = (res.variants && typeof res.variants === "object")
          ? res.variants as Record<string, string[]>
          : {};
        // `truncated`/`total` ne sont là QUE si le serveur a coupé — leur absence signifie « tout est là ».
        return {
          values, variants,
          ...(res.truncated ? { tronque: true, total: typeof res.total === "number" ? res.total : undefined } : {}),
        };
      } catch (error) {
        console.error(`[costumListValues] échec ${slug}/${list}`, error);
        return vide;
      }
    },
    enabled: !!api && !!slug && !!list && enabled,
    staleTime: 5 * 60 * 1000, // aligné sur les autres listes du repo (useSearchTags, useFiltersByPath)
    gcTime: 30 * 60 * 1000,
  };
}

export function useCostumListValues(
  slug: string | null | undefined,
  list: string | null | undefined,
  options?: { enabled?: boolean } & OptionsListe,
) {
  const { api } = useCocolight();
  return useQuery(costumListValuesQuery(
    api as ApiLike | null, slug, list, options?.enabled ?? true,
    { q: options?.q, limit: options?.limit },
  ));
}
