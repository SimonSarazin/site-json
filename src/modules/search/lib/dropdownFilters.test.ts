import { describe, it, expect } from "vitest";
import type { SearchByFieldValue } from "@/modules/search/contexts/pageFilters";
import {
  normalizeFilterValue,
  resolveDropdownOption,
  dropdownFilterToParam,
  dropdownFilterToState,
  resolveServerDataPath,
  toFacetTokens,
  keyFor,
  splitKey,
  type DropdownFilterConfig,
} from "./dropdownFilters";

const filter = (partial: Partial<DropdownFilterConfig> & { options: DropdownFilterConfig["options"] }) =>
  ({ id: "f", label: { fr: "F" }, ...partial }) as DropdownFilterConfig;
const opt = (id: string, value?: string, labelFr?: string, field?: string) =>
  ({ id, value, field, label: { fr: labelFr ?? value ?? id } }) as DropdownFilterConfig["options"][number];

describe("normalizeFilterValue", () => {
  const cases: Array<[string, string, string]> = [
    ["parenthèses gardent le contenu", "Individuel(s)", "individuels"],
    ["variante sans parenthèses = même normalisée", "Individuels", "individuels"],
    ["famille(s)", "famille(s)", "familles"],
    ["diacritiques + parenthèses", "Aire mixte (décollage et atterrissage)", "aire mixte decollage et atterrissage"],
    ["slash espacé", "Salle(s) de réunion / cours", "salles de reunion/cours"],
    ["slash non espacé = même", "Salle(s) de réunion/cours", "salles de reunion/cours"],
    ["slash sans espace côté data", "Multisports/City-stades", "multisports/city-stades"],
    ["apostrophe droite", "Dojo / Salle d'arts martiaux", "dojo/salle d'arts martiaux"],
    ["apostrophe courbe = même", "Dojo / Salle d’arts martiaux", "dojo/salle d'arts martiaux"],
  ];
  it.each(cases)("%s", (_label, input, expected) => {
    expect(normalizeFilterValue(input)).toBe(expected);
  });
});

describe("resolveDropdownOption", () => {
  it("résout par id exact", () => {
    const f = filter({ options: [opt("commune", "Commune"), opt("region", "Région")] });
    expect(resolveDropdownOption(f, "region")?.id).toBe("region");
  });

  it("résout par value normalisée (parenthèses/pluriel)", () => {
    const f = filter({ options: [opt("individuels", "Individuel(s)")] });
    expect(resolveDropdownOption(f, "Individuels")?.id).toBe("individuels");
    expect(resolveDropdownOption(f, "Individuel(s)")?.id).toBe("individuels");
  });

  it("résout par label quand la value diffère (cas typo 'Aire mixte' : serverData = double-r = label)", () => {
    const f = filter({
      options: [
        opt("aire-mixte", "Aire mixte (décollage et atterissage)", "Aire mixte (décollage et atterrissage)"),
      ],
    });
    // serverData réel a le double-r (= label) ; la value config avait un typo (simple-r)
    expect(resolveDropdownOption(f, "Aire mixte (décollage et atterrissage)")?.id).toBe("aire-mixte");
  });

  it("résout le slash espacé/non-espacé de façon interchangeable", () => {
    const f = filter({ options: [opt("salle-reunion", "Salle(s) de réunion / cours")] });
    expect(resolveDropdownOption(f, "Salle(s) de réunion/cours")?.id).toBe("salle-reunion");
  });

  it("PAS de faux positif substring : valeurs qui se chevauchent → exact seulement", () => {
    const f = filter({
      options: [
        opt("basket", "Terrain de basket-ball"),
        opt("basket-3x3", "Terrain de basket-ball 3x3"),
      ],
    });
    expect(resolveDropdownOption(f, "Terrain de basket-ball 3x3")?.id).toBe("basket-3x3");
    expect(resolveDropdownOption(f, "Terrain de basket-ball")?.id).toBe("basket");
    // une valeur non présente ne "match" plus un sous-ensemble (comportement M2 corrigé)
    expect(resolveDropdownOption(f, "Terrain de basket-ball 5x5")).toBeNull();
  });

  it("renvoie null quand aucune option ne correspond (→ facette non cliquable, pas de lien mort)", () => {
    const f = filter({ options: [opt("commune", "Commune")] });
    expect(resolveDropdownOption(f, "Aucune correspondance")).toBeNull();
  });
});

describe("dropdownFilterToParam", () => {
  it("écrit ?filterId=id et supprime quand vide", () => {
    const f = filter({ id: "poi-category", options: [opt("x", "X")] });
    const p = new URLSearchParams("poi-category=old&keep=1");
    dropdownFilterToParam(p, f, ["x"]);
    expect(p.get("poi-category")).toBe("x");
    dropdownFilterToParam(p, f, []);
    expect(p.get("poi-category")).toBeNull();
    expect(p.get("keep")).toBe("1");
  });
});

describe("dropdownFilterToState", () => {
  it("branche field : REPLACE (nettoie le préfixe) + field par option", () => {
    const f = filter({
      id: "utilisateur",
      field: "equip_utilisateur",
      options: [opt("a", "A"), opt("b", "B")],
    });
    let sbf: Record<string, SearchByFieldValue> = {
      "utilisateur:a": { field: "equip_utilisateur", value: ["A"] },
      "autre:z": { field: "x", value: ["z"] },
    };
    dropdownFilterToState(
      () => {},
      (u) => {
        sbf = u(sbf);
      },
      f,
      ["b"],
    );
    expect(sbf["utilisateur:a"]).toBeUndefined(); // ancien nettoyé (pas d'accumulation)
    expect(sbf["utilisateur:b"]).toEqual({ field: "equip_utilisateur", value: ["B"] });
    expect(sbf["autre:z"]).toBeDefined(); // clés d'autres filtres préservées
  });

  it("branche field : optionIds vide → nettoie le préfixe", () => {
    const f = filter({ id: "utilisateur", field: "equip_utilisateur", options: [opt("a", "A")] });
    let sbf: Record<string, SearchByFieldValue> = {
      "utilisateur:a": { field: "equip_utilisateur", value: ["A"] },
    };
    dropdownFilterToState(() => {}, (u) => { sbf = u(sbf); }, f, []);
    expect(sbf["utilisateur:a"]).toBeUndefined();
  });

  it("branche non-field → selectedFilters (set/delete)", () => {
    const f = filter({ id: "poi-category", options: [opt("x", "X")] });
    let sel: Record<string, string[]> = { other: ["y"] };
    dropdownFilterToState((u) => { sel = u(sel); }, () => {}, f, ["x"]);
    expect(sel["poi-category"]).toEqual(["x"]);
    dropdownFilterToState((u) => { sel = u(sel); }, () => {}, f, []);
    expect(sel["poi-category"]).toBeUndefined();
    expect(sel.other).toEqual(["y"]);
  });
});

describe("resolveServerDataPath", () => {
  const sd = { equip_type_name: "Canyon", address: { postalCode: "97400" } };
  it("lit un champ simple", () => expect(resolveServerDataPath(sd, "equip_type_name")).toBe("Canyon"));
  it("lit un dot-path imbriqué", () => expect(resolveServerDataPath(sd, "address.postalCode")).toBe("97400"));
  it("renvoie undefined pour un chemin absent", () => expect(resolveServerDataPath(sd, "address.city")).toBeUndefined());
  it("gère un serverData undefined", () => expect(resolveServerDataPath(undefined, "x")).toBeUndefined());
});

describe("toFacetTokens", () => {
  it("tableau (coerce:stringArray) → strings", () =>
    expect(toFacetTokens(["Individuel(s)", "Clubs sportifs"])).toEqual(["Individuel(s)", "Clubs sportifs"]));
  it("chaîne multi-valeurs → split virgule", () =>
    expect(toFacetTokens("Réception / Accueil, Buvette")).toEqual(["Réception / Accueil", "Buvette"]));
  it("chaîne simple → un token", () => expect(toFacetTokens("Canyon")).toEqual(["Canyon"]));
  it("nombre/booléen → string", () => expect(toFacetTokens(42)).toEqual(["42"]));
  it("undefined/objet → []", () => {
    expect(toFacetTokens(undefined)).toEqual([]);
    expect(toFacetTokens({})).toEqual([]);
  });
});

describe("keyFor / splitKey", () => {
  it("round-trip (gère les ':' dans l'optionId)", () => {
    expect(keyFor("f", "a:b")).toBe("f:a:b");
    expect(splitKey("f:a:b")).toEqual({ filterId: "f", optionId: "a:b" });
    expect(splitKey("nokey")).toBeNull();
  });
});
