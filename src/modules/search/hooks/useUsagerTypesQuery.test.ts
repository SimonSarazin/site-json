// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PoiSearchHost } from "./useResourcesInPerimeterQuery";

const ctx = vi.hoisted(() => ({ entity: null as unknown }));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ entity: ctx.entity }) }));

import { fetchUsagerTypes, useUsagerTypesQuery } from "./useUsagerTypesQuery";

const page = (results: unknown[], next?: () => Promise<unknown>) => ({ results, hasNext: Boolean(next), next });
const host = (searchCostum: ReturnType<typeof vi.fn>) => ({ searchCostum }) as unknown as PoiSearchHost;

describe("fetchUsagerTypes — type de la fiche des organisations usagères", () => {
  it("aucun identifiant → aucun appel (un $in vide renverrait toutes les organisations)", async () => {
    const searchCostum = vi.fn();
    expect((await fetchUsagerTypes(host(searchCostum), [])).size).toBe(0);
    expect(searchCostum).not.toHaveBeenCalled();
  });

  it("cherche hors costum, par identifiants triés et dédoublonnés, avec le champ type", async () => {
    const searchCostum = vi.fn().mockResolvedValue(page([]));
    await fetchUsagerTypes(host(searchCostum), ["b", "a", "b"]);
    expect(searchCostum).toHaveBeenCalledWith(expect.objectContaining({
      notSourceKey: true,
      searchType: ["organizations"],
      filters: { _id: { $in: ["a", "b"] } },
      fields: ["collection", "type"],
    }));
  });

  it("lit le type du document brut (serverData) avant celui de l'objet, et suit les pages", async () => {
    const searchCostum = vi.fn().mockResolvedValue(
      page([{ id: "ecole", serverData: { type: "GovernmentOrganization" }, type: "organizations" }], async () =>
        page([{ id: "club", type: "NGO" }, { id: "sans-type" }]),
      ),
    );
    const types = await fetchUsagerTypes(host(searchCostum), ["ecole", "club", "sans-type"]);
    expect(Object.fromEntries(types)).toEqual({ ecole: "GovernmentOrganization", club: "NGO" });
  });
});

describe("useUsagerTypesQuery — échec de la recherche", () => {
  it("aucun type lu → `failed`, table vide, plus de chargement", async () => {
    ctx.entity = host(vi.fn().mockRejectedValue(new Error("réseau")));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useUsagerTypesQuery(["a"]), { wrapper });

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.types.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });
});
