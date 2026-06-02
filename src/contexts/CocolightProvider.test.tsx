// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useContext, type PropsWithChildren } from "react";

// ─── Mocks ──────────────────────────────────────────────────────────────────
// Mock du SDK Cocolight — on ne charge pas le vrai package.
// vi.hoisted permet de partager des refs entre la factory hoistée et le test.
const hoisted = vi.hoisted(() => ({
  mockApiCtor: (() => {
    const fn = (...args: unknown[]) => { void args; };
    return Object.assign(fn, { calls: [] as unknown[][] });
  })(),
  mockHelper: { ping: () => undefined },
}));

vi.mock("@communecter/cocolight-api-client", () => {
  class Api {
    me: (...args: unknown[]) => unknown = () => undefined;
    entitySlug: (...args: unknown[]) => unknown = () => undefined;
    constructor(user: unknown, client: unknown) {
      hoisted.mockApiCtor(user, client);
      Object.assign(this, { __user: user, __client: client });
    }
  }
  return {
    default: { Api, helper: hoisted.mockHelper },
    Api,
  };
});

// Event emitter minimal
function makeEmitter() {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    on: vi.fn((evt: string, fn: (...args: unknown[]) => void) => {
      (handlers[evt] = handlers[evt] || []).push(fn);
    }),
    off: vi.fn((evt: string, fn: (...args: unknown[]) => void) => {
      handlers[evt] = (handlers[evt] || []).filter((h) => h !== fn);
    }),
    emit: (evt: string, ...args: unknown[]) => {
      (handlers[evt] || []).forEach((h) => h(...args));
    },
    _handlers: handlers,
  };
}

// Hooks à mocker
const mockInitData = vi.fn();
vi.mock("@/hooks/useCocolightInit", () => ({
  useCocolightInit: () => mockInitData(),
}));

vi.mock("@/lib/constant/common", async () => {
  const actual = await vi.importActual<typeof import("@/lib/constant/common")>(
    "@/lib/constant/common"
  );
  return { ...actual, getSlug: () => "test-slug" };
});

import { CocolightProvider } from "./CocolightProvider";
import { CocolightContext } from "./CocolightContext";

function useCtx() {
  const ctx = useContext(CocolightContext);
  if (!ctx) throw new Error("CocolightContext not provided");
  return ctx;
}

describe("CocolightProvider", () => {
  beforeEach(() => {
    mockInitData.mockReset();
  });

  function defaultInitData(overrides: Record<string, unknown> = {}) {
    const emitter = makeEmitter();
    const client = Object.assign({ baseURL: "http://test" }, emitter);
    const userApiInstance = { client };
    const initialApi = { me: vi.fn(), entitySlug: vi.fn() };
    return {
      emitter,
      data: {
        client,
        userApiInstance,
        api: initialApi,
        me: { id: "u1", username: "alice", serverData: {} },
        contextType: "organizations",
        contextId: "org1",
        entity: { id: "e1", serverData: { slug: "test-slug" } },
        ...overrides,
      },
    };
  }

  describe("initial render", () => {
    it("expose le contextValue depuis useCocolightInit", () => {
      const { data } = defaultInitData();
      mockInitData.mockReturnValue(data);

      const wrapper = ({ children }: PropsWithChildren) => (
        <CocolightProvider>{children}</CocolightProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });

      expect(result.current.me).toEqual(data.me);
      expect(result.current.entity).toEqual(data.entity);
      expect(result.current.contextType).toBe("organizations");
      expect(result.current.contextId).toBe("org1");
      expect(result.current.api).toBe(data.api);
      expect(result.current.apiClient).toBe(data.client);
      expect(result.current.userApi).toBe(data.userApiInstance);
      expect(result.current.helper).toBe(hoisted.mockHelper);
      expect(result.current.loading).toBe(false);
      expect(result.current.dataToProfile).toBeNull();
    });

    it("accepte un me null (utilisateur anonyme)", () => {
      const { data } = defaultInitData({ me: null });
      mockInitData.mockReturnValue(data);

      const wrapper = ({ children }: PropsWithChildren) => (
        <CocolightProvider>{children}</CocolightProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });

      expect(result.current.me).toBeNull();
    });

    it("expose setDataToProfile fonctionnel", () => {
      const { data } = defaultInitData();
      mockInitData.mockReturnValue(data);

      const wrapper = ({ children }: PropsWithChildren) => (
        <CocolightProvider>{children}</CocolightProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });

      expect(result.current.dataToProfile).toBeNull();
      act(() => {
        result.current.setDataToProfile({ foo: "bar" });
      });
      expect(result.current.dataToProfile).toEqual({ foo: "bar" });
    });
  });

  describe("event listeners", () => {
    it("attache 'userLoggedIn' et 'sessionReset' au client", () => {
      const { emitter, data } = defaultInitData();
      mockInitData.mockReturnValue(data);

      const wrapper = ({ children }: PropsWithChildren) => (
        <CocolightProvider>{children}</CocolightProvider>
      );
      renderHook(() => useCtx(), { wrapper });

      expect(emitter.on).toHaveBeenCalledWith("userLoggedIn", expect.any(Function));
      expect(emitter.on).toHaveBeenCalledWith("sessionReset", expect.any(Function));
    });

    it("détache les listeners au démontage", () => {
      const { emitter, data } = defaultInitData();
      mockInitData.mockReturnValue(data);

      const wrapper = ({ children }: PropsWithChildren) => (
        <CocolightProvider>{children}</CocolightProvider>
      );
      const { unmount } = renderHook(() => useCtx(), { wrapper });

      expect(emitter.off).not.toHaveBeenCalled();
      unmount();
      expect(emitter.off).toHaveBeenCalledWith("userLoggedIn", expect.any(Function));
      expect(emitter.off).toHaveBeenCalledWith("sessionReset", expect.any(Function));
    });
  });

  describe("sessionReset event", () => {
    it("met me à null après émission de sessionReset", async () => {
      const { emitter, data } = defaultInitData();
      mockInitData.mockReturnValue(data);

      const wrapper = ({ children }: PropsWithChildren) => (
        <CocolightProvider>{children}</CocolightProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });

      expect(result.current.me).toEqual(data.me);

      // déclencher l'événement sessionReset
      await act(async () => {
        emitter.emit("sessionReset");
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.me).toBeNull();
      });
    });
  });

  describe("refreshMe", () => {
    it("appelle api.me() et update me", async () => {
      const { data } = defaultInitData();
      const freshMe = { id: "u1", username: "alice-updated", serverData: {} };
      data.api.me = vi.fn().mockResolvedValue(freshMe);
      mockInitData.mockReturnValue(data);

      const wrapper = ({ children }: PropsWithChildren) => (
        <CocolightProvider>{children}</CocolightProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });

      await act(async () => {
        await result.current.refreshMe();
      });

      expect(data.api.me).toHaveBeenCalledTimes(1);
      expect(result.current.me).toEqual(freshMe);
    });

    it("no-op si api est null", async () => {
      const { data } = defaultInitData({ api: null });
      mockInitData.mockReturnValue(data);

      const wrapper = ({ children }: PropsWithChildren) => (
        <CocolightProvider>{children}</CocolightProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });

      // ne doit pas throw
      await act(async () => {
        await result.current.refreshMe();
      });
      expect(result.current.me).toEqual(data.me);
    });

    it("swallow l'erreur si api.me() rejette", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { data } = defaultInitData();
      data.api.me = vi.fn().mockRejectedValue(new Error("network"));
      mockInitData.mockReturnValue(data);

      const wrapper = ({ children }: PropsWithChildren) => (
        <CocolightProvider>{children}</CocolightProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });

      await act(async () => {
        await result.current.refreshMe();
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("refreshMe failed"),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("hors Provider", () => {
    it("CocolightContext vaut null par défaut", () => {
      const { result } = renderHook(() => useContext(CocolightContext));
      expect(result.current).toBeNull();
    });
  });
});
