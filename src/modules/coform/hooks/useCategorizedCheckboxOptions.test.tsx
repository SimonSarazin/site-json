// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { CategorizedCheckboxConfig } from "../types";

/**
 * Ce que ces tests protègent : le hook doit se DÉGRADER, jamais planter.
 *
 * `CoFormReadOnly` se rend délibérément hors `CocolightProvider` (il lit `me` avec la variante
 * tolérante). Un hook qui exigerait le provider ferait tomber tout l'affichage d'une réponse.
 */

const mockContext = vi.fn<() => unknown>();
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => {
    throw new Error("useCocolight must be used within a CocolightProvider");
  },
  useCocolightOptional: () => mockContext(),
}));

const { useCategorizedCheckboxOptions } = await import("./useCategorizedCheckboxOptions");

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const CONFIG_MANUEL: CategorizedCheckboxConfig = {
  dataSourceToUse: "manual",
  list: ["Gestion", "Juridique"],
  sublist: { "0_gestion": ["Comptabilité"] },
  formParamsSource: [],
  questionsParamsSource: [],
};

const CONFIG_DISTANT: CategorizedCheckboxConfig = {
  dataSourceToUse: "distanceOnly",
  list: [],
  sublist: {},
  formParamsSource: ["6525865cdeaf281bbc7280e9"],
  questionsParamsSource: [
    "6525865cdeaf281bbc7280e9-step-communsDeCaes1696958044_0lnkmtohuq5cvjy0fp3f",
  ],
};

describe("useCategorizedCheckboxOptions", () => {
  it("ne plante pas hors CocolightProvider et ne charge rien", () => {
    mockContext.mockReturnValue(null);
    const { result } = renderHook(() => useCategorizedCheckboxOptions(CONFIG_DISTANT), { wrapper });
    expect(result.current.options).toEqual([]);
    expect(result.current.error).toBeNull();
    // Sans API, on n'annonce pas un chargement qui n'arrivera jamais.
    expect(result.current.isLoading).toBe(false);
  });

  it("rend la liste manuelle sans aucun appel réseau", () => {
    mockContext.mockReturnValue(null);
    const { result } = renderHook(() => useCategorizedCheckboxOptions(CONFIG_MANUEL), { wrapper });
    expect(result.current.options.map((o) => o.key)).toEqual(["0_gestion", "1_juridique"]);
    expect(result.current.options[0].children.map((c) => c.key)).toEqual(["0_comptabilite"]);
    expect(result.current.isLoading).toBe(false);
  });

  it("n'annonce pas de chargement quand aucune question source n'est déclarée", () => {
    mockContext.mockReturnValue({ api: {}, loading: false });
    const { result } = renderHook(
      () => useCategorizedCheckboxOptions({ ...CONFIG_DISTANT, questionsParamsSource: [] }),
      { wrapper },
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.options).toEqual([]);
  });

  it("ignore une question dont le formulaire n'est plus déclaré en source", () => {
    // `questionsParamsSource` peut survivre au retrait de son formulaire du finder.
    mockContext.mockReturnValue({ api: {}, loading: false });
    const { result } = renderHook(
      () =>
        useCategorizedCheckboxOptions({
          ...CONFIG_DISTANT,
          formParamsSource: ["unAutreFormulaire"],
        }),
      { wrapper },
    );
    expect(result.current.isLoading).toBe(false);
  });

  it("tolère l'absence totale de config", () => {
    mockContext.mockReturnValue(null);
    const { result } = renderHook(() => useCategorizedCheckboxOptions(undefined), { wrapper });
    expect(result.current.options).toEqual([]);
  });
});
