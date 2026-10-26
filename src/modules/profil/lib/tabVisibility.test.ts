import { describe, it, expect } from "vitest";

import { isTabAvailable, isTabVisible } from "./tabVisibility";

const PROPRIO = { id: "u1", slug: "judi" };
const VISITEUR = { id: "u2", slug: "autre" };

describe("isTabVisible — onglets réservés au propriétaire (`userContext`)", () => {
  it("avant hydratation, un onglet `own` n'est pas rendu, même pour le propriétaire (HTML SSR = 1er rendu client)", () => {
    expect(isTabVisible({ userContext: "own" }, { hydrated: false, me: PROPRIO, entitySlug: "judi" })).toBe(false);
    expect(isTabVisible({ userContext: "own" }, { hydrated: false, me: null, entitySlug: "judi" })).toBe(false);
  });

  it("après hydratation : visible pour le propriétaire seulement", () => {
    expect(isTabVisible({ userContext: "own" }, { hydrated: true, me: PROPRIO, entitySlug: "judi" })).toBe(true);
    expect(isTabVisible({ userContext: "own" }, { hydrated: true, me: VISITEUR, entitySlug: "judi" })).toBe(false);
    expect(isTabVisible({ userContext: "own" }, { hydrated: true, me: null, entitySlug: "judi" })).toBe(false);
  });

  it("`other` : rendu avant hydratation (ce que voyait le SSR), retiré ensuite pour le propriétaire", () => {
    expect(isTabVisible({ userContext: "other" }, { hydrated: false, me: PROPRIO, entitySlug: "judi" })).toBe(true);
    expect(isTabVisible({ userContext: "other" }, { hydrated: true, me: PROPRIO, entitySlug: "judi" })).toBe(false);
    expect(isTabVisible({ userContext: "other" }, { hydrated: true, me: VISITEUR, entitySlug: "judi" })).toBe(true);
  });
});

describe("isTabVisible — `auth` et `entityTypes`", () => {
  it("`auth` est ignoré avant hydratation, tranché après", () => {
    expect(isTabVisible({ auth: "required" }, { hydrated: false, me: null })).toBe(true);
    expect(isTabVisible({ auth: "required" }, { hydrated: true, me: null })).toBe(false);
    expect(isTabVisible({ auth: "required" }, { hydrated: true, me: PROPRIO })).toBe(true);
    expect(isTabVisible({ auth: "anonymous" }, { hydrated: true, me: PROPRIO })).toBe(false);
  });

  it("`entityTypes` filtre quand le type est connu, laisse passer sinon", () => {
    expect(isTabVisible({ entityTypes: ["citoyens"] }, { hydrated: false, entityType: "organizations" })).toBe(false);
    expect(isTabVisible({ entityTypes: ["citoyens"] }, { hydrated: false, entityType: "citoyens" })).toBe(true);
    expect(isTabVisible({ entityTypes: ["citoyens"] }, { hydrated: false })).toBe(true);
  });

  it("sans condition : toujours visible", () => {
    expect(isTabVisible(undefined, { hydrated: false })).toBe(true);
  });
});

describe("isTabAvailable — onglets cagnotte d'un projet sans réponse liée", () => {
  const FINANCEMENTS = {
    condition: { auth: "required" as const },
    sections: [{ type: "cagnotte-layout", props: { leftSections: [{ type: "finance" }], rightSections: [{ type: "finance-summary" }] } }],
  };
  const ACTUALITES = { sections: [{ type: "news" }] };

  it("projet sans réponse : onglet cagnotte retiré, dès avant l'hydratation", () => {
    expect(isTabAvailable(FINANCEMENTS, { hydrated: false, entityType: "projects" })).toBe(false);
    expect(isTabAvailable(FINANCEMENTS, { hydrated: true, me: PROPRIO, entityType: "projects", answerId: null })).toBe(false);
  });

  it("projet relié à une réponse : onglet proposé", () => {
    expect(isTabAvailable(FINANCEMENTS, { hydrated: true, me: PROPRIO, entityType: "projects", answerId: "answer-1" })).toBe(true);
  });

  it("autres entités, autres onglets : rien ne change", () => {
    expect(isTabAvailable(FINANCEMENTS, { hydrated: true, me: PROPRIO, entityType: "organizations" })).toBe(true);
    expect(isTabAvailable(ACTUALITES, { hydrated: true, me: PROPRIO, entityType: "projects" })).toBe(true);
  });

  it("la `condition` de l'onglet reste appliquée", () => {
    expect(isTabAvailable(FINANCEMENTS, { hydrated: true, me: null, entityType: "projects", answerId: "answer-1" })).toBe(false);
  });
});
