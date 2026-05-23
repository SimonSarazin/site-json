// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RouteObject } from "react-router";
import type { SiteConfig } from "@/types/site";

/**
 * Tests de buildRoutes — construit l'arborescence React Router à partir de
 * la config JSON + des modules découverts.
 *
 * On mock `./modules` et les composants React (SiteRenderer, RootLayout) +
 * les helpers du module search/prefetch pour ne pas dépendre de leur impl.
 */

// ── Mocks ──
const { mockDiscoverModules, mockGetModuleRoutesSync, mockGetModuleRoutes } = vi.hoisted(() => ({
  mockDiscoverModules: vi.fn(),
  mockGetModuleRoutesSync: vi.fn(),
  mockGetModuleRoutes: vi.fn(),
}));

vi.mock("../modules", () => ({
  discoverModules: mockDiscoverModules,
  getModuleRoutesSync: mockGetModuleRoutesSync,
  getModuleRoutes: mockGetModuleRoutes,
}));

vi.mock("@/components/SiteRenderer", () => ({
  SiteRenderer: () => null,
}));
vi.mock("@/RootLayout", () => ({
  default: () => null,
}));

vi.mock("@/modules/search/prefetch", () => ({
  prefetchSearchResults: vi.fn(),
  findFiltersSections: vi.fn(() => []),
  prefetchFilterSection: vi.fn(),
}));

import { buildRoutes } from "../buildRoutes";

// ── Helpers ──
function makeConfig(pages: Array<{ path: string; sections?: unknown[] }>): SiteConfig {
  return {
    meta: { title: { fr: "T", en: "T" }, defaultLang: "fr", languages: ["fr"] },
    header: { nav: [], utilities: {} },
    pages: pages.map((p) => ({
      path: p.path,
      title: { fr: "P", en: "P" },
      sections: p.sections ?? [],
    })),
    footer: { copyright: { fr: "©", en: "©" } },
  } as unknown as SiteConfig;
}

function fakeQueryClient() {
  return {} as unknown as Parameters<typeof buildRoutes>[1];
}

beforeEach(() => {
  mockDiscoverModules.mockReset();
  mockGetModuleRoutesSync.mockReset();
  mockGetModuleRoutes.mockReset();
});

describe("buildRoutes — mode synchrone (sans queryClient, modules core uniquement)", () => {
  it("retourne RouteObject[] synchrone (pas une Promise)", () => {
    mockDiscoverModules.mockReturnValue([]);
    mockGetModuleRoutesSync.mockReturnValue([]);
    const result = buildRoutes(makeConfig([{ path: "/" }]));
    expect(Array.isArray(result)).toBe(true);
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("crée une route racine `/` enveloppant les children", () => {
    mockDiscoverModules.mockReturnValue([]);
    mockGetModuleRoutesSync.mockReturnValue([]);
    const result = buildRoutes(makeConfig([{ path: "/" }])) as RouteObject[];
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("/");
    expect(result[0].children).toBeDefined();
  });

  it("normalise le path racine '/' en '' (sans slash initial)", () => {
    mockDiscoverModules.mockReturnValue([]);
    mockGetModuleRoutesSync.mockReturnValue([]);
    const result = buildRoutes(makeConfig([{ path: "/" }])) as RouteObject[];
    const children = result[0].children!;
    const homeRoute = children.find((c) => c.path === "");
    expect(homeRoute).toBeDefined();
  });

  it("normalise '/about' en 'about'", () => {
    mockDiscoverModules.mockReturnValue([]);
    mockGetModuleRoutesSync.mockReturnValue([]);
    const result = buildRoutes(makeConfig([{ path: "/" }, { path: "/about" }])) as RouteObject[];
    const children = result[0].children!;
    expect(children.find((c) => c.path === "about")).toBeDefined();
  });

  it("inclut une route catch-all '*' à la fin", () => {
    mockDiscoverModules.mockReturnValue([]);
    mockGetModuleRoutesSync.mockReturnValue([]);
    const result = buildRoutes(makeConfig([{ path: "/" }])) as RouteObject[];
    const children = result[0].children!;
    const wildcard = children.find((c) => c.path === "*");
    expect(wildcard).toBeDefined();
  });

  it("chaque route de page produit un element défini (SiteRenderer)", () => {
    mockDiscoverModules.mockReturnValue([]);
    mockGetModuleRoutesSync.mockReturnValue([]);
    const result = buildRoutes(makeConfig([{ path: "/" }, { path: "/contact" }])) as RouteObject[];
    const children = result[0].children!;
    for (const child of children) {
      expect(child.element).toBeDefined();
    }
  });

  it("inclut les routes des modules core (synchrone)", () => {
    const moduleRoute: RouteObject = { path: "profil/:slug", element: null };
    mockDiscoverModules.mockReturnValue([
      { config: { name: "profil", type: "core" }, routes: () => [moduleRoute] },
    ]);
    mockGetModuleRoutesSync.mockReturnValue([moduleRoute]);
    const result = buildRoutes(makeConfig([{ path: "/" }])) as RouteObject[];
    const children = result[0].children!;
    expect(children.find((c) => c.path === "profil/:slug")).toBeDefined();
  });
});

describe("buildRoutes — mode asynchrone", () => {
  it("retourne une Promise quand queryClient est fourni", () => {
    mockDiscoverModules.mockReturnValue([]);
    mockGetModuleRoutes.mockResolvedValue([]);
    const result = buildRoutes(makeConfig([{ path: "/" }]), fakeQueryClient());
    expect(result).toBeInstanceOf(Promise);
  });

  it("retourne une Promise quand au moins un module est optional", () => {
    mockDiscoverModules.mockReturnValue([
      { config: { name: "lazyModule", type: "optional" }, routes: null },
    ]);
    mockGetModuleRoutes.mockResolvedValue([]);
    const result = buildRoutes(makeConfig([{ path: "/" }]));
    expect(result).toBeInstanceOf(Promise);
  });

  it("la Promise résout vers un RouteObject[] avec route racine + catch-all", async () => {
    mockDiscoverModules.mockReturnValue([]);
    mockGetModuleRoutes.mockResolvedValue([]);
    const result = (await buildRoutes(
      makeConfig([{ path: "/" }, { path: "/about" }]),
      fakeQueryClient()
    )) as RouteObject[];

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("/");
    const children = result[0].children!;
    expect(children.find((c) => c.path === "")).toBeDefined();
    expect(children.find((c) => c.path === "about")).toBeDefined();
    expect(children.find((c) => c.path === "*")).toBeDefined();
  });

  it("attache un loader sur chaque route de page (mode async)", async () => {
    mockDiscoverModules.mockReturnValue([]);
    mockGetModuleRoutes.mockResolvedValue([]);
    const result = (await buildRoutes(
      makeConfig([{ path: "/about" }]),
      fakeQueryClient()
    )) as RouteObject[];

    const children = result[0].children!;
    const aboutRoute = children.find((c) => c.path === "about");
    expect(aboutRoute?.loader).toBeInstanceOf(Function);
  });

  it("inclut les routes des modules retournées par getModuleRoutes", async () => {
    const moduleRoute: RouteObject = { path: "ampli", element: null };
    mockDiscoverModules.mockReturnValue([
      { config: { name: "ampli", type: "core" }, routes: () => [moduleRoute] },
    ]);
    mockGetModuleRoutes.mockResolvedValue([moduleRoute]);
    const result = (await buildRoutes(
      makeConfig([{ path: "/" }]),
      fakeQueryClient()
    )) as RouteObject[];
    const children = result[0].children!;
    expect(children.find((c) => c.path === "ampli")).toBeDefined();
  });
});

describe("buildRoutes — détection de modules optional", () => {
  it("force le mode async dès qu'un module optional est présent (même sans queryClient)", () => {
    mockDiscoverModules.mockReturnValue([
      { config: { name: "ampli", type: "core" }, routes: null },
      { config: { name: "lazy", type: "optional" }, routes: null },
    ]);
    mockGetModuleRoutes.mockResolvedValue([]);
    const result = buildRoutes(makeConfig([{ path: "/" }]));
    expect(result).toBeInstanceOf(Promise);
  });

  it("reste synchrone si tous les modules sont core et pas de queryClient", () => {
    mockDiscoverModules.mockReturnValue([
      { config: { name: "core1", type: "core" }, routes: null },
      { config: { name: "core2", type: "core" }, routes: null },
    ]);
    mockGetModuleRoutesSync.mockReturnValue([]);
    const result = buildRoutes(makeConfig([{ path: "/" }]));
    expect(Array.isArray(result)).toBe(true);
  });
});
