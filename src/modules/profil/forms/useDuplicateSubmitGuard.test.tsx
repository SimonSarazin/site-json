// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import type { DuplicateCheckSpec } from "./entityModalSpec";

/**
 * La garde s'intercale AVANT la création : elle ne doit ni bloquer une création légitime (réseau
 * en panne, homonyme d'une autre commune), ni laisser passer une double soumission pendant sa
 * propre vérification, ni agir pour une modale que l'utilisateur a fermée entre-temps, ni laisser
 * un rejet non capturé quand la création confirmée échoue.
 */
const ctx = vi.hoisted(() => ({
  searchCostum: vi.fn(),
  entity: null as unknown,
}));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ entity: ctx.entity }) }));
vi.mock("@/hooks/useSite", () => ({
  useSite: () => ({ config: { pages: [{ path: "/lieux", sections: [{ type: "searchProStatic", id: "annuaire", props: { baseParams: { notSourceKey: true } } }] }] } }),
}));
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, _fallback?: string, p?: Record<string, unknown>) => (p ? `${key}:${JSON.stringify(p)}` : key),
}));

import { useDuplicateSubmitGuard } from "./useDuplicateSubmitGuard";

const PARAMS: DuplicateCheckSpec = {
  nameField: "name",
  postalCodeField: "postalCode",
  confirmOnSubmit: true,
  search: { types: ["organizations"], from: { page: "/lieux", sectionId: "annuaire" } },
};
const found = (name: string, postalCode: string, id = "p1") => ({ id, slug: id, serverData: { name, address: { postalCode, addressLocality: "ATTIN" } } });
const VALUES = { name: "La Plume à loup", postalCode: "62170" };
const mountGuard = (params: DuplicateCheckSpec | undefined = PARAMS) =>
  renderHook(({ open }) => useDuplicateSubmitGuard(params, open), { initialProps: { open: true } });

beforeEach(() => {
  ctx.searchCostum = vi.fn().mockResolvedValue({ results: [found("La Plume à Loup", "62170")] });
  ctx.entity = { searchCostum: (...a: unknown[]) => ctx.searchCostum(...a) };
});

describe("useDuplicateSubmitGuard", () => {
  it("sans paramètres, ou confirmOnSubmit absent : n'intercepte pas et ne cherche pas", async () => {
    for (const params of [undefined, { ...PARAMS, confirmOnSubmit: false }, { ...PARAMS, postalCodeField: undefined }]) {
      const { result } = renderHook(() => useDuplicateSubmitGuard(params, true));
      let intercepted = true;
      await act(async () => { intercepted = await result.current.intercept(VALUES, vi.fn()); });
      expect(intercepted).toBe(false);
    }
    expect(ctx.searchCostum).not.toHaveBeenCalled();
  });

  it("même nom et même code postal : intercepte, cherche sur le nom NETTOYÉ et ouvre la confirmation", async () => {
    const { result } = mountGuard();
    const proceed = vi.fn().mockResolvedValue(undefined);
    let intercepted = false;
    await act(async () => { intercepted = await result.current.intercept(VALUES, proceed); });
    expect(intercepted).toBe(true);
    expect(proceed).not.toHaveBeenCalled();
    expect(ctx.searchCostum.mock.calls[0][0]).toMatchObject({ name: "La Plume à loup", searchType: ["organizations"], searchBy: ["name"], notSourceKey: true });
    const { getByText } = render(<>{result.current.confirmDialog}</>);
    expect(getByText(/EntityDuplicates\.confirm\.description/).textContent).toContain("La Plume à Loup");
  });

  it("homonyme d'une AUTRE commune : pas de confirmation", async () => {
    ctx.searchCostum.mockResolvedValue({ results: [found("La Plume à Loup", "59000")] });
    const { result } = mountGuard();
    let intercepted = true;
    await act(async () => { intercepted = await result.current.intercept(VALUES, vi.fn()); });
    expect(intercepted).toBe(false);
  });

  it("homonyme exact ANCIEN, hors de la première page : trouvé en lisant les pages suivantes (3 au plus)", async () => {
    const page3 = { results: [found("La Plume à Loup", "62170", "vieux")], hasNext: true, next: vi.fn() };
    const page2 = { results: [found("La Plume d'or", "75011", "b")], hasNext: true, next: vi.fn().mockResolvedValue(page3) };
    ctx.searchCostum.mockResolvedValue({ results: [found("Plume", "13000", "a")], hasNext: true, next: vi.fn().mockResolvedValue(page2) });
    const { result } = mountGuard();
    let intercepted = false;
    await act(async () => { intercepted = await result.current.intercept(VALUES, vi.fn()); });
    expect(intercepted).toBe(true);
    expect(page3.next).not.toHaveBeenCalled(); // plafond : pas de quatrième page
  });

  it("recherche en échec : la création se poursuit (alerte non bloquante)", async () => {
    ctx.searchCostum.mockRejectedValue(new Error("réseau"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { result } = mountGuard();
    let intercepted = true;
    await act(async () => { intercepted = await result.current.intercept(VALUES, vi.fn()); });
    expect(intercepted).toBe(false);
    expect(result.current.checking).toBe(false);
    warn.mockRestore();
  });

  it("`checking` est vrai pendant la vérification (le bouton de soumission reste désactivé)", async () => {
    let release: (v: unknown) => void = () => undefined;
    ctx.searchCostum.mockReturnValue(new Promise((r) => { release = r; }));
    const { result } = mountGuard();
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => { pending = result.current.intercept(VALUES, vi.fn()); });
    expect(result.current.checking).toBe(true);
    await act(async () => { release({ results: [] }); await pending; });
    expect(result.current.checking).toBe(false);
  });

  it("modale FERMÉE pendant la vérification : soumission abandonnée — ni confirmation, ni création", async () => {
    for (const results of [[found("La Plume à Loup", "62170")], []]) {
      let release: (v: unknown) => void = () => undefined;
      ctx.searchCostum.mockReturnValue(new Promise((r) => { release = r; }));
      const { result, rerender } = mountGuard();
      const proceed = vi.fn();
      let pending: Promise<boolean> = Promise.resolve(false);
      act(() => { pending = result.current.intercept(VALUES, proceed); });
      rerender({ open: false });
      let intercepted = false;
      await act(async () => { release({ results }); intercepted = await pending; });
      // `true` = « pris en charge » : l'appelant ne doit PAS enchaîner sur la création.
      expect(intercepted).toBe(true);
      expect(proceed).not.toHaveBeenCalled();
      const { queryByText } = render(<>{result.current.confirmDialog}</>);
      expect(queryByText("EntityDuplicates.confirm.title")).toBeNull();
    }
  });

  it("confirmer relance la création ; un échec de création est capturé (pas de rejet non géré)", async () => {
    const { result, rerender } = mountGuard();
    const proceed = vi.fn().mockRejectedValue(new Error("création refusée"));
    await act(async () => { await result.current.intercept(VALUES, proceed); });
    rerender({ open: true });
    const { getByText } = render(<>{result.current.confirmDialog}</>);
    await act(async () => { getByText("EntityDuplicates.confirm.create").click(); });
    expect(proceed).toHaveBeenCalledTimes(1);
  });

  it("annuler ne crée rien, et une seconde soumission redemande confirmation", async () => {
    const { result, rerender } = mountGuard();
    const proceed = vi.fn().mockResolvedValue(undefined);
    await act(async () => { await result.current.intercept(VALUES, proceed); });
    rerender({ open: true });
    const first = render(<>{result.current.confirmDialog}</>);
    await act(async () => { first.getByText("EntityDuplicates.confirm.cancel").click(); });
    first.unmount();
    expect(proceed).not.toHaveBeenCalled();
    let again = false;
    await act(async () => { again = await result.current.intercept(VALUES, proceed); });
    expect(again).toBe(true);
  });

  it("sous le seuil de caractères : n'intercepte pas", async () => {
    const { result } = mountGuard();
    let intercepted = true;
    await act(async () => { intercepted = await result.current.intercept({ name: "La", postalCode: "62170" }, vi.fn()); });
    expect(intercepted).toBe(false);
    expect(ctx.searchCostum).not.toHaveBeenCalled();
  });
});
