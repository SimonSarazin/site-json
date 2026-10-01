// @vitest-environment jsdom
/**
 * Suppression définitive d'une fiche : ce que la mutation appelle VRAIMENT côté SDK, et ce qu'elle
 * invalide ensuite. Le point qui justifie ce test : la fiche disparaît du réseau entier, donc les
 * listes de recherche doivent être invalidées — sans quoi le lieu supprimé continue de s'afficher
 * dans l'annuaire jusqu'au prochain rechargement complet.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";

import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { SEARCH_STATIC_LIST_PREFIX, SEARCH_STATIC_MAP_PREFIX } from "@/modules/search/constants/queryKeys";
import { SEARCH_QUERY_KEYS as SEARCH_KEYS } from "@/modules/search/constants/queryKeys";
import { BLOG_QUERY_KEYS } from "@/modules/blog/constants/queryKeys";
import { useDeleteEntity } from "./deleteEntity";

vi.mock("@/lib/toastUtils", () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ me: { slug: "moi" }, entity: { slug: "tiers-lieux" } }),
}));

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider>{children}</LocalizationProvider>
    </QueryClientProvider>
  );
}

/** Comme le SDK (`_markDeletedLocally`) : une fois `delete()` résolu, l'instance est vidée. */
const ficheAvecDelete = (suppression: (reason?: string) => Promise<void>) => {
  const fiche = {
    slug: "la-plume-a-loup" as string | null,
    getEntityType: () => "organizations",
    delete: async (reason?: string) => {
      await suppression(reason);
      fiche.slug = null;
    },
  };
  return fiche as unknown as EntityTypes;
};

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
});

describe("useDeleteEntity — suppression définitive de la fiche", () => {
  it("appelle `delete()` du SDK avec une raison (tracée côté backend)", async () => {
    const suppression = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteEntity(ficheAvecDelete(suppression)), { wrapper });

    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(suppression).toHaveBeenCalledTimes(1);
    expect(suppression.mock.calls[0][0]).toMatch(/administrateur/i);
  });

  it("retire la fiche du cache sous son slug d'AVANT la suppression", async () => {
    const remove = vi.spyOn(queryClient, "removeQueries");
    const { result } = renderHook(
      () => useDeleteEntity(ficheAvecDelete(vi.fn().mockResolvedValue(undefined))),
      { wrapper },
    );

    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cles = remove.mock.calls.map(([arg]) => JSON.stringify((arg as { queryKey: unknown }).queryKey));
    expect(cles).toEqual([JSON.stringify(["element-about", "la-plume-a-loup"])]);
  });

  it("invalide « Mes lieux », les listes de recherche (liste + carte) et le fil blog du costum", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(
      () => useDeleteEntity(ficheAvecDelete(vi.fn().mockResolvedValue(undefined))),
      { wrapper },
    );

    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cles = invalidate.mock.calls.map(([arg]) => JSON.stringify((arg as { queryKey: unknown }).queryKey));
    expect(cles).toContain(JSON.stringify(["user-organizations", "moi"]));
    expect(cles).toContain(JSON.stringify(SEARCH_KEYS.RESULTS_PREFIX(BLOG_QUERY_KEYS.FEED_PREFIX("tiers-lieux"))));
    expect(cles.some((c) => c.includes("element-about"))).toBe(false);
    expect(cles).toContain(JSON.stringify([SEARCH_STATIC_LIST_PREFIX]));
    expect(cles).toContain(JSON.stringify([SEARCH_STATIC_MAP_PREFIX]));
  });

  it("échoue clairement si l'entité ne sait pas se supprimer (SDK trop ancien)", async () => {
    const sansDelete = { slug: "x", getEntityType: () => "organizations" } as unknown as EntityTypes;
    const { result } = renderHook(() => useDeleteEntity(sansDelete), { wrapper });

    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/sait pas se supprimer/i);
  });

  it("sans entité, ne tente rien", async () => {
    const { result } = renderHook(() => useDeleteEntity(null), { wrapper });
    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
