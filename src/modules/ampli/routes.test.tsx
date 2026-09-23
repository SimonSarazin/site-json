// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { matchRoutes } from "react-router";
import type { SiteConfig } from "@/types/site-schema";

// Les pages ne sont pas rendues ici : seul le CONTRAT de montage est testé.
vi.mock("./pages/AmpliPage", () => ({ default: () => null }));
vi.mock("./pages/AmpliListPage", () => ({ default: () => null }));

const { routes } = await import("./routes");

/**
 * La factory de routes du module ampli est gatée sur `config.ampli` (même
 * patron que `aac/routes.tsx`). Le module est `core`, donc découvert sur TOUS
 * les sites : sans ce gate, `/ampli/:slug` était servi partout.
 */

const config = (ampli: unknown) => ({ ampli }) as unknown as SiteConfig;
const matcher = (url: string, cfg?: SiteConfig) => matchRoutes(routes(undefined, cfg), url);

const LEGACY = [{ slug: "amplifions", props: { coform: "69426516f7a7f229f7399da2", path: { name: "a.b", address: "a.c" } } }];

describe("routes du module ampli — gate sur config.ampli", () => {
  it("sans `config.ampli` (ou `false`), AUCUNE route : l'URL tombe sur le catch-all du site", () => {
    expect(routes(undefined, undefined)).toEqual([]);
    expect(routes(undefined, {} as SiteConfig)).toEqual([]);
    expect(routes(undefined, config(false))).toEqual([]);
    expect(matcher("/ampli")).toBeNull();
    expect(matcher("/ampli/sinistre")).toBeNull();
  });

  describe("`ampli: true` (amplis lus dans costum.ampli)", () => {
    it("sert la liste `/ampli`", () => {
      const match = matcher("/ampli", config(true));
      expect(match).not.toBeNull();
      expect(match![0].route.path).toBe("ampli");
    });

    it("sert la page d'un ampli et capture son slug", () => {
      const match = matcher("/ampli/sinistre", config(true));
      expect(match).not.toBeNull();
      expect(match![0].params).toMatchObject({ slug: "sinistre" });
    });

    it("sert les onglets de la page ampli", () => {
      for (const tab of ["community", "stats", "news"]) {
        expect(matcher(`/ampli/sinistre/${tab}`, config(true))).not.toBeNull();
      }
    });
  });

  // Forme historique conservée pour la prod : son comportement ne change pas,
  // elle ne gagne donc PAS la page liste.
  describe("`ampli: [...]` (forme historique dépréciée)", () => {
    it("sert la page d'un ampli", () => {
      expect(matcher("/ampli/amplifions", config(LEGACY))).not.toBeNull();
    });

    it("ne sert PAS la liste `/ampli`", () => {
      expect(matcher("/ampli", config(LEGACY))).toBeNull();
    });
  });
});
