import { describe, it, expect } from "vitest";

import { buildFinderDefaultValues, finderFieldName } from "./finderPrefill";

const STRUCTURE = { id: "5f0f0f0f0f0f0f0f0f0f0f0a", type: "organizations", name: "Club Rando Santé" };

describe("buildFinderDefaultValues — finder présélectionné d'une nouvelle réponse", () => {
  it("range l'élément sous <étape>.<clé>, à la forme stockée { [id]: { id, type, name } }", () => {
    expect(buildFinderDefaultValues("etape1.finderetape1abc", STRUCTURE)).toEqual({
      etape1: { finderetape1abc: { [STRUCTURE.id]: STRUCTURE } },
    });
  });

  it("accepte la forme config préfixée par `answers.` (même résultat)", () => {
    expect(buildFinderDefaultValues("answers.etape1.finderetape1abc", STRUCTURE)).toEqual(
      buildFinderDefaultValues("etape1.finderetape1abc", STRUCTURE),
    );
  });

  it("ne recopie que id, type et name (pas les autres clés d'un objet plus riche)", () => {
    const riche = { ...STRUCTURE, email: "club@exemple.re" } as typeof STRUCTURE;
    const values = buildFinderDefaultValues("e.f", riche) as Record<string, Record<string, Record<string, unknown>>>;
    expect(values.e.f[STRUCTURE.id]).toEqual(STRUCTURE);
  });
});

describe("finderFieldName — clé de lockedFields / hiddenFields", () => {
  it("dernier segment du chemin, préfixe de type compris", () => {
    expect(finderFieldName("answers.etape1.finderetape1abc")).toBe("finderetape1abc");
    expect(finderFieldName("etape1.finderetape1abc")).toBe("finderetape1abc");
  });
});
