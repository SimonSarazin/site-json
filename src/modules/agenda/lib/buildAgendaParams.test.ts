import { describe, it, expect } from "vitest";

import {
  agendaBaseSig,
  agendaBoundsSig,
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

  /**
   * TROU CRÉÉ PAR LA FUSION, pas par l'une des deux branches : `main` a ajouté `notSourceKey` à
   * l'agenda (RELIEF rattache ses events par LIEN, pas par provenance) pendant que cette branche y
   * ajoutait la porte. Réunis sans précaution, un agenda portant les deux clés armait la porte alors
   * que son périmètre costum est désactivé — divergence avec `buildSearchPayload`, où `notSourceKey`
   * la désarme. Sans costum de scope, il n'y a aucun slug sous lequel indexer `toBeValidated`.
   */
  it("notSourceKey DÉSARME la porte, même avec costumSlug — comme dans buildSearchPayload", () => {
    const p = buildAgendaListParams(20, {}, { costumSlug: "monSite", notSourceKey: true });
    expect("filters" in p).toBe(false);
    expect(p.notSourceKey).toBe(true);
    // …et un filtre de config traverse intact, sans clause de porte greffée.
    const q = buildAgendaListParams(20, {}, { costumSlug: "monSite", notSourceKey: true, filters: { "links.organizer.abc": { $exists: true } } });
    expect(q.filters).toEqual({ "links.organizer.abc": { $exists: true } });
  });

  it("la signature de queryKey intègre costumSlug — sinon deux périmètres partagent un cache", () => {
    expect(agendaBaseSig({ costumSlug: "a" })).not.toBe(agendaBaseSig({ costumSlug: "b" }));
    expect(agendaBaseSig({ costumSlug: "a" })).not.toBe(agendaBaseSig({}));
    // …et notSourceKey : périmètre costum vs réseau entier, deux ensembles disjoints.
    expect(agendaBaseSig({ notSourceKey: true })).not.toBe(agendaBaseSig({}));
    expect(agendaBaseSig({ filters: { x: 1 }, notSourceKey: true })).not.toBe(agendaBaseSig({ filters: { x: 1 } }));
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

/**
 * Bornes et tri SERVEUR du mode LISTE (`from`/`to`/`order`/`recurrency`, legacy 2026-09-04 + miroir
 * Node) : c'est ce qui rend « À venir » indépendant de la taille de page (avant : flux DESC non borné
 * retourné côté client, juste SSI futurs ≤ indexStepList).
 */
describe("buildAgendaParams — bornes du mode LISTE", () => {
  const NOW = new Date("2026-09-04T10:00:00.000Z");
  const END = new Date("2027-09-04T21:59:59.999Z");

  it("sans bornes : aucun des quatre paramètres n'est émis (réponse serveur inchangée, pas de endDateSortFormat)", () => {
    const p = buildAgendaListParams(20, {}, undefined);
    for (const k of ["from", "to", "order", "recurrency"]) expect(k in p).toBe(false);
  });

  it("« prochains » : from/to en ISO AVEC offset (toISOString) + order asc", () => {
    const p = buildAgendaListParams(20, {}, undefined, { from: NOW, to: END, order: "asc" });
    expect(p).toMatchObject({ indexStep: 20, from: "2026-09-04T10:00:00.000Z", to: "2027-09-04T21:59:59.999Z", order: "asc" });
    expect("recurrency" in p).toBe(false);
  });

  it("« passés » : to + desc + recurrency:false (une série n'a pas de passé)", () => {
    const p = buildAgendaListParams(20, {}, undefined, { to: NOW, order: "desc", recurrency: false });
    expect(p).toMatchObject({ to: "2026-09-04T10:00:00.000Z", order: "desc", recurrency: false });
    expect("from" in p).toBe(false);
  });

  it("les bornes se combinent au scope/filtres de baseParams sans les écraser", () => {
    const p = buildAgendaListParams(10, { type: "meeting" }, { sourceKey: ["parent62"] }, { from: NOW, order: "asc" });
    expect(p).toMatchObject({ sourceKey: ["parent62"], type: "meeting", from: NOW.toISOString(), order: "asc" });
  });

  it("agendaBoundsSig : deux flux ≠ deux signatures ; une nouvelle ancre = une nouvelle signature ; sans bornes = \"\"", () => {
    const a = agendaBoundsSig({ from: NOW, to: END, order: "asc" });
    const b = agendaBoundsSig({ to: NOW, order: "desc", recurrency: false });
    expect(a).not.toBe(b);
    expect(agendaBoundsSig({ from: new Date(NOW.getTime() + 1000), to: END, order: "asc" })).not.toBe(a);
    expect(agendaBoundsSig(undefined)).toBe("");
  });
});

describe("baseParams.recurrency — le site choisit d'inclure ou non les séries", () => {
  // Constantes locales : `T0`/`T1` du bloc précédent ne sortent pas de son `describe`.
  const T0 = new Date("2026-09-04T10:00:00.000Z");
  const T1 = new Date("2027-09-04T21:59:59.999Z");

  it("absent : aucune clé émise — « inclus » est le défaut serveur, on ne l'affirme pas", () => {
    expect("recurrency" in buildAgendaListParams(20, {}, {})).toBe(false);
    expect("recurrency" in buildAgendaCalendarParams(T0, T1, {}, {})).toBe(false);
  });

  it("false : émis dans les DEUX modes — sinon on exclut les séries de la liste et elles reviennent dans la grille", () => {
    expect(buildAgendaListParams(20, {}, { recurrency: false })).toMatchObject({ recurrency: false });
    expect(buildAgendaCalendarParams(T0, T1, {}, { recurrency: false })).toMatchObject({ recurrency: false });
  });

  it("true : émis explicitement (le serveur l'accepte depuis le parse booléen du 2026-09-04)", () => {
    expect(buildAgendaListParams(20, {}, { recurrency: true })).toMatchObject({ recurrency: true });
  });

  it("le `false` du flux « Passés » l'emporte sur une config qui inclurait les séries", () => {
    // Contrainte de sens, pas préférence de site : une série ne renvoie que sa PROCHAINE occurrence.
    const p = buildAgendaListParams(20, {}, { recurrency: true }, { to: T0, order: "desc", recurrency: false });
    expect(p).toMatchObject({ recurrency: false });
  });

  it("le flux « prochains » suit la config (il ne pose pas de `recurrency` de son côté)", () => {
    const p = buildAgendaListParams(20, {}, { recurrency: false }, { from: T0, to: T1, order: "asc" });
    expect(p).toMatchObject({ recurrency: false, order: "asc" });
  });

  it("agendaBaseSig : deux périmètres ne différant que par `recurrency` ne partagent pas de cache", () => {
    expect(agendaBaseSig({ recurrency: false })).not.toBe(agendaBaseSig({ recurrency: true }));
    expect(agendaBaseSig({ recurrency: false })).not.toBe(agendaBaseSig({}));
  });
});
