/**
 * Taxonomie des formulaires parent62 — territoires, publics et thèmes sont FACULTATIFS partout, SAUF le
 * territoire d'une « Réunion du comité » : une réunion appartient toujours au comité local d'un territoire
 * (décision du réseau, 17/09/2026). Testé par le schéma de validation RÉEL compilé depuis la config.
 */
import { describe, it, expect } from "vitest";
import { buildZodSchema } from "@/modules/formEngine/engine/zodGen";
import { loadCostumForm } from "./costum/__fixtures__/configCostum";

const TAXONOMIE = ["territoires", "publics", "themes"] as const;

/** Champs de taxonomie refusés quand on les laisse vides (les autres champs du formulaire sont ignorés). */
function taxonomieExigee(formulaire: string): string[] {
  const { descriptor } = loadCostumForm(formulaire);
  const vides = Object.fromEntries(TAXONOMIE.filter((c) => descriptor.fields[c]).map((c) => [c, []]));
  const r = buildZodSchema(descriptor).safeParse(vides);
  const refuses = r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
  return TAXONOMIE.filter((c) => refuses.includes(c));
}

describe("parent62 — taxonomie facultative", () => {
  it.each(["parent62-article", "parent62-recovery-center", "parent62-event", "parent62-affiche"])(
    "%s : territoires, publics et thèmes peuvent rester vides",
    (formulaire) => {
      expect(taxonomieExigee(formulaire)).toEqual([]);
    },
  );

  it("parent62-reunion : le territoire reste obligatoire, publics et thèmes non", () => {
    expect(taxonomieExigee("parent62-reunion")).toEqual(["territoires"]);
  });
});
