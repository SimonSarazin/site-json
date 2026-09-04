import { useMemo } from "react";
import { useListEntries, type EntreeDeListe } from "@/hooks/useListSources";
import { resolveListSources } from "@/lib/listSources";
import { getDropdownFilterOwner } from "@/modules/search/lib/dropdownFilters";
import type { EnhancedNavItemType, SiteConfig } from "@/types/site-schema";
import { buildDynamicNavChildren } from "./lib/dynamicNav";

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
  // Items à liste dynamique, dans un ordre STABLE, puis UNE entrée par couple (item, liste) : un item
  // peut en nommer plusieurs (un même champ alimenté depuis plusieurs collections = une recette par
  // collection). La clé de regroupement est l'INDEX de l'item, seul identifiant stable dont on dispose.
  const items = useMemo(() => nav.filter((it) => !!it.dynamicList), [nav]);
  const entrees = useMemo<EntreeDeListe[]>(() => {
    const out: EntreeDeListe[] = [];
    items.forEach((it, i) => {
      const spec = it.dynamicList!;
      for (const nom of Array.isArray(spec.list) ? spec.list : [spec.list]) {
        out.push({ cle: String(i), nom, costumSlug: spec.costumSlug, limit: spec.limit });
      }
    });
    return out;
  }, [items]);

  const parItem = useListEntries(entrees);

  return useMemo(() => {
    if (!items.length) return nav;
    const cleDe = new Map(items.map((it, i) => [it, String(i)] as const));
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
      // Les listes de cet item, chacune déjà résolue selon sa forme par `useListEntries`, fusionnées —
      // dédoublonnage et union des graphies, cf. `@/lib/listSources`.
      const { values } = resolveListSources(parItem.get(cleDe.get(item) ?? "")?.sources ?? []);
      if (!values.length) return item;
      return { ...item, children: buildDynamicNavChildren(owner, values, item.dynamicList.limit) };
    });
  }, [nav, items, parItem, config]);
}
