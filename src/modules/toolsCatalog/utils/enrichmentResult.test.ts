import { describe, it, expect } from "vitest";
import { readEnrichmentVerdict } from "./enrichmentResult";

/**
 * Les formes testées ne sont pas inventées : ce sont les retours RÉELS des cinq
 * branches de `SaveCriteriaAction::run()`, telles que la lib les rend après son
 * déballage `res?.data ?? res`.
 */

describe("readEnrichmentVerdict — succès (la lib a déballé `data`)", () => {
  it("lit un update comme un succès : la lib rend le `$set`, sans `results`", () => {
    // Branche update. `$set` porte toujours `updated`, donc `data` est toujours
    // truthy, donc la lib déballe TOUJOURS sur cette branche.
    const rendu = { updated: "2026-08-27T14:57:47.000Z", urlTool: "/aac/commun/…", isOpenSource: "false" };
    expect(readEnrichmentVerdict(rendu)).toEqual({ ok: true, msg: undefined });
  });

  it("lit un insert comme un succès : la lib rend le document créé", () => {
    const rendu = { name: "Framateam", collection: "navigatorcriteria", created: "…", updated: "…" };
    expect(readEnrichmentVerdict(rendu).ok).toBe(true);
  });
});

describe("readEnrichmentVerdict — échec métier en HTTP 200", () => {
  it("respecte `results: false` : sans `data`, l'enveloppe survit au déballage", () => {
    // Branche `name` vide. Le serveur n'écrit pas de `data`, donc `res?.data ?? res`
    // retombe sur `res` et `results` arrive intact — c'est le seul cas où la lib
    // transmet le verdict.
    expect(readEnrichmentVerdict({ results: false, msg: "Criteria not saved" })).toEqual({
      ok: false,
      msg: "Criteria not saved",
    });
  });

  it("respecte `results: false` du refus d'admin, si jamais il arrivait en 200", () => {
    // Le 401 est normalement rompu par axios avant d'arriver ici. Si le serveur
    // basculait un jour ce refus en 200, le verdict resterait correct.
    expect(readEnrichmentVerdict({ results: false, msg: "Vous n'êtes pas autorisé à modifier cet outil." }).ok).toBe(
      false,
    );
  });
});

describe("readEnrichmentVerdict — le `results` explicite prime", () => {
  it("suit l'enveloppe complète le jour où la lib cessera de déballer", () => {
    // Contrat NATIF de l'endpoint : `results` ET `data` ensemble. Ce module doit
    // continuer de dire vrai après un correctif de lib, sans être retouché.
    const enveloppe = { results: true, msg: "Criteria updated successfully", data: { updated: "…" }, name: "Framateam" };
    expect(readEnrichmentVerdict(enveloppe)).toEqual({ ok: true, msg: "Criteria updated successfully" });
  });

  it("n'interprète PAS un `results` non booléen comme un verdict", () => {
    // `"false"` en string n'est pas un verdict serveur connu ; le traiter comme tel
    // inventerait un échec. On retombe sur la règle du déballage.
    expect(readEnrichmentVerdict({ results: "false" }).ok).toBe(true);
  });
});

describe("readEnrichmentVerdict — rien d'exploitable", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["une chaîne", "ok"],
  ])("refuse d'affirmer un succès sur %s", (_quoi, valeur) => {
    // Absence de retour ≠ succès : ce serait un contrat cassé, pas un enregistrement.
    expect(readEnrichmentVerdict(valeur).ok).toBe(false);
  });
});

/**
 * ── Le test qui compte : les DEUX comportements possibles de la lib ──────────
 *
 * `saveToolEnrichment` a deux implémentations plausibles selon la version installée :
 *
 *  - **déballante** (`1.0.183` → `1.0.189`, celle en place) : `return res?.data ?? res`
 *  - **fidèle** (une lib corrigée, ou un patch local) : `return res`
 *
 * Elles ne rendent PAS la même chose sur les mêmes réponses serveur. Le verdict, lui,
 * doit être identique et correct dans les deux cas — sans quoi le module dépendrait de
 * la version installée, et une simple réinstallation de `node_modules` ferait
 * réapparaître le toast d'échec sur un enregistrement réussi.
 *
 * On rejoue donc les réponses RÉELLES de `SaveCriteriaAction::run()` à travers les deux
 * implémentations. Ce qui est simulé ici est la SEULE ligne de déballage de la lib,
 * lue dans sa source — pas la pièce testée, qui reste `readEnrichmentVerdict`.
 */

/** Les 3 réponses HTTP 200 que le serveur peut produire (les 401 sont rompus par axios). */
const REPONSES_SERVEUR = [
  {
    quoi: "update",
    corps: {
      results: true,
      msg: "Criteria updated successfully",
      data: { updated: "2026-08-27T14:57:47.000Z", urlTool: "/aac/commun/6a33be10fbb6f52b76632076", isOpenSource: "false" },
      name: "Framateam",
    },
    attendu: true,
  },
  {
    quoi: "insert",
    corps: {
      results: true,
      msg: "Criteria saved successfully",
      data: { name: "Framateam", collection: "navigatorcriteria", created: "…", updated: "…" },
    },
    attendu: true,
  },
  {
    quoi: "`name` vide",
    corps: { results: false, msg: "Criteria not saved" },
    attendu: false,
  },
] as const;

const IMPLEMENTATIONS = [
  { nom: "lib déballante (1.0.183 → 1.0.189)", rendu: (c: Record<string, unknown>) => c.data ?? c },
  { nom: "lib fidèle (corrigée ou patchée)", rendu: (c: Record<string, unknown>) => c },
] as const;

describe.each(IMPLEMENTATIONS)("readEnrichmentVerdict — $nom", ({ rendu }) => {
  it.each(REPONSES_SERVEUR)("tranche juste sur la branche $quoi", ({ corps, attendu }) => {
    expect(readEnrichmentVerdict(rendu(corps as unknown as Record<string, unknown>)).ok).toBe(attendu);
  });
});

it("les deux implémentations donnent le MÊME verdict sur chaque réponse serveur", () => {
  // Formulé comme une équivalence, et pas comme deux listes d'attendus : c'est
  // l'invariant qui rend le module indépendant de la version de lib installée.
  for (const { corps } of REPONSES_SERVEUR) {
    const [deballante, fidele] = IMPLEMENTATIONS.map(
      (impl) => readEnrichmentVerdict(impl.rendu(corps as unknown as Record<string, unknown>)).ok,
    );
    expect(deballante).toBe(fidele);
  }
});
