import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { matchRoutes, type RouteObject } from "react-router";
import { buildRoutes } from "../buildRoutes";
import type { SiteConfig } from "@/types/site-schema";

/**
 * Test de CARACTÉRISATION du matching react-router (R8b — dé-risquage du bump 7.10.1 → 7.18.0).
 *
 * Le seul code RR qui touche notre chemin réel est le MATCHER (réécrit en 7.15/7.18). Les e2e
 * l'exercent (status 200 / pas de crash) mais ne PINNENT jamais QUELLE route gagne pour une URL
 * donnée — donc un changement d'ordre splat-vs-route-concrète passerait inaperçu. Ce test appelle
 * `matchRoutes` sans serveur ni navigateur et fige la branche gagnante (path + params).
 *
 * Au bump : ce snapshot DOIT rester identique (matching déclaré iso-comportement). S'il bouge,
 * c'est exactement la régression silencieuse recherchée → bloquer et investiguer.
 */

const ROOT = path.resolve(__dirname, "../../..");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.prod.json"), "utf-8")) as SiteConfig;

let routes: RouteObject[];

beforeAll(async () => {
  // buildRoutes peut être sync (client, modules core) ou async (serveur) → await couvre les deux.
  routes = (await buildRoutes(config)) as RouteObject[];
});

// Cas canoniques + les 2 que le rewrite pourrait régresser (splat vs route concrète, :slug).
const URLS = [
  "/", // page racine
  "/features", // page plate réelle du config
  "/page-inexistante", // DOIT tomber sur le splat '*' (404 piloté par SiteRenderer)
  "/profil/abc-123", // DOIT matcher 'profil/:slug', PAS le catch-all
  "/profil/abc-123/membres", // cas imbriqué (tab) — fige le comportement actuel quel qu'il soit
];

describe("buildRoutes matching — caractérisation (fige le matcher react-router avant bump)", () => {
  for (const url of URLS) {
    it(`branche matchée pour ${url}`, () => {
      const matched = matchRoutes(routes, url);
      const shape = matched?.map((m) => ({ path: m.route.path ?? "(layout/index)", params: m.params }));
      expect(shape).toMatchSnapshot();
    });
  }
});
