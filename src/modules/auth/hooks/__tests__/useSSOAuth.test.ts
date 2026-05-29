// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────
const mockSetToken = vi.fn();
const mockSetRefreshToken = vi.fn();
const mockEmit = vi.fn();
const mockApiClient = {
  setToken: mockSetToken,
  setRefreshToken: mockSetRefreshToken,
  emit: mockEmit,
};

const mockUseCocolight = vi.fn();
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => mockUseCocolight(),
}));

vi.mock("@/lib/constant/common", async () => {
  const actual = await vi.importActual<typeof import("@/lib/constant/common")>(
    "@/lib/constant/common"
  );
  return { ...actual, getBaseUrl: () => "https://backend.example.com" };
});

import { useSSOAuth } from "../useSSOAuth";

// ─── helpers ────────────────────────────────────────────────────────────────
type PopupHandle = {
  closed: boolean;
  close: () => void;
};

function setupPopup(): PopupHandle {
  const popup: PopupHandle = {
    closed: false,
    close() {
      popup.closed = true;
    },
  };
  vi.stubGlobal("open", vi.fn(() => popup));
  return popup;
}

describe("useSSOAuth", () => {
  beforeEach(() => {
    mockSetToken.mockReset();
    mockSetRefreshToken.mockReset();
    mockEmit.mockReset();
    mockUseCocolight.mockReturnValue({ apiClient: mockApiClient });
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("API exposée", () => {
    it("expose une fonction openSSOPopup", () => {
      const { result } = renderHook(() => useSSOAuth());
      expect(typeof result.current.openSSOPopup).toBe("function");
    });
  });

  describe("popup", () => {
    it("ouvre une popup vers le bon URL backend avec le service", () => {
      setupPopup();
      const { result } = renderHook(() => useSSOAuth());
      void result.current.openSSOPopup("google");
      const openCall = (window.open as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(openCall[0]).toContain("https://backend.example.com/co2/sso/services");
      expect(openCall[0]).toContain("authclient=google");
      expect(openCall[0]).toContain("origin=");
      expect(openCall[1]).toBe("sso-login");
    });

    it("encode le service dans l'URL", () => {
      setupPopup();
      const { result } = renderHook(() => useSSOAuth());
      void result.current.openSSOPopup("provider/with space");
      const openCall = (window.open as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(openCall[0]).toContain("authclient=provider%2Fwith%20space");
    });

    it("retourne { success:false } si popup bloqué", async () => {
      vi.stubGlobal("open", vi.fn(() => null));
      const { result } = renderHook(() => useSSOAuth());
      const promise = result.current.openSSOPopup("google");
      vi.useRealTimers(); // promesse resolved immédiatement
      const r = await promise;
      expect(r.success).toBe(false);
      expect(r.error).toBe("Popup bloqué par le navigateur");
    });
  });

  describe("postMessage — sécurité origin", () => {
    it("REJETTE les messages d'une origine différente du backend", async () => {
      const popup = setupPopup();
      const { result } = renderHook(() => useSSOAuth());

      const resolved: { current: { success: boolean; error?: string } | null } = { current: null };
      void result.current.openSSOPopup("google").then((r) => {
        resolved.current = r;
      });

      // message d'origine MALICIEUSE
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://attacker.example.com",
            data: { type: "SSO_AUTH_SUCCESS", accessToken: "stolen-token" },
          })
        );
      });

      // les tokens ne doivent PAS être injectés
      expect(mockSetToken).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
      expect(resolved.current).toBeNull();

      // cleanup : fermer le popup pour terminer la promesse
      act(() => {
        popup.close();
        vi.advanceTimersByTime(500);
      });
    });

    it("ACCEPTE les messages venant du backend (origin matched)", async () => {
      setupPopup();
      const { result } = renderHook(() => useSSOAuth());

      const resolved: { current: { success: boolean } | null } = { current: null };
      void result.current.openSSOPopup("google").then((r) => {
        resolved.current = r as { success: boolean };
      });

      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://backend.example.com",
            data: {
              type: "SSO_AUTH_SUCCESS",
              accessToken: "valid-token",
              refreshToken: "refresh-token",
            },
          })
        );
      });
      // flush microtasks
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved.current?.success).toBe(true);
      expect(mockSetToken).toHaveBeenCalledWith("valid-token");
      expect(mockSetRefreshToken).toHaveBeenCalledWith("refresh-token");
      expect(mockEmit).toHaveBeenCalledWith("userLoggedIn");
    });
  });

  describe("postMessage — payload", () => {
    it("n'injecte pas de tokens si accessToken absent", async () => {
      setupPopup();
      const { result } = renderHook(() => useSSOAuth());

      const resolved: { current: { success: boolean } | null } = { current: null };
      void result.current.openSSOPopup("google").then((r) => {
        resolved.current = r as { success: boolean };
      });

      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://backend.example.com",
            data: { type: "SSO_AUTH_SUCCESS" }, // pas de tokens
          })
        );
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(mockSetToken).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
      // mais success quand même (le backend a dit success, le client n'a pas
      // de tokens à injecter)
      expect(resolved.current?.success).toBe(true);
    });

    it("setRefreshToken seulement si fourni", async () => {
      setupPopup();
      const { result } = renderHook(() => useSSOAuth());

      void result.current.openSSOPopup("google");

      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://backend.example.com",
            data: { type: "SSO_AUTH_SUCCESS", accessToken: "tk" },
          })
        );
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(mockSetToken).toHaveBeenCalledWith("tk");
      expect(mockSetRefreshToken).not.toHaveBeenCalled();
    });

    it("SSO_AUTH_ERROR remonte l'erreur", async () => {
      setupPopup();
      const { result } = renderHook(() => useSSOAuth());

      const resolved: { current: { success: boolean; error?: string } | null } = { current: null };
      void result.current.openSSOPopup("google").then((r) => {
        resolved.current = r;
      });

      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://backend.example.com",
            data: { type: "SSO_AUTH_ERROR", error: "Access denied" },
          })
        );
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved.current?.success).toBe(false);
      expect(resolved.current?.error).toBe("Access denied");
      expect(mockSetToken).not.toHaveBeenCalled();
    });

    it("type postMessage inconnu = ignoré (popup reste ouverte)", async () => {
      const popup = setupPopup();
      const { result } = renderHook(() => useSSOAuth());

      const resolved: { current: unknown } = { current: null };
      void result.current.openSSOPopup("google").then((r) => {
        resolved.current = r;
      });

      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://backend.example.com",
            data: { type: "SOMETHING_ELSE", token: "x" },
          })
        );
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved.current).toBeNull();
      expect(mockSetToken).not.toHaveBeenCalled();

      // cleanup via fermeture popup
      act(() => {
        popup.close();
        vi.advanceTimersByTime(500);
      });
    });
  });

  describe("fermeture popup manuelle", () => {
    it("détecte la fermeture du popup et resolve { success:false }", async () => {
      const popup = setupPopup();
      const { result } = renderHook(() => useSSOAuth());

      const resolved: { current: { success: boolean; error?: string } | null } = { current: null };
      void result.current.openSSOPopup("google").then((r) => {
        resolved.current = r;
      });

      act(() => {
        popup.close();
        vi.advanceTimersByTime(500);
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved.current?.success).toBe(false);
      expect(resolved.current?.error).toBeUndefined();
    });
  });

  describe("apiClient null", () => {
    it("n'appelle pas setToken/emit si apiClient absent", async () => {
      setupPopup();
      mockUseCocolight.mockReturnValue({ apiClient: null });
      const { result } = renderHook(() => useSSOAuth());

      const resolved: { current: { success: boolean } | null } = { current: null };
      void result.current.openSSOPopup("google").then((r) => {
        resolved.current = r as { success: boolean };
      });

      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://backend.example.com",
            data: { type: "SSO_AUTH_SUCCESS", accessToken: "x" },
          })
        );
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(mockSetToken).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
      expect(resolved.current?.success).toBe(true);
    });
  });

  describe("cleanup au démontage", () => {
    it("appelle cleanup si unmount avant résolution", () => {
      const popup = setupPopup();
      const { result, unmount } = renderHook(() => useSSOAuth());
      void result.current.openSSOPopup("google");
      // unmount alors que la popup est encore "ouverte"
      unmount();
      // après cleanup, dispatcher un message ne doit pas crash ni injecter tokens
      expect(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://backend.example.com",
            data: { type: "SSO_AUTH_SUCCESS", accessToken: "x" },
          })
        );
        popup.close();
        vi.advanceTimersByTime(500);
      }).not.toThrow();
      expect(mockSetToken).not.toHaveBeenCalled();
    });
  });
});
