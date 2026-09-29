// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * Périmètre des lieux de « J'utilise », résolu depuis `config.aac.detail` :
 * `placeSourceKeys` s'il est déclaré, sinon le préréglage de `placeKind`
 * (défaut : tiers-lieux) — même résolution que `PlacesListView`.
 */

let detail: Record<string, unknown> | undefined;
vi.mock("@/hooks/useSite", () => ({
  useSite: () => ({ config: { aac: { formId: "f1", detail } } }),
}));
// Dépendances de `useAacDetailSections` (non testé ici) : écartées à leur frontière.
vi.mock("@/hooks/useT", () => ({ useT: () => (k: string) => k }));
vi.mock("./useAacFormMeta", () => ({ useAacFormMeta: () => ({ meta: null, isLoading: false }) }));

const { useAacPlaceSourceKeys, placeKindFromTypeCoFinancer } = await import("./useAacDetailSections");

beforeEach(() => {
  detail = undefined;
});

describe("useAacPlaceSourceKeys", () => {
  it("rien de déclaré → mes tiers-lieux (source franceTierslieux)", () => {
    const { result } = renderHook(() => useAacPlaceSourceKeys());
    expect(result.current).toEqual(["franceTierslieux"]);
  });

  it("`placeKind: cae` → mes CAE (source federationDesCae)", () => {
    detail = { placeKind: "cae" };
    const { result } = renderHook(() => useAacPlaceSourceKeys());
    expect(result.current).toEqual(["federationDesCae"]);
  });

  it("`placeSourceKeys` → l'emporte sur `placeKind`", () => {
    detail = { placeKind: "cae", placeSourceKeys: ["federationDesCae", "autreReseauCae"] };
    const { result } = renderHook(() => useAacPlaceSourceKeys());
    expect(result.current).toEqual(["federationDesCae", "autreReseauCae"]);
  });

  it("sans `placeKind`, le `typeCoFinancer` du form décide", () => {
    const { result } = renderHook(() => useAacPlaceSourceKeys("CAE"));
    expect(result.current).toEqual(["federationDesCae"]);
  });

  it("`placeKind` l'emporte sur le `typeCoFinancer` du form", () => {
    detail = { placeKind: "tiersLieu" };
    const { result } = renderHook(() => useAacPlaceSourceKeys("cae"));
    expect(result.current).toEqual(["franceTierslieux"]);
  });

  it("référence stable d'un rendu à l'autre (pas de refetch par identité)", () => {
    detail = { placeKind: "cae" };
    const { result, rerender } = renderHook(() => useAacPlaceSourceKeys());
    const premier = result.current;
    rerender();
    expect(result.current).toBe(premier);
  });
});

describe("placeKindFromTypeCoFinancer", () => {
  it("`cae`, sans casse ni espaces → CAE", () => {
    expect(placeKindFromTypeCoFinancer(" Cae ")).toBe("cae");
  });

  it("toute autre valeur → tiers-lieux", () => {
    expect(placeKindFromTypeCoFinancer("tiersLieux")).toBe("tiersLieu");
    expect(placeKindFromTypeCoFinancer("autre")).toBe("tiersLieu");
  });

  it("absent ou vide → indéterminé", () => {
    expect(placeKindFromTypeCoFinancer(null)).toBeUndefined();
    expect(placeKindFromTypeCoFinancer("  ")).toBeUndefined();
  });
});
