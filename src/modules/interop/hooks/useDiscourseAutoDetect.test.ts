// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────
const mockUseCocolight = vi.fn();
const mockUseInteropConfig = vi.fn();
const mockCheckDiscourseEmailMatch = vi.fn();
const mockAsInteropEntity = vi.fn(() => ({
  checkDiscourseEmailMatch: mockCheckDiscourseEmailMatch,
}));

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => mockUseCocolight(),
}));
vi.mock("./useInteropConfigQuery", () => ({
  useInteropConfig: () => mockUseInteropConfig(),
}));
vi.mock("./_interopEntity", () => ({
  asInteropEntity: (e: unknown) => mockAsInteropEntity(e),
}));

import { useDiscourseAutoDetect } from "./useDiscourseAutoDetect";

function setup({
  me,
  entity,
  costumSlug = "test-costum",
  hasDiscourse = true,
  interopDiscourse,
}: {
  me?: { serverData?: { interop?: Record<string, Record<string, string | false>> } } | null;
  entity?: { id: string } | null;
  costumSlug?: string | null;
  hasDiscourse?: boolean;
  interopDiscourse?: string | false | undefined;
}) {
  // Si me est explicitement null, on respecte ; sinon on construit un me par défaut
  let meValue: unknown;
  if (me === null) {
    meValue = null;
  } else if (me !== undefined) {
    meValue = me;
  } else if (interopDiscourse !== undefined) {
    meValue = { serverData: { interop: { discourse: { [costumSlug || "x"]: interopDiscourse } } } };
  } else {
    meValue = { serverData: {} };
  }
  mockUseCocolight.mockReturnValue({ me: meValue, entity });
  mockUseInteropConfig.mockReturnValue({ costumSlug, hasDiscourse });
}

describe("useDiscourseAutoDetect", () => {
  beforeEach(() => {
    mockUseCocolight.mockReset();
    mockUseInteropConfig.mockReset();
    mockCheckDiscourseEmailMatch.mockReset();
    mockAsInteropEntity.mockClear();
  });

  describe("conditions de déclenchement", () => {
    it("ne déclenche PAS si me est null", async () => {
      setup({ me: null, entity: { id: "e1" } });
      const { result } = renderHook(() => useDiscourseAutoDetect());
      await Promise.resolve();
      expect(mockCheckDiscourseEmailMatch).not.toHaveBeenCalled();
      expect(result.current.open).toBe(false);
      expect(result.current.autoUser).toBeNull();
    });

    it("ne déclenche PAS si entity est null", async () => {
      setup({ entity: null });
      renderHook(() => useDiscourseAutoDetect());
      await Promise.resolve();
      expect(mockCheckDiscourseEmailMatch).not.toHaveBeenCalled();
    });

    it("ne déclenche PAS si hasDiscourse=false", async () => {
      setup({ entity: { id: "e1" }, hasDiscourse: false });
      renderHook(() => useDiscourseAutoDetect());
      await Promise.resolve();
      expect(mockCheckDiscourseEmailMatch).not.toHaveBeenCalled();
    });

    it("ne déclenche PAS si déjà lié (discourseVal = string)", async () => {
      setup({
        entity: { id: "e1" },
        interopDiscourse: "username-link",
      });
      renderHook(() => useDiscourseAutoDetect());
      await Promise.resolve();
      expect(mockCheckDiscourseEmailMatch).not.toHaveBeenCalled();
    });

    it("ne déclenche PAS si dismiss explicite (discourseVal = false)", async () => {
      setup({
        entity: { id: "e1" },
        interopDiscourse: false,
      });
      renderHook(() => useDiscourseAutoDetect());
      await Promise.resolve();
      expect(mockCheckDiscourseEmailMatch).not.toHaveBeenCalled();
    });

    it("déclenche checkDiscourseEmailMatch quand toutes conditions OK", async () => {
      mockCheckDiscourseEmailMatch.mockResolvedValue({ found: false });
      setup({
        entity: { id: "e1" },
        me: { serverData: {} },
      });
      renderHook(() => useDiscourseAutoDetect());
      await waitFor(() => {
        expect(mockCheckDiscourseEmailMatch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("résultat de checkDiscourseEmailMatch", () => {
    it("found=true + user → autoUser défini + open=true", async () => {
      const user = { username: "alice", name: "Alice", avatar_template: "/x.png" };
      mockCheckDiscourseEmailMatch.mockResolvedValue({ found: true, user });
      setup({ entity: { id: "e1" }, me: { serverData: {} } });
      const { result } = renderHook(() => useDiscourseAutoDetect());
      await waitFor(() => {
        expect(result.current.autoUser).toEqual(user);
        expect(result.current.open).toBe(true);
      });
    });

    it("found=false → autoUser reste null", async () => {
      mockCheckDiscourseEmailMatch.mockResolvedValue({ found: false });
      setup({ entity: { id: "e1" }, me: { serverData: {} } });
      const { result } = renderHook(() => useDiscourseAutoDetect());
      await waitFor(() => {
        expect(mockCheckDiscourseEmailMatch).toHaveBeenCalled();
      });
      // attendre que la microtask soit drainée
      await Promise.resolve();
      expect(result.current.autoUser).toBeNull();
      expect(result.current.open).toBe(false);
    });

    it("found=true sans user → ne déclenche pas open", async () => {
      mockCheckDiscourseEmailMatch.mockResolvedValue({ found: true });
      setup({ entity: { id: "e1" }, me: { serverData: {} } });
      const { result } = renderHook(() => useDiscourseAutoDetect());
      await waitFor(() => {
        expect(mockCheckDiscourseEmailMatch).toHaveBeenCalled();
      });
      await Promise.resolve();
      expect(result.current.open).toBe(false);
      expect(result.current.autoUser).toBeNull();
    });

    it("API throw → swallowed silencieusement, pas de crash", async () => {
      mockCheckDiscourseEmailMatch.mockRejectedValue(new Error("boom"));
      setup({ entity: { id: "e1" }, me: { serverData: {} } });
      const { result } = renderHook(() => useDiscourseAutoDetect());
      await waitFor(() => {
        expect(mockCheckDiscourseEmailMatch).toHaveBeenCalled();
      });
      await Promise.resolve();
      expect(result.current.autoUser).toBeNull();
      expect(result.current.open).toBe(false);
    });
  });

  describe("setOpen", () => {
    it("setOpen permet de fermer le dialog", async () => {
      mockCheckDiscourseEmailMatch.mockResolvedValue({
        found: true,
        user: { username: "u" },
      });
      setup({ entity: { id: "e1" }, me: { serverData: {} } });
      const { result } = renderHook(() => useDiscourseAutoDetect());
      await waitFor(() => {
        expect(result.current.open).toBe(true);
      });
      act(() => {
        result.current.setOpen(false);
      });
      expect(result.current.open).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("ne setState pas si unmount avant résolution promesse", async () => {
      let resolveFn: ((v: { found: boolean; user?: unknown }) => void) | null = null;
      mockCheckDiscourseEmailMatch.mockImplementation(
        () => new Promise((r) => { resolveFn = r; })
      );
      setup({ entity: { id: "e1" }, me: { serverData: {} } });
      const { result, unmount } = renderHook(() => useDiscourseAutoDetect());
      // unmount avant que la promesse ne se résolve
      unmount();
      // résoudre maintenant ne doit pas crasher
      act(() => {
        resolveFn?.({ found: true, user: { username: "ghost" } });
      });
      await Promise.resolve();
      // result.current pointe sur l'ancienne référence — non updatée
      expect(result.current.autoUser).toBeNull();
    });
  });
});
