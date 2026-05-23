// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { VisibilityConditionSchema, type VisibilityCondition } from "../visibility/schema";

/**
 * Tests de visibility :
 *  1. Schema Zod : accepte/refuse les valeurs valides/invalides.
 *  2. Hook useVisibility : conditions auth / routes / excludeRoutes / permissions.
 *
 * Le hook dépend de useCocolight, useHydrated, useUserPermissions, useLocation.
 * On les mock via vi.mock pour les rendre déterministes.
 */

// ── Mocks (hoistés) ──
const { mockMe, mockHydrated, mockPathname, mockPermissions } = vi.hoisted(() => ({
  mockMe: { current: null as { id?: string } | null },
  mockHydrated: { current: true },
  mockPathname: { current: "/" },
  mockPermissions: { current: {} as Record<string, boolean> },
}));

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ me: mockMe.current }),
}));
vi.mock("@/hooks/useHydrated", () => ({
  useHydrated: () => mockHydrated.current,
}));
vi.mock("@/hooks/useUserPermissions", () => ({
  useUserPermissions: () => mockPermissions.current,
}));
vi.mock("react-router", () => ({
  useLocation: () => ({ pathname: mockPathname.current }),
}));

import { useVisibility } from "../visibility/useVisibility";

beforeEach(() => {
  mockMe.current = null;
  mockHydrated.current = true;
  mockPathname.current = "/";
  mockPermissions.current = {};
});

describe("VisibilityConditionSchema", () => {
  it("accepte une condition vide (undefined)", () => {
    expect(VisibilityConditionSchema.parse(undefined)).toBeUndefined();
  });

  it("accepte auth: required | anonymous | any", () => {
    expect(VisibilityConditionSchema.parse({ auth: "required" })).toEqual({ auth: "required" });
    expect(VisibilityConditionSchema.parse({ auth: "anonymous" })).toEqual({ auth: "anonymous" });
    expect(VisibilityConditionSchema.parse({ auth: "any" })).toEqual({ auth: "any" });
  });

  it("refuse une valeur d'auth invalide", () => {
    expect(() => VisibilityConditionSchema.parse({ auth: "always" })).toThrow();
  });

  it("accepte routes et excludeRoutes comme arrays de strings", () => {
    const parsed = VisibilityConditionSchema.parse({
      routes: ["/profil/*"],
      excludeRoutes: ["/admin"],
    });
    expect(parsed?.routes).toEqual(["/profil/*"]);
    expect(parsed?.excludeRoutes).toEqual(["/admin"]);
  });

  it("accepte permissions comme array de strings", () => {
    const parsed = VisibilityConditionSchema.parse({
      permissions: ["canAddOrganization"],
    });
    expect(parsed?.permissions).toEqual(["canAddOrganization"]);
  });

  it("refuse routes non-array", () => {
    expect(() => VisibilityConditionSchema.parse({ routes: "/foo" })).toThrow();
  });
});

describe("useVisibility", () => {
  describe("sans condition", () => {
    it("retourne true (visible pour tous) si pas de condition", () => {
      const { result } = renderHook(() => useVisibility(undefined));
      expect(result.current).toBe(true);
    });
  });

  describe("auth: required", () => {
    it("visible si user connecté", () => {
      mockMe.current = { id: "u1" };
      const { result } = renderHook(() => useVisibility({ auth: "required" }));
      expect(result.current).toBe(true);
    });

    it("caché si user déconnecté", () => {
      mockMe.current = null;
      const { result } = renderHook(() => useVisibility({ auth: "required" }));
      expect(result.current).toBe(false);
    });

    it("caché si user sans id", () => {
      mockMe.current = {};
      const { result } = renderHook(() => useVisibility({ auth: "required" }));
      expect(result.current).toBe(false);
    });

    it("caché pendant le SSR (hydrated=false) car dépend de l'auth", () => {
      mockMe.current = { id: "u1" };
      mockHydrated.current = false;
      const { result } = renderHook(() => useVisibility({ auth: "required" }));
      expect(result.current).toBe(false);
    });
  });

  describe("auth: anonymous", () => {
    it("caché si user connecté", () => {
      mockMe.current = { id: "u1" };
      const { result } = renderHook(() => useVisibility({ auth: "anonymous" }));
      expect(result.current).toBe(false);
    });

    it("visible si user déconnecté", () => {
      mockMe.current = null;
      const { result } = renderHook(() => useVisibility({ auth: "anonymous" }));
      expect(result.current).toBe(true);
    });
  });

  describe("auth: any", () => {
    it("visible peu importe l'état de l'utilisateur", () => {
      mockMe.current = null;
      const a = renderHook(() => useVisibility({ auth: "any" }));
      expect(a.result.current).toBe(true);
      mockMe.current = { id: "u1" };
      const b = renderHook(() => useVisibility({ auth: "any" }));
      expect(b.result.current).toBe(true);
    });
  });

  describe("routes", () => {
    it("visible si pathname match exactement", () => {
      mockPathname.current = "/profil";
      const { result } = renderHook(() => useVisibility({ routes: ["/profil"] }));
      expect(result.current).toBe(true);
    });

    it("caché si pathname ne match aucune route", () => {
      mockPathname.current = "/other";
      const { result } = renderHook(() => useVisibility({ routes: ["/profil"] }));
      expect(result.current).toBe(false);
    });

    it("supporte wildcard /profil/*", () => {
      mockPathname.current = "/profil/abc/news";
      const { result } = renderHook(() => useVisibility({ routes: ["/profil/*"] }));
      expect(result.current).toBe(true);
    });
  });

  describe("excludeRoutes", () => {
    it("caché si pathname matche une excludeRoute", () => {
      mockPathname.current = "/admin";
      const { result } = renderHook(() => useVisibility({ excludeRoutes: ["/admin"] }));
      expect(result.current).toBe(false);
    });

    it("visible si pathname ne matche aucune excludeRoute", () => {
      mockPathname.current = "/other";
      const { result } = renderHook(() => useVisibility({ excludeRoutes: ["/admin"] }));
      expect(result.current).toBe(true);
    });

    it("excludeRoutes prioritaire sur routes", () => {
      mockPathname.current = "/profil/admin";
      const { result } = renderHook(() =>
        useVisibility({
          routes: ["/profil/*"],
          excludeRoutes: ["/profil/admin"],
        })
      );
      expect(result.current).toBe(false);
    });
  });

  describe("permissions", () => {
    it("visible si toutes les permissions sont true", () => {
      mockPermissions.current = { canAddOrganization: true };
      const { result } = renderHook(() =>
        useVisibility({ permissions: ["canAddOrganization"] } as VisibilityCondition)
      );
      expect(result.current).toBe(true);
    });

    it("caché si une permission est false", () => {
      mockPermissions.current = { canAddOrganization: false };
      const { result } = renderHook(() =>
        useVisibility({ permissions: ["canAddOrganization"] } as VisibilityCondition)
      );
      expect(result.current).toBe(false);
    });

    it("caché pendant SSR si permissions présentes (dépend de user)", () => {
      mockPermissions.current = { canAddOrganization: true };
      mockHydrated.current = false;
      const { result } = renderHook(() =>
        useVisibility({ permissions: ["canAddOrganization"] } as VisibilityCondition)
      );
      expect(result.current).toBe(false);
    });
  });

  describe("combinaisons AND", () => {
    it("auth: required + permissions: tous doivent passer", () => {
      mockMe.current = { id: "u1" };
      mockPermissions.current = { canAddOrganization: true };
      const { result } = renderHook(() =>
        useVisibility({
          auth: "required",
          permissions: ["canAddOrganization"],
        } as VisibilityCondition)
      );
      expect(result.current).toBe(true);
    });

    it("auth: required + permissions: faux si une perm manque", () => {
      mockMe.current = { id: "u1" };
      mockPermissions.current = { canAddOrganization: false };
      const { result } = renderHook(() =>
        useVisibility({
          auth: "required",
          permissions: ["canAddOrganization"],
        } as VisibilityCondition)
      );
      expect(result.current).toBe(false);
    });
  });
});
