// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { matchRoutes } from "react-router";
import type { SiteConfig } from "@/types/site-schema";

import { routes } from "./routes";

/**
 * La factory de routes du module AAC est gatée sur `config.aac` (review MR 53, C2).
 *
 * Le module est `core` : `discoverModules` le charge sur TOUS les sites. Sans le
 * gate, `/aac` et `/aac/commun/:answerId` étaient servies sur les 16 sites du parc
 * qui n'ont pas d'AAC — une page « aucun AAC déclaré » à la place du catch-all.
 * Ce test fige le contrat : pas de `config.aac` ⇒ aucune route ; avec ⇒ les deux.
 */
const ANSWER_ID = "6438366673d20a0de1533c77";
const WITH_AAC = { aac: { formId: "677e7e389058e31575550ac8" } } as unknown as SiteConfig;

const matcher = (url: string, config?: SiteConfig) => matchRoutes(routes(undefined, config), url);

describe("routes du module aac — gate sur config.aac", () => {
  it("sans `config.aac`, la factory ne monte AUCUNE route (config absente ou sans bloc aac)", () => {
    expect(routes(undefined, undefined)).toEqual([]);
    expect(routes(undefined, {} as SiteConfig)).toEqual([]);
    // …donc l'URL n'est capturée par rien : elle tombera sur le catch-all du site.
    expect(matcher("/aac")).toBeNull();
    expect(matcher(`/aac/commun/${ANSWER_ID}`)).toBeNull();
  });

  it("avec `config.aac`, `/aac` est servie", () => {
    expect(matcher("/aac", WITH_AAC)).not.toBeNull();
  });

  it("avec `config.aac`, `/aac/commun/:answerId` est servie et capture l'id", () => {
    const m = matcher(`/aac/commun/${ANSWER_ID}`, WITH_AAC);
    expect(m).not.toBeNull();
    expect(m![m!.length - 1]!.params).toMatchObject({ answerId: ANSWER_ID });
  });

  it("le module n'a jamais exposé `/commun/:id` — la seule fiche est sous `/aac/commun/`", () => {
    // Cible du lien mort de l'ex-`AacCommunList` (review MR 53, H11/H13) : ne pas la « corriger » en
    // ajoutant la route, c'est le lien qui était faux.
    expect(matcher(`/commun/${ANSWER_ID}`, WITH_AAC)).toBeNull();
  });
});
