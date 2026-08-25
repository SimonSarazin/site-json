// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCostumListsMutations, type CostumListsWritableCarrier } from "./useCostumListsMutations";

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string) => key,
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

/** Faux carrier capturant chaque `updateField` + comptant les `refresh()` — même patron que
 *  `makeSdk()`/`makeEditable()` dans `profil/hooks/useEntityMutation.test.ts`. */
function makeCarrier(lists: Record<string, unknown>, opts: { admin?: boolean } = {}) {
  const updates: Array<{ path: string; value: unknown; opts?: unknown }> = [];
  let refreshed = 0;
  const carrier: CostumListsWritableCarrier = {
    isAdmin: () => opts.admin ?? true,
    serverData: { costum: { lists } },
    updateField: async (path, value, updateOpts) => {
      updates.push({ path, value, opts: updateOpts });
    },
    refresh: async () => {
      refreshed += 1;
    },
  };
  return { carrier, updates, getRefreshed: () => refreshed };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const rendu = (carrier: CostumListsWritableCarrier | null) =>
  renderHook(() => useCostumListsMutations(carrier), { wrapper });

describe("useCostumListsMutations", () => {
  beforeEach(() => {
    toastError.mockClear();
    toastSuccess.mockClear();
  });

  it("addValue : $push d'une valeur inédite, puis refresh une fois", async () => {
    const { carrier, updates, getRefreshed } = makeCarrier({ themes: ["Sport"] });
    const { result } = rendu(carrier);

    await result.current.addValue("themes", "Culture");

    expect(updates).toEqual([{ path: "costum.lists.themes", value: "Culture", opts: { arrayForm: true } }]);
    expect(getRefreshed()).toBe(1);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("AdminLists.success.add"));
  });

  it("addValue : un doublon casse/accents près est rejeté avant tout appel réseau", async () => {
    const { carrier, updates, getRefreshed } = makeCarrier({ themes: ["Sport"] });
    const { result } = rendu(carrier);

    await expect(result.current.addValue("themes", "sport")).rejects.toThrow();
    expect(updates).toEqual([]);
    expect(getRefreshed()).toBe(0);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("AdminLists.reject.duplicate"));
  });

  it("renameValue : $set du tableau complet, sans arrayForm", async () => {
    const { carrier, updates } = makeCarrier({ themes: ["Sport", "Culture"] });
    const { result } = rendu(carrier);

    await result.current.renameValue("themes", 0, "Loisirs");

    expect(updates).toEqual([{ path: "costum.lists.themes", value: ["Loisirs", "Culture"], opts: undefined }]);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("AdminLists.success.rename"));
  });

  it("removeValue : $set du tableau sans l'entrée retirée", async () => {
    const { carrier, updates } = makeCarrier({ themes: ["Sport", "Culture", "Loisirs"] });
    const { result } = rendu(carrier);

    await result.current.removeValue("themes", 1);

    expect(updates).toEqual([{ path: "costum.lists.themes", value: ["Sport", "Loisirs"], opts: undefined }]);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("AdminLists.success.remove"));
  });

  it("reorderValues : $set direct si `next` est une permutation valide", async () => {
    const { carrier, updates } = makeCarrier({ themes: ["Sport", "Culture", "Loisirs"] });
    const { result } = rendu(carrier);

    await result.current.reorderValues("themes", ["Loisirs", "Sport", "Culture"]);

    expect(updates).toEqual([{ path: "costum.lists.themes", value: ["Loisirs", "Sport", "Culture"], opts: undefined }]);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("AdminLists.success.reorder"));
  });

  it("reorderValues : rejette (et n'écrit rien) si `next` n'est pas une permutation de l'existant", async () => {
    const { carrier, updates, getRefreshed } = makeCarrier({ themes: ["Sport", "Culture"] });
    const { result } = rendu(carrier);

    await expect(result.current.reorderValues("themes", ["Sport", "Sport"])).rejects.toThrow();
    expect(updates).toEqual([]);
    expect(getRefreshed()).toBe(0);
  });

  it("createList : $push de la première valeur sur une clé inédite (jamais un tableau vide — le backend ne persiste pas une valeur vide)", async () => {
    const { carrier, updates, getRefreshed } = makeCarrier({ themes: ["Sport"] });
    const { result } = rendu(carrier);

    await result.current.createList("publics", "Adolescents");

    expect(updates).toEqual([{ path: "costum.lists.publics", value: "Adolescents", opts: { arrayForm: true } }]);
    expect(getRefreshed()).toBe(1);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("AdminLists.success.createList"));
  });

  it("createList : rejette un nom de liste déjà pris", async () => {
    const { carrier, updates } = makeCarrier({ themes: ["Sport"] });
    const { result } = rendu(carrier);

    await expect(result.current.createList("themes", "Adolescents")).rejects.toThrow();
    expect(updates).toEqual([]);
  });

  it("createList : rejette une première valeur vide (sans quoi le $push écrirait une entrée vide)", async () => {
    const { carrier, updates } = makeCarrier({ themes: ["Sport"] });
    const { result } = rendu(carrier);

    await expect(result.current.createList("publics", "  ")).rejects.toThrow();
    expect(updates).toEqual([]);
  });

  it("removeValue : rejette (et n'écrit rien) si ça viderait la liste — le backend ne persiste pas un tableau vide", async () => {
    const { carrier, updates, getRefreshed } = makeCarrier({ themes: ["Sport"] });
    const { result } = rendu(carrier);

    await expect(result.current.removeValue("themes", 0)).rejects.toThrow();
    expect(updates).toEqual([]);
    expect(getRefreshed()).toBe(0);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("AdminLists.reject.wouldEmpty"));
  });

  it("isAdmin() === false bloque toute écriture, aucun updateField appelé", async () => {
    const { carrier, updates, getRefreshed } = makeCarrier({ themes: ["Sport"] }, { admin: false });
    const { result } = rendu(carrier);

    await expect(result.current.addValue("themes", "Culture")).rejects.toThrow();
    expect(updates).toEqual([]);
    expect(getRefreshed()).toBe(0);
  });

  it("un rejet côté carrier (échec réseau) ne déclenche jamais refresh()", async () => {
    const carrier: CostumListsWritableCarrier = {
      isAdmin: () => true,
      serverData: { costum: { lists: { themes: ["Sport"] } } },
      updateField: async () => {
        throw new Error("réseau");
      },
      refresh: vi.fn(async () => {}),
    };
    const { result } = rendu(carrier);

    await expect(result.current.addValue("themes", "Culture")).rejects.toThrow("réseau");
    expect(carrier.refresh).not.toHaveBeenCalled();
  });

  it("sans carrier (pas de contexte), rejette sans planter", async () => {
    const { result } = rendu(null);
    await expect(result.current.addValue("themes", "Culture")).rejects.toThrow();
  });
});
