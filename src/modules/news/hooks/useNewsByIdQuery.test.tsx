// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { COMMENT_COUNTS_META } from "@/modules/comment/constants/queryKeys";

/**
 * La page d'une actualité — et l'aperçu de recherche — affichent le même « Commenter (N) » que le
 * fil : sa requête se DÉCLARE porteuse de compteurs de messages, comme celle du fil
 * (`useNewsQuery.test.tsx`). Sans cette marque, un message écrit hors de son fil laissait le
 * compteur de la page en retard (relecture du lot, 16/10).
 */

vi.mock("@/hooks/useHydratedUserContextId", () => ({ useHydratedUserContextId: () => null }));

const { useNewsByIdQuery } = await import("./useNewsByIdQuery");

describe("useNewsByIdQuery — porteur de compteurs de messages", () => {
  it("sa requête porte la marque que le module comment périme", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const entity = { id: "e".repeat(24), news: vi.fn().mockResolvedValue({ id: "n".repeat(24) }) } as unknown as EntityTypes;

    renderHook(() => useNewsByIdQuery({ newsId: "n".repeat(24), entity }), { wrapper });

    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(1));
    expect(client.getQueryCache().getAll()[0]!.meta?.[COMMENT_COUNTS_META]).toBe(true);
  });
});
