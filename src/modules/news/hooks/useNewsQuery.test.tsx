// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { COMMENT_COUNTS_META } from "@/modules/comment/constants/queryKeys";

/**
 * Le fil d'actualités affiche « Commenter (N) » sur chaque actualité : il se DÉCLARE porteur de
 * compteurs de messages (revue du 16/10). C'est cette marque que le module comment périme quand un
 * message s'écrit hors du fil de l'actualité — depuis le panneau des discussions, par exemple —
 * sans connaître ses hôtes.
 */

vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ helper: {} }) }));
vi.mock("@/hooks/useHydratedUserContextId", () => ({ useHydratedUserContextId: () => null }));

const { useNewsQuery } = await import("./useNewsQuery");

describe("useNewsQuery — porteur de compteurs de messages", () => {
  it("sa requête porte la marque que le module comment périme", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const entity = { id: "e".repeat(24), getNews: vi.fn().mockResolvedValue([]) } as unknown as EntityTypes;

    renderHook(() => useNewsQuery({ entity, entityType: "organizations" }), { wrapper });

    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(1));
    expect(client.getQueryCache().getAll()[0]!.meta?.[COMMENT_COUNTS_META]).toBe(true);
  });
});
