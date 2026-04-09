import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerPermissions,
  getCalculator,
  getAllCalculators,
  hasCalculator,
  _resetForTesting,
} from "../permissions/registry";
import type { PermissionCalculator, PermissionContext } from "../permissions/types";

describe("permissions registry", () => {
  beforeEach(() => {
    _resetForTesting();
  });

  // ── registerPermissions + getCalculator ──
  describe("registerPermissions", () => {
    it("registers and retrieves a calculator", () => {
      const calc: PermissionCalculator<{ canEdit: boolean }> = {
        namespace: "profil",
        calculate: () => ({ canEdit: true }),
      };

      registerPermissions(calc);
      const retrieved = getCalculator("profil");

      expect(retrieved).toBeDefined();
      expect(retrieved!.namespace).toBe("profil");
      expect(retrieved!.calculate({} as PermissionContext)).toEqual({ canEdit: true });
    });

    it("warns and overwrites when registering same namespace twice", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const calc1: PermissionCalculator = {
        namespace: "news",
        calculate: () => ({ canCreate: false }),
      };
      const calc2: PermissionCalculator = {
        namespace: "news",
        calculate: () => ({ canCreate: true }),
      };

      registerPermissions(calc1);
      registerPermissions(calc2);

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toContain("news");
      expect(warnSpy.mock.calls[0][0]).toContain("overwriting");

      const retrieved = getCalculator("news");
      expect(retrieved!.calculate({} as PermissionContext)).toEqual({ canCreate: true });

      warnSpy.mockRestore();
    });

    it("registers multiple namespaces independently", () => {
      registerPermissions({ namespace: "profil", calculate: () => ({}) });
      registerPermissions({ namespace: "news", calculate: () => ({}) });
      registerPermissions({ namespace: "search", calculate: () => ({}) });

      expect(getAllCalculators().size).toBe(3);
    });
  });

  // ── getCalculator ──
  describe("getCalculator", () => {
    it("returns undefined for unknown namespace", () => {
      expect(getCalculator("nonexistent")).toBeUndefined();
    });
  });

  // ── hasCalculator ──
  describe("hasCalculator", () => {
    it("returns false before registration", () => {
      expect(hasCalculator("profil")).toBe(false);
    });

    it("returns true after registration", () => {
      registerPermissions({ namespace: "profil", calculate: () => ({}) });
      expect(hasCalculator("profil")).toBe(true);
    });
  });

  // ── getAllCalculators ──
  describe("getAllCalculators", () => {
    it("returns empty map when nothing registered", () => {
      expect(getAllCalculators().size).toBe(0);
    });

    it("returns all registered calculators", () => {
      registerPermissions({ namespace: "a", calculate: () => ({}) });
      registerPermissions({ namespace: "b", calculate: () => ({}) });

      const all = getAllCalculators();
      expect(all.size).toBe(2);
      expect(all.has("a")).toBe(true);
      expect(all.has("b")).toBe(true);
    });
  });

  // ── _resetForTesting ──
  describe("_resetForTesting", () => {
    it("clears all registered calculators", () => {
      registerPermissions({ namespace: "profil", calculate: () => ({}) });
      expect(hasCalculator("profil")).toBe(true);

      _resetForTesting();
      expect(hasCalculator("profil")).toBe(false);
      expect(getAllCalculators().size).toBe(0);
    });
  });

  // ── calculate function receives context ──
  describe("calculate", () => {
    it("passes context to the calculator function", () => {
      const calculateFn = vi.fn().mockReturnValue({ canEdit: true });
      registerPermissions({ namespace: "profil", calculate: calculateFn });

      const ctx: PermissionContext = {
        entity: null,
        me: null,
        data: { extra: "value" },
      };

      const calc = getCalculator("profil")!;
      const result = calc.calculate(ctx);

      expect(calculateFn).toHaveBeenCalledWith(ctx);
      expect(result).toEqual({ canEdit: true });
    });
  });
});
