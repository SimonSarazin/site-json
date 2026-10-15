// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * Un chiffre de tuile ne doit JAMAIS être inventé : `null` tant que le compte n'est pas connu,
 * `unavailable` seulement quand il ne viendra pas. Piège d'origine : `totalCount` vaut 0 tant que
 * la 1ʳᵉ page n'a pas apporté son `count` (vol, échec) — d'où des tuiles à « 0 » en SSR et pour
 * toujours après un échec. La recherche est doublée UNE COUCHE PLUS BAS (`useSearchQuery`), avec
 * les valeurs que produit le vrai `useInfiniteQueryScroll`, pour que `useSearchAllResults` tourne.
 */

const state = vi.hoisted(() => ({
  entity: { slug: "assoc" } as unknown,
  query: {} as Record<string, unknown>,
  members: {} as Record<string, unknown>,
}));

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ entity: state.entity }),
}));

const searchQuerySpy = vi.fn();
vi.mock("@/modules/search/hooks/useSearchQuery", () => ({
  useSearchQuery: (params: unknown) => {
    searchQuerySpy(params);
    return state.query;
  },
}));

const entityMembersSpy = vi.fn();
vi.mock("@/modules/profil/hooks/useMembersQuery", () => ({
  useEntityMembers: (entity: unknown, options: unknown) => {
    entityMembersSpy(entity, options);
    return state.members;
  },
}));

import { useMembersCountState, useSearchCountState } from "./useStatDynamicValue";

/** Ce que `useInfiniteQueryScroll` rend tant que la 1ʳᵉ page n'est pas revenue. */
const QUERY_IN_FLIGHT = {
  transformedResults: [],
  totalCount: 0,
  hasCount: false,
  isLoading: true,
  isPending: true,
  isFetching: true,
  error: null,
  fetchNextPage: () => Promise.resolve(),
  hasNextPage: false,
  isFetchingNextPage: false,
};

const SEARCH = { type: "searchCount", entityType: "citoyens", baseParams: { notSourceKey: true } } as const;

beforeEach(() => {
  state.entity = { slug: "assoc" };
  state.query = { ...QUERY_IN_FLIGHT };
  state.members = { totalCount: 0, hasCount: false, isLoading: true, error: null };
  searchQuerySpy.mockClear();
  entityMembersSpy.mockClear();
});

describe("useSearchCountState", () => {
  it("en vol : en attente — pas le 0 d'attente de totalCount", () => {
    const { result } = renderHook(() => useSearchCountState(SEARCH, "k"));
    expect(result.current).toEqual({ value: null, unavailable: false });
    expect(searchQuerySpy).toHaveBeenCalledWith(
      expect.objectContaining({ searchType: { type: ["citoyens"] }, baseParams: { notSourceKey: true } }),
    );
  });

  it("requête désactivée (SSR, API non résolue) : en attente", () => {
    state.query = { ...QUERY_IN_FLIGHT, isLoading: false, isFetching: false };
    const { result } = renderHook(() => useSearchCountState(SEARCH, "k"));
    expect(result.current).toEqual({ value: null, unavailable: false });
  });

  it("échec sans count : indisponible, jamais « 0 »", () => {
    state.query = { ...QUERY_IN_FLIGHT, isLoading: false, isPending: false, isFetching: false, error: new Error("500") };
    const { result } = renderHook(() => useSearchCountState(SEARCH, "k"));
    expect(result.current).toEqual({ value: null, unavailable: true });
  });

  it("sans entité (slug non résolu) : la recherche ne part pas — indisponible, pas en attente", () => {
    state.entity = null;
    state.query = { ...QUERY_IN_FLIGHT, isLoading: false, isFetching: false };
    const { result } = renderHook(() => useSearchCountState(SEARCH, "k"));
    expect(result.current).toEqual({ value: null, unavailable: true });
  });

  it("count reçu : le total, zéro compris", () => {
    state.query = { ...QUERY_IN_FLIGHT, totalCount: 91, hasCount: true, isLoading: false, isPending: false };
    expect(renderHook(() => useSearchCountState(SEARCH, "k")).result.current).toEqual({ value: 91, unavailable: false });

    state.query = { ...QUERY_IN_FLIGHT, totalCount: 0, hasCount: true, isLoading: false, isPending: false };
    expect(renderHook(() => useSearchCountState(SEARCH, "k")).result.current).toEqual({ value: 0, unavailable: false });
  });
});

describe("useMembersCountState", () => {
  // `toBeValidated` omis à dessein : le défaut Zod ne s'applique qu'au `.parse()` du config.
  const MEMBERS = { type: "membersCount" } as { type: "membersCount"; toBeValidated: boolean };

  it("count reçu : le total des membres validés", () => {
    state.members = { totalCount: 12, hasCount: true, isLoading: false, error: null };
    const { result } = renderHook(() => useMembersCountState(MEMBERS));
    expect(result.current).toEqual({ value: 12, unavailable: false });
    expect(entityMembersSpy).toHaveBeenCalledWith(state.entity, { toBeValidated: false });
  });

  it("en vol : en attente — pas de flash à 0", () => {
    const { result } = renderHook(() => useMembersCountState(MEMBERS));
    expect(result.current).toEqual({ value: null, unavailable: false });
  });

  it("sans entité (le client résout la sienne AVANT son 1er rendu : slug non résolu) : indisponible", () => {
    state.entity = null;
    state.members = { totalCount: 0, hasCount: false, isLoading: false, error: null };
    const { result } = renderHook(() => useMembersCountState(MEMBERS));
    expect(result.current).toEqual({ value: null, unavailable: true });
  });

  it("refetch en échec avec données : le chiffre déjà compté reste", () => {
    state.members = { totalCount: 37, hasCount: true, isLoading: false, error: new Error("500") };
    const { result } = renderHook(() => useMembersCountState(MEMBERS));
    expect(result.current).toEqual({ value: 37, unavailable: false });
  });

  it("échec : indisponible, jamais le 0 de totalCount", () => {
    state.members = { totalCount: 0, hasCount: false, isLoading: false, error: new Error("500") };
    const { result } = renderHook(() => useMembersCountState(MEMBERS));
    expect(result.current).toEqual({ value: null, unavailable: true });
  });

  it("entité sans membres (repli de useEntityMembers) : indisponible", () => {
    state.members = { totalCount: 0, hasCount: false, isLoading: false, error: null };
    const { result } = renderHook(() => useMembersCountState(MEMBERS));
    expect(result.current).toEqual({ value: null, unavailable: true });
  });
});
