import { describe, it, expect } from "vitest";

import {
  agendaBaseSig,
  agendaListIndexStep,
  buildAgendaCalendarParams,
  buildAgendaListParams,
  AGENDA_DEFAULT_INDEX_STEP,
  type AgendaBaseParams,
} from "./buildAgendaParams";

/**
 * `searchEventsCostum` est un endpoint DISTINCT de `searchCostum` : l'agenda ne passe donc jamais
 * par `buildSearchPayload`, et n'héritait d'AUCUNE porte de validation. Mesuré (commit e3f1a060) :
 * « un événement déposé via un formulaire costum aurait été publié immédiatement, sans passer par
 * l'onglet Validation ». Ces tests verrouillent la porte à sa nouvelle place.
 */
describe("buildAgendaParams — porte de validation", () => {
  const CLAUSES = {
    "preferences.toBeValidated.monSite": { $exists: false },
    "source.toBeValidated.monSite": { $exists: false },
  };

  it("costumSlug → les deux clauses, sur les DEUX modes (liste et calendrier)", () => {
    const bp: AgendaBaseParams = { costumSlug: "monSite" };
    expect(buildAgendaListParams(20, {}, bp).filters).toEqual(CLAUSES);
    expect(buildAgendaCalendarParams(new Date(0), new Date(1), {}, bp).filters).toEqual(CLAUSES);
  });

  it("costumSlug + filters de config : les deux fusionnent", () => {
    const p = buildAgendaListParams(20, {}, { costumSlug: "monSite", filters: { "address.postalCode": "97460" } });
    expect(p.filters).toEqual({ "address.postalCode": "97460", ...CLAUSES });
  });

  it("costumSlug n'est PAS émis dans le payload — le SDK injecte le sien via _withCostumContext", () => {
    expect("costumSlug" in buildAgendaListParams(20, {}, { costumSlug: "monSite" })).toBe(false);
  });

  /**
   * NON-RÉGRESSION DU PARC : 7 sections agenda en production (tiers-lieux ×2, institut-bleu ×2,
   * rezo-sante-reunion, eXtremeDefiAdeme, parent62) n'écrivent pas `costumSlug`. Le payload produit
   * pour elles doit rester EXACTEMENT celui d'avant — sinon leur queryKey change et tous leurs
   * caches SSR/client ratent leur hit, et surtout leurs listes se mettraient à masquer sans qu'on
   * l'ait décidé. La porte est OPT-IN, comme celle de `searchProStatic`.
   */
  it("sans costumSlug : payload INCHANGÉ, aucune clause parasite", () => {
    expect(buildAgendaListParams(20, {}, { sourceKey: ["a", "b"], fediverse: false })).toEqual({
      indexStep: 20,
      sourceKey: ["a", "b"],
      fediverse: false,
    });
    expect(buildAgendaListParams(20, {}, { filters: { x: 1 } }).filters).toEqual({ x: 1 });
    expect("filters" in buildAgendaListParams(20, {}, {})).toBe(false);
    expect("filters" in buildAgendaListParams(20, {})).toBe(false);
  });

  it("la signature de queryKey intègre costumSlug — sinon deux périmètres partagent un cache", () => {
    expect(agendaBaseSig({ costumSlug: "a" })).not.toBe(agendaBaseSig({ costumSlug: "b" }));
    expect(agendaBaseSig({ costumSlug: "a" })).not.toBe(agendaBaseSig({}));
    // …et reste canonique : même contenu, ordre d'insertion différent ⇒ même signature.
    expect(agendaBaseSig({ costumSlug: "a", sourceKey: ["x"] })).toBe(
      agendaBaseSig({ sourceKey: ["x"], costumSlug: "a" }),
    );
  });
});

describe("buildAgendaParams — le reste du contrat", () => {
  it("indexStep : baseParams sinon défaut", () => {
    expect(agendaListIndexStep({ indexStepList: 5 })).toBe(5);
    expect(agendaListIndexStep({})).toBe(AGENDA_DEFAULT_INDEX_STEP);
    expect(agendaListIndexStep()).toBe(AGENDA_DEFAULT_INDEX_STEP);
  });

  it("le mode calendrier porte ses bornes, le mode liste sa pagination", () => {
    const d1 = new Date(0);
    const d2 = new Date(86400000);
    expect(buildAgendaCalendarParams(d1, d2)).toEqual({ startDateUTC: d1, endDateUTC: d2 });
    expect(buildAgendaListParams(12)).toEqual({ indexStep: 12 });
  });

  it("type et name ne sont émis que renseignés", () => {
    expect(buildAgendaListParams(20, { type: "sport", name: "tournoi" })).toMatchObject({
      type: "sport",
      name: "tournoi",
    });
    expect("type" in buildAgendaListParams(20, { name: "" })).toBe(false);
  });
});
