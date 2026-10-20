// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Après la création d'une answer depuis une liste (« Ajouter un créneau » de /creneaux) : listes et
 * cartes statiques rafraîchies, chiffres des tuiles de stat (« Créneaux disponibles »), listes gérées
 * du compte aussi (onglet « Structures »), et le message
 * configuré — sans lui, le déposant d'un créneau modéré, invisible dans la liste, croirait à un échec.
 */
const ctx = vi.hoisted(() => ({ me: null as { id?: string } | null, toastSuccess: vi.fn() }));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me: ctx.me }) }));
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string | { fr?: string }) => (typeof key === "string" ? key : (key.fr ?? "")),
}));
vi.mock("sonner", () => ({ toast: { success: ctx.toastSuccess } }));

import { useAnswerCreated } from "./useAnswerCreated";

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  queryClient = new QueryClient();
  ctx.me = { id: "u1" };
  ctx.toastSuccess.mockClear();
});

describe("useAnswerCreated", () => {
  it("rafraîchit listes et cartes statiques, chiffres des tuiles ET listes gérées du compte, puis dit le message configuré", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAnswerCreated({ fr: "Créneau ajouté. Il sera publié après validation." }), { wrapper });
    result.current();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["searchCostumStatic"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["searchCostumStaticMapAll"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["stat-search-count"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["managed-answers:u1"] });
    expect(ctx.toastSuccess).toHaveBeenCalledWith("Créneau ajouté. Il sera publié après validation.");
  });

  it("sans message configuré : aucun message (comportement historique) ; sans compte : pas de listes gérées", () => {
    ctx.me = null;
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAnswerCreated(undefined), { wrapper });
    result.current();
    expect(ctx.toastSuccess).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: expect.arrayContaining([expect.stringMatching(/^managed-answers:/)]) });
  });
});
