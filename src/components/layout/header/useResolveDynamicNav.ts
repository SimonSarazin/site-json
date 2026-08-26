import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useCostumListsReactive } from "@/hooks/useCostumLists";
import { costumListValuesQuery } from "@/hooks/useCostumListValues";
import { costumSlugOf, isDynamicList } from "@/lib/costumLists";
import { getDropdownFilterOwner } from "@/modules/search/lib/dropdownFilters";
import type { EnhancedNavItemType, SiteConfig } from "@/types/site-schema";
import { buildDynamicNavChildren, resolveDynamicNavValues } from "./lib/dynamicNav";

/**
 * Matérialise les `children` des items `dynamicList` d'une nav à partir de
 * `costum.lists.<nom>`, avant qu'elle soit passée à la variante de header choisie
 * (`SiteHeader`) — aucune variante de header n'a besoin de connaître ce mécanisme : un
 * item résolu redevient un `EnhancedNavItemType` ordinaire (`children` = liens classiques),
 * rendu par le code de dropdown/menu mobile déjà en place, inchangé.
 *
 * Repli : tant qu'une liste n'a pas fini de se résoudre (pas encore chargée, vide, ou
 * `filterId` introuvable en config), l'item est renvoyé INCHANGÉ — les `children`
 * statiques éventuellement déclarés en parallèle servent de repli, comme
 * `optionsKey`/`optionsFrom` le font déjà côté filtres de page
 * (`useDynamicFilterOptions`). Un item sans aucun `children` statique et dont la liste ne
 * s'est pas (encore) résolue reste un simple lien sans sous-menu — pas d'état "chargement".
 */
export function useResolveDynamicNav(
  nav: EnhancedNavItemType[],
  config: SiteConfig,
): EnhancedNavItemType[] {
  const { api, entity: carrier } = useCocolight();
  const slugSite = costumSlugOf(carrier);
  const listesStatiques = useCostumListsReactive(carrier);

  // Items à liste dynamique, dans un ordre STABLE : `useQueries` exige un nombre et un
  // ordre constants d'un rendu à l'autre.
  const items = useMemo(() => nav.filter((it) => !!it.dynamicList), [nav]);

  // Une requête serveur n'est émise QUE si `costum.lists[list]` est une recette dynamique
  // (`isDynamicList`) — jamais pour une liste statique, déjà livrée avec le costum (le
  // serveur refuse d'ailleurs `costum/co/listvalues` pour ce cas, cf. `costumLists.ts`).
  const resultats = useQueries({
    queries: items.map((it) => {
      const spec = it.dynamicList!;
      const declared = listesStatiques[spec.list];
      return costumListValuesQuery(api as never, spec.costumSlug ?? slugSite, spec.list, isDynamicList(declared), {
        limit: spec.limit,
      });
    }),
  });

  // `join` plutôt que la référence : react-query rend un tableau neuf à chaque rendu, une
  // dépendance par identité relancerait le mémo ci-dessous en boucle.
  const empreinte = resultats.map((r) => (r.data?.values ?? []).join(",")).join("|");

  return useMemo(() => {
    if (!items.length) return nav;
    const parItem = new Map(items.map((it, i) => [it, resultats[i]?.data?.values] as const));
    return nav.map((item) => {
      if (!item.dynamicList) return item;
      const owner = getDropdownFilterOwner(config, item.dynamicList.filterId);
      if (!owner) {
        if (import.meta.env.DEV) {
          console.warn(
            `[dynamicNav] filtre "${item.dynamicList.filterId}" introuvable en config — repli sur les enfants statiques déclarés.`,
          );
        }
        return item;
      }
      const declared = listesStatiques[item.dynamicList.list];
      const values = resolveDynamicNavValues(declared, parItem.get(item));
      if (!values.length) return item;
      return { ...item, children: buildDynamicNavChildren(owner, values, item.dynamicList.limit) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, items, empreinte, listesStatiques, config]);
}
