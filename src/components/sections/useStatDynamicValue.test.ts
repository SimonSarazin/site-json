// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { StatDynamicSource } from "@/types/site-schema";

/**
 * Le hook ne doit JAMAIS renvoyer un chiffre inventé : `null` tant que la source
 * dynamique n'est pas connue (pas de `source`, requête en vol, ou en attente d'entité) —
 * c'est ce contrat que `CtaCardGrid` s'appuie dessus pour garder le `value` statique
 * du config comme repli tant que `null` est renvoyé.
 */

const state = vi.hoisted(() => ({
  entity: { slug: "assoc" } as unknown,
  searchTotal: null as number | null,
  membersTotalCount: 0,
  membersIsLoading: false,
}));

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ entity: state.entity }),
}));

const searchAllResultsSpy = vi.fn();
vi.mock("@/modules/search/hooks/useSearchAllResults", () => ({
  useSearchAllResults: (params: unknown) => {
    searchAllResultsSpy(params);
    return { total: state.searchTotal };
  },
}));

const entityMembersSpy = vi.fn();
vi.mock("@/modules/profil/hooks/useMembersQuery", () => ({
  useEntityMembers: (entity: unknown, options: unknown) => {
    entityMembersSpy(entity, options);
    return { totalCount: state.membersTotalCount, isLoading: state.membersIsLoading };
  },
}));

import { useStatDynamicValue } from "./useStatDynamicValue";

beforeEach(() => {
  state.entity = { slug: "assoc" };
  state.searchTotal = null;
  state.membersTotalCount = 0;
  state.membersIsLoading = false;
  searchAllResultsSpy.mockClear();
  entityMembersSpy.mockClear();
});

describe("useStatDynamicValue", () => {
  it("sans source : renvoie null, les deux hooks restent désactivés", () => {
    const { result } = renderHook(() => useStatDynamicValue(undefined, "k"));
    expect(result.current).toBeNull();
    expect(searchAllResultsSpy).toHaveBeenCalledWith(expect.objectContaining({ searchType: null }));
    expect(entityMembersSpy).toHaveBeenCalledWith(null, expect.anything());
  });

  it("searchCount : renvoie le total dès qu'il est connu", () => {
    state.searchTotal = 35;
    const source: StatDynamicSource = { type: "searchCount", entityType: "answers" };
    const { result } = renderHook(() => useStatDynamicValue(source, "k"));
    expect(result.current).toBe(35);
    expect(searchAllResultsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ searchType: { type: ["answers"] } }),
    );
  });

  it("searchCount : renvoie null tant que le total n'est pas encore connu", () => {
    state.searchTotal = null;
    const source: StatDynamicSource = { type: "searchCount", entityType: "answers" };
    const { result } = renderHook(() => useStatDynamicValue(source, "k"));
    expect(result.current).toBeNull();
  });

  it("membersCount : renvoie le total une fois chargé", () => {
    state.membersTotalCount = 12;
    state.membersIsLoading = false;
    // `toBeValidated` omis à dessein : le défaut Zod ne s'applique qu'au `.parse()`
    // du config, un objet non re-parsé arrive tel quel — cf. le commentaire du hook.
    const source = { type: "membersCount" } as StatDynamicSource;
    const { result } = renderHook(() => useStatDynamicValue(source, "k"));
    expect(result.current).toBe(12);
    expect(entityMembersSpy).toHaveBeenCalledWith(state.entity, { toBeValidated: false });
  });

  it("membersCount : renvoie null tant que le chargement est en cours (pas de flash à 0)", () => {
    state.membersTotalCount = 0;
    state.membersIsLoading = true;
    // `toBeValidated` omis à dessein : le défaut Zod ne s'applique qu'au `.parse()`
    // du config, un objet non re-parsé arrive tel quel — cf. le commentaire du hook.
    const source = { type: "membersCount" } as StatDynamicSource;
    const { result } = renderHook(() => useStatDynamicValue(source, "k"));
    expect(result.current).toBeNull();
  });

  it("membersCount : renvoie null si l'entité n'est pas encore disponible", () => {
    state.entity = null;
    state.membersTotalCount = 12;
    state.membersIsLoading = false;
    // `toBeValidated` omis à dessein : le défaut Zod ne s'applique qu'au `.parse()`
    // du config, un objet non re-parsé arrive tel quel — cf. le commentaire du hook.
    const source = { type: "membersCount" } as StatDynamicSource;
    const { result } = renderHook(() => useStatDynamicValue(source, "k"));
    expect(result.current).toBeNull();
  });
});
