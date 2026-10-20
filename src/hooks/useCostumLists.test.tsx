// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCostumListsReactive } from "./useCostumLists";

/**
 * Ce que ce test protège : `useCostumListsReactive` doit renvoyer une référence STABLE quand il n'y a
 * aucune liste (`costum.lists`/`lists` absents) — un littéral `{}` neuf à chaque rendu casserait le
 * `useMemo` de tout consommateur qui le met en dépendance (`useDynamicFilterOptions`), provoquant une
 * boucle de rendu infinie sur n'importe quel site sans liste costum statique déclarée (régression trouvée
 * en revue, corrigée par `AUCUNE_LISTE` — cf. `useCostumLists.tsx`).
 */
describe("useCostumListsReactive", () => {
  it("carrier sans costum.lists/lists : référence STABLE d'un rendu à l'autre", () => {
    const carrier = { serverData: { slug: "un-site" } };
    const { result, rerender } = renderHook(() => useCostumListsReactive(carrier));
    const premiere = result.current;
    rerender();
    expect(result.current).toBe(premiere);
  });

  it("carrier null : référence STABLE d'un rendu à l'autre", () => {
    const { result, rerender } = renderHook(() => useCostumListsReactive(null));
    const premiere = result.current;
    rerender();
    expect(result.current).toBe(premiere);
  });

  it("costum.lists présent (statique) : renvoie l'objet réel", () => {
    const carrier = { serverData: { slug: "un-site", costum: { lists: { themes: ["a", "b"] } } } };
    const { result } = renderHook(() => useCostumListsReactive(carrier));
    expect(result.current).toEqual({ themes: ["a", "b"] });
  });

  it("repli sur `lists` racine quand `costum.lists` absent", () => {
    const carrier = { serverData: { slug: "un-site", lists: { financeurs: ["ADEME"] } } };
    const { result } = renderHook(() => useCostumListsReactive(carrier));
    expect(result.current).toEqual({ financeurs: ["ADEME"] });
  });
});
