// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Gestion des amplis : QUI y a droit, et ce qui part vraiment au SDK.
 *
 * Providers mockés — ce qui est vérifié ici est l'arbitrage du gate et
 * l'enchaînement appel SDK → rechargement de l'entité porteuse (sans lequel la
 * liste et la page de l'ampli resteraient sur l'ancien `costum.ampli`).
 */

let ampliConfig: unknown;
let hydrated: boolean;
let me: Record<string, unknown> | null;
let entity: Record<string, unknown> | null;
const refreshEntity = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: { ampli: ampliConfig } }) }));
vi.mock("@/hooks/useHydrated", () => ({ useHydrated: () => hydrated }));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me, entity, refreshEntity }) }));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/lib/toastUtils", () => ({ showSuccessToast: vi.fn(), showErrorToast: vi.fn() }));

const { useCanManageAmplis, useCreateAmpli, useRemoveAmpli } = await import("./useAmpliAdmin");

const PATH = { name: "step.name", address: "step.address" };
/** Clé ≠ slug, comme l'entrée de prod (`amplifiions` en base, `amplifions` en URL). */
const AMPLI = {
  key: "sinistre-2025",
  slug: "sinistre",
  name: "Sinistre",
  tags: [],
  path: PATH,
  coform: "6927e9f0db22da724360303c",
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useCanManageAmplis", () => {
  beforeEach(() => {
    ampliConfig = true;
    hydrated = true;
    me = { isSuperAdmin: () => false, isAdminPlatform: () => false };
    entity = { isAdmin: () => true };
  });

  it("ouvre la gestion à l'admin du porteur", () => {
    expect(renderHook(() => useCanManageAmplis()).result.current).toBe(true);
  });

  it("ouvre la gestion au super-admin de la plateforme", () => {
    entity = { isAdmin: () => false };
    me = { isSuperAdmin: () => true, isAdminPlatform: () => false };

    expect(renderHook(() => useCanManageAmplis()).result.current).toBe(true);
  });

  it("la ferme à qui n'est ni admin du porteur ni super-admin", () => {
    entity = { isAdmin: () => false };

    expect(renderHook(() => useCanManageAmplis()).result.current).toBe(false);
  });

  it("la ferme au visiteur anonyme", () => {
    me = null;
    entity = { isAdmin: () => false };

    expect(renderHook(() => useCanManageAmplis()).result.current).toBe(false);
  });

  // Amplis non activés : le site ne lit aucun costum, il n'y a rien à créer ni
  // à supprimer en base.
  it("la ferme quand les amplis ne sont pas activés, même pour un admin", () => {
    ampliConfig = undefined;

    expect(renderHook(() => useCanManageAmplis()).result.current).toBe(false);
  });

  // `me` et les liens de l'entité sont vides au SSR : les lire avant
  // l'hydratation ferait diverger le premier rendu client du HTML serveur.
  it("reste fermée tant que la page n'est pas hydratée", () => {
    hydrated = false;

    expect(renderHook(() => useCanManageAmplis()).result.current).toBe(false);
  });
});

describe("useCreateAmpli", () => {
  beforeEach(() => {
    refreshEntity.mockClear();
  });

  it("crée l'ampli puis recharge l'entité porteuse", async () => {
    const order: string[] = [];
    const created = { result: true, slug: "idees-d-ete", ampli: { name: "Idées d'été" } };
    const createAmpli = vi.fn(async () => {
      order.push("createAmpli");
      return created;
    });
    refreshEntity.mockImplementation(async () => {
      order.push("refreshEntity");
    });
    entity = { createAmpli };

    const { result } = renderHook(() => useCreateAmpli(), { wrapper });
    result.current.mutate({ name: "Idées d'été", description: "", tags: ["été"] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createAmpli).toHaveBeenCalledWith({
      name: "Idées d'été",
      description: "",
      tags: ["été"],
    });
    // Le rechargement APRÈS l'écriture : `costum` arrive avec l'entité, et la
    // redirection vers `/ampli/<slug>` suit le succès.
    expect(order).toEqual(["createAmpli", "refreshEntity"]);
    expect(result.current.data).toBe(created);
  });

  it("échoue sans entité porteuse, sans rien recharger", async () => {
    entity = null;

    const { result } = renderHook(() => useCreateAmpli(), { wrapper });
    result.current.mutate({ name: "Idées d'été" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(refreshEntity).not.toHaveBeenCalled();
  });
});

describe("useRemoveAmpli", () => {
  beforeEach(() => {
    refreshEntity.mockClear();
  });

  it("supprime par la CLÉ de l'entrée, pas par le slug d'URL", async () => {
    const removeAmpli = vi.fn().mockResolvedValue({ result: true, msg: "Ampli removed" });
    entity = { removeAmpli };

    const { result } = renderHook(() => useRemoveAmpli(), { wrapper });
    result.current.mutate(AMPLI);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Le backend indexe `costum.ampli` par clé : lui passer le slug répondrait
    // « Ampli not found » dès que les deux diffèrent.
    expect(removeAmpli).toHaveBeenCalledWith("sinistre-2025");
    expect(refreshEntity).toHaveBeenCalledTimes(1);
  });
});
