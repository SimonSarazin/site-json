// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { RouteObject } from "react-router";
import {
  discoverModules,
  getModuleRoutes,
  getModuleRoutesSync,
  getPageProviders,
  type DiscoveredModule,
  type ModulePageProvider,
} from "../modules";

/**
 * Tests des helpers `modules`.
 *
 * `discoverModules` repose sur `import.meta.glob` — on n'essaie pas de mocker
 * Vite ici, on fait un test d'intégration léger : on vérifie juste que la
 * fonction est callable et renvoie un array typé. Les autres helpers sont
 * testés avec des modules factices.
 */

// ── discoverModules : test d'intégration léger ──
describe("discoverModules", () => {
  it("retourne un array de modules typés", () => {
    const modules = discoverModules();
    expect(Array.isArray(modules)).toBe(true);
    for (const m of modules) {
      expect(m).toHaveProperty("config");
      expect(m).toHaveProperty("routes");
      expect(["core", "optional"]).toContain(m.config.type);
      expect(typeof m.config.name).toBe("string");
    }
  });

  it("retourne au moins le module 'profil' (présent dans le repo)", () => {
    const modules = discoverModules();
    const names = modules.map((m) => m.config.name);
    expect(names).toContain("profil");
  });

  it("aucun module avec enabled: false n'est inclus", () => {
    const modules = discoverModules();
    for (const m of modules) {
      // `enabled` est optionnel — undefined ou true sont OK
      expect(m.config.enabled).not.toBe(false);
    }
  });
});

// ── Helpers ──
function makeCoreModule(
  name: string,
  routes: ((qc?: unknown, cfg?: unknown) => RouteObject[]) | null = null,
  PageProvider?: ModulePageProvider
): DiscoveredModule {
  return {
    config: { name, type: "core", PageProvider },
    routes,
  } as DiscoveredModule;
}

function makeOptionalModule(
  name: string,
  routesLoader: (() => Promise<{ routes: (qc?: unknown, cfg?: unknown) => RouteObject[] }>) | null
): DiscoveredModule {
  return {
    config: { name, type: "optional" },
    routes: routesLoader,
  } as DiscoveredModule;
}

// ── getModuleRoutesSync ──
describe("getModuleRoutesSync", () => {
  it("retourne un array vide si aucun module", () => {
    expect(getModuleRoutesSync([])).toEqual([]);
  });

  it("appelle routes() pour chaque module core", () => {
    const r1 = vi.fn(() => [{ path: "a" }] as RouteObject[]);
    const r2 = vi.fn(() => [{ path: "b" }] as RouteObject[]);
    const result = getModuleRoutesSync([
      makeCoreModule("m1", r1),
      makeCoreModule("m2", r2),
    ]);
    expect(r1).toHaveBeenCalled();
    expect(r2).toHaveBeenCalled();
    expect(result).toEqual([{ path: "a" }, { path: "b" }]);
  });

  it("skip les modules core sans routes (routes === null)", () => {
    const r = vi.fn(() => [{ path: "a" }] as RouteObject[]);
    const result = getModuleRoutesSync([
      makeCoreModule("withoutRoutes", null),
      makeCoreModule("withRoutes", r),
    ]);
    expect(result).toEqual([{ path: "a" }]);
  });

  it("throw si un module optional est passé", () => {
    expect(() =>
      getModuleRoutesSync([makeOptionalModule("lazy", () => Promise.resolve({ routes: () => [] }))])
    ).toThrow(/optional/i);
  });

  it("passe queryClient et config aux factories", () => {
    const factory = vi.fn(() => [] as RouteObject[]);
    const qc = { _qc: true } as unknown as Parameters<typeof getModuleRoutesSync>[1];
    const cfg = { _cfg: true } as unknown as Parameters<typeof getModuleRoutesSync>[2];
    getModuleRoutesSync([makeCoreModule("m", factory)], qc, cfg);
    expect(factory).toHaveBeenCalledWith(qc, cfg);
  });
});

// ── getModuleRoutes (async) ──
describe("getModuleRoutes", () => {
  it("retourne un array vide si aucun module", async () => {
    expect(await getModuleRoutes([])).toEqual([]);
  });

  it("inclut les routes des modules core et optional", async () => {
    const optionalRoute = { path: "lazy" } as RouteObject;
    const optionalLoader = vi.fn(() =>
      Promise.resolve({ routes: () => [optionalRoute] })
    );
    const result = await getModuleRoutes([
      makeCoreModule("core", () => [{ path: "core" }] as RouteObject[]),
      makeOptionalModule("optional", optionalLoader),
    ]);
    expect(result.some((r) => r.path === "core")).toBe(true);
    expect(result.some((r) => r.path === "lazy")).toBe(true);
    expect(optionalLoader).toHaveBeenCalled();
  });

  it("skip les modules core sans routes", async () => {
    const result = await getModuleRoutes([
      makeCoreModule("no-routes", null),
      makeCoreModule("with-routes", () => [{ path: "yes" }] as RouteObject[]),
    ]);
    expect(result).toEqual([{ path: "yes" }]);
  });

  it("skip les modules optional sans routes", async () => {
    const result = await getModuleRoutes([
      makeOptionalModule("no-routes", null),
      makeCoreModule("core", () => [{ path: "core" }] as RouteObject[]),
    ]);
    expect(result).toEqual([{ path: "core" }]);
  });

  it("attend la résolution du loader optional avant de retourner", async () => {
    let resolved = false;
    const loader = () =>
      new Promise<{ routes: (qc?: unknown, cfg?: unknown) => RouteObject[] }>((resolve) => {
        setTimeout(() => {
          resolved = true;
          resolve({ routes: () => [{ path: "deferred" } as RouteObject] });
        }, 10);
      });
    const result = await getModuleRoutes([makeOptionalModule("slow", loader)]);
    expect(resolved).toBe(true);
    expect(result).toEqual([{ path: "deferred" }]);
  });
});

// ── getPageProviders ──
describe("getPageProviders", () => {
  it("retourne un array vide si aucun PageProvider", () => {
    expect(getPageProviders([])).toEqual([]);
    expect(getPageProviders([makeCoreModule("m", null)])).toEqual([]);
  });

  it("collecte les PageProvider déclarés dans module.config.PageProvider", () => {
    const Provider1: ModulePageProvider = () => null;
    const Provider2: ModulePageProvider = () => null;
    const result = getPageProviders([
      makeCoreModule("m1", null, Provider1),
      makeCoreModule("m2", null),
      makeCoreModule("m3", null, Provider2),
    ]);
    expect(result).toEqual([Provider1, Provider2]);
  });

  it("filtre les modules sans PageProvider", () => {
    const Provider: ModulePageProvider = () => null;
    const result = getPageProviders([
      makeCoreModule("withoutProvider", null),
      makeCoreModule("withProvider", null, Provider),
    ]);
    expect(result).toEqual([Provider]);
  });
});
