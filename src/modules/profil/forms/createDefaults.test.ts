import { describe, it, expect } from "vitest";

import { applyCreateDefaults } from "./createDefaults";

describe("applyCreateDefaults", () => {
  const CHAMPS = ["name", "category", "description"] as const;

  it("sème une valeur déclarée par le formulaire, par-dessus le défaut dérivé", () => {
    const out = applyCreateDefaults({ name: "", category: "", description: "" }, { category: "appel-projet" }, CHAMPS);
    expect(out).toEqual({ name: "", category: "appel-projet", description: "" });
  });

  it("ne touche pas aux autres champs", () => {
    const out = applyCreateDefaults({ name: "Titre", category: "" }, { category: "offre-emploi" }, CHAMPS);
    expect(out.name).toBe("Titre");
  });

  it("IGNORE une clé absente du formulaire (faute de frappe en config = semis inerte, pas de valeur fantôme)", () => {
    const defaults = { name: "", category: "" };
    const out = applyCreateDefaults(defaults, { categorie: "appel-projet" }, CHAMPS);
    expect(out).toBe(defaults);
    expect(out).not.toHaveProperty("categorie");
  });

  it("écarte `undefined` — semer « rien » n'écrase pas un défaut légitime", () => {
    const defaults = { name: "", category: "actualite" };
    expect(applyCreateDefaults(defaults, { category: undefined }, CHAMPS)).toBe(defaults);
  });

  it("sans seed : renvoie l'objet PAR IDENTITÉ (non-régression des forms sans createDefaults)", () => {
    const defaults = { name: "", category: "" };
    expect(applyCreateDefaults(defaults, undefined, CHAMPS)).toBe(defaults);
  });

  it("seed vide : renvoie l'objet PAR IDENTITÉ", () => {
    const defaults = { name: "", category: "" };
    expect(applyCreateDefaults(defaults, {}, CHAMPS)).toBe(defaults);
  });

  it("applique plusieurs clés en une passe, et ignore les inconnues du même seed", () => {
    const out = applyCreateDefaults(
      { name: "", category: "", description: "" },
      { name: "Appel 2026", category: "appel-projet", inconnu: "x" },
      CHAMPS,
    );
    expect(out).toEqual({ name: "Appel 2026", category: "appel-projet", description: "" });
  });

  it("ne mute pas l'objet source", () => {
    const defaults = { name: "", category: "" };
    applyCreateDefaults(defaults, { category: "appel-projet" }, CHAMPS);
    expect(defaults.category).toBe("");
  });
});
