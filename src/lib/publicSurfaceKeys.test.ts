import { describe, it, expect } from "vitest";

import { publicSurfaceKeys } from "./queryKeys";
import { AGENDA_QUERY_KEYS } from "@/modules/agenda/constants/queryKeys";
import { BLOG_QUERY_KEYS } from "@/modules/blog/constants/queryKeys";
import { SEARCH_QUERY_KEYS } from "@/modules/search/constants/queryKeys";

/**
 * Les surfaces publiques d'un site vivent dans des espaces de clés DISJOINTS de `admin-*`. Les trois
 * actions d'admin qui changent la visibilité d'une fiche (valider, référencer, supprimer)
 * n'invalidaient que `admin-*` : la page publique restait périmée jusqu'au rechargement. Ce test
 * verrouille la liste — un espace de clés oublié ici, c'est une page qui ment.
 */
describe("publicSurfaceKeys", () => {
  const plat = (slug?: string) => publicSurfaceKeys(slug).map((k) => JSON.stringify(k));

  it("couvre les listes de recherche, les DEUX vues d'agenda, et le fil blog", () => {
    const clefs = plat("monSite");
    // Les préfixes sont ceux que POSENT réellement les composants — on les compare aux constantes
    // des modules, jamais à des chaînes recopiées (c'est la recopie qui a produit le défaut).
    for (const p of ["searchCostumStatic", "searchCostumStaticMapAll", "searchCostum", "searchCostumMapAll", "cardCountCT"]) {
      expect(clefs).toContain(JSON.stringify(SEARCH_QUERY_KEYS.RESULTS_PREFIX(p)));
    }
    expect(clefs).toContain(JSON.stringify(AGENDA_QUERY_KEYS.CALENDAR_PREFIX()));
    expect(clefs).toContain(JSON.stringify(AGENDA_QUERY_KEYS.LIST_PREFIX()));
    expect(clefs).toContain(JSON.stringify(SEARCH_QUERY_KEYS.RESULTS_PREFIX(BLOG_QUERY_KEYS.FEED_PREFIX("monSite"))));
  });

  it("le fil blog est SCOPÉ : sans slug de costum, il est simplement omis", () => {
    expect(plat()).not.toContain(JSON.stringify(SEARCH_QUERY_KEYS.RESULTS_PREFIX(BLOG_QUERY_KEYS.FEED_PREFIX("monSite"))));
    expect(publicSurfaceKeys()).toHaveLength(publicSurfaceKeys("monSite").length - 1);
  });

  it("chaque clé est un PRÉFIXE (partial-match React Query), pas une clé complète", () => {
    // `invalidateQueries({queryKey})` matche par préfixe : une clé à un seul segment atteint donc
    // toutes les variations de filtres/pagination de la surface. Une clé trop longue n'invaliderait
    // que la vue courante — le défaut serait invisible en test et bien réel à l'écran.
    for (const k of publicSurfaceKeys("monSite")) {
      expect(Array.isArray(k)).toBe(true);
      expect((k as unknown[]).length).toBeLessThanOrEqual(2);
    }
  });
});
