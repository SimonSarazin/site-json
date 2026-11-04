import { describe, it, expect } from "vitest";
import { TOKEN_MATCH_TYPE, escapeRegex, tokenMatchPattern } from "./tokenMatch";
import { searchByFieldsToQuery } from "./searchByFieldsToQuery";

const re = (values: string[]) => new RegExp(tokenMatchPattern(values));

// Valeurs RÉELLES des trois champs multi-valeurs (relevé du 15/10/2026, base prod230926).
const VALEURS_REELLES = [
  "Individuel(s)", "famille(s)", "Clubs sportifs", "comités", "ligues", "fédérations", "Scolaires",
  "universités", "Autre - association(s) et groupes divers", "Etablissement scolaire", "Complexe sportif",
  "Piscine", "Base de plein air et/ou de loisirs", "CREPS ou Ecole nationale", "Aérodrome/aéroport",
  "Bureau(x) Club(s)", "Salle(s) de réunion/cours", "Réception / Accueil", "Local contrôle anti-dopage",
];

describe("tokenMatchPattern — un élément ENTIER d'une liste « a, b »", () => {
  it("retrouve la valeur seule, en tête, au milieu et en fin de liste", () => {
    const r = re(["Complexe sportif"]);
    expect(r.test("Complexe sportif")).toBe(true);
    expect(r.test("Complexe sportif, Etablissement scolaire")).toBe(true);
    expect(r.test("Piscine, Complexe sportif, Etablissement scolaire")).toBe(true);
    expect(r.test("Etablissement scolaire, Complexe sportif")).toBe(true);
  });

  it("ne prend jamais une sous-chaîne pour un élément", () => {
    const r = re(["Piscine"]);
    expect(r.test("Piscine olympique")).toBe(false);
    expect(r.test("Grande Piscine")).toBe(false);
    expect(r.test("Piscines")).toBe(false);
  });

  it("tolère les espaces autour des virgules, comme la donnée", () => {
    const r = re(["Complexe sportif"]);
    expect(r.test("Etablissement scolaire,Complexe sportif")).toBe(true);
    expect(r.test("Complexe sportif ,Piscine")).toBe(true);
    expect(r.test("  Complexe sportif  ")).toBe(true);
  });

  it("lit littéralement les caractères spéciaux des valeurs réelles", () => {
    expect(re(["Individuel(s)"]).test("Individuel(s), famille(s)")).toBe(true);
    // Sans échappement, `(s)` serait un groupe : la regex exigerait « Individuels ».
    expect(re(["Individuel(s)"]).test("Individuels")).toBe(false);
    expect(re(["Aérodrome/aéroport"]).test("Aérodrome/aéroport")).toBe(true);
    expect(re(["Base de plein air et/ou de loisirs"]).test("Complexe sportif, Base de plein air et/ou de loisirs")).toBe(true);
    expect(re(["Bureau(x) Club(s)"]).test("Local de rangement, Bureau(x) Club(s)")).toBe(true);
    expect(re(["a.b"]).test("aXb")).toBe(false);
  });

  it("sensible à la casse, comme l'égalité stricte `$in` qu'elle remplace", () => {
    expect(re(["Complexe sportif"]).test("complexe sportif")).toBe(false);
  });

  it("plusieurs valeurs cochées = alternatives (OU)", () => {
    const r = re(["Piscine", "Complexe sportif"]);
    expect(r.test("Piscine")).toBe(true);
    expect(r.test("Etablissement scolaire, Complexe sportif")).toBe(true);
    expect(r.test("Etablissement scolaire")).toBe(false);
  });

  it("SUR-ENSEMBLE de l'égalité stricte : toute valeur exacte est encore trouvée", () => {
    for (const v of VALEURS_REELLES) expect(re([v]).test(v), v).toBe(true);
  });

  it("escapeRegex neutralise tous les métacaractères", () => {
    const brut = ".*+?^${}()|[]\\";
    expect(new RegExp(`^${escapeRegex(brut)}$`).test(brut)).toBe(true);
  });
});

describe("searchByFieldsToQuery — entrées `token`", () => {
  it("pose un $regex sous $or.$and, jamais un $in sur le champ", () => {
    const { filters } = searchByFieldsToQuery({
      "particularite:piscine": { field: "inst_part_type", type: TOKEN_MATCH_TYPE, value: ["Piscine"] },
    });
    expect(filters.inst_part_type).toBeUndefined();
    expect(filters.$or).toEqual({ $and: [{ inst_part_type: { $regex: tokenMatchPattern(["Piscine"]) } }] });
  });

  it("regroupe les valeurs d'un même champ en UN motif (OU), et ET entre les champs", () => {
    const { filters } = searchByFieldsToQuery({
      "particularite:piscine": { field: "inst_part_type", type: TOKEN_MATCH_TYPE, value: ["Piscine"] },
      "particularite:complexe": { field: "inst_part_type", type: TOKEN_MATCH_TYPE, value: ["Complexe sportif"] },
      "utilisateur:clubs": { field: "equip_utilisateur", type: TOKEN_MATCH_TYPE, value: ["Clubs sportifs"] },
    });
    expect(filters.$or).toEqual({
      $and: [
        { inst_part_type: { $regex: tokenMatchPattern(["Piscine", "Complexe sportif"]) } },
        { equip_utilisateur: { $regex: tokenMatchPattern(["Clubs sportifs"]) } },
      ],
    });
  });

  it("cohabite avec un filtre exact : $in inchangé sur l'autre champ", () => {
    const { filters } = searchByFieldsToQuery({
      "type:foot": { field: "equip_type_name", value: ["Terrain de football"] },
      "utilisateur:clubs": { field: "equip_utilisateur", type: TOKEN_MATCH_TYPE, value: ["Clubs sportifs"] },
    });
    expect(filters.equip_type_name).toEqual({ $in: ["Terrain de football"] });
    expect(filters.$or).toEqual({ $and: [{ equip_utilisateur: { $regex: tokenMatchPattern(["Clubs sportifs"]) } }] });
  });

  it("sans entrée `token`, la sortie est celle d'avant : pas de $or ajouté", () => {
    const { filters } = searchByFieldsToQuery({
      "poi-postalCode:97460": { field: "address.postalCode", value: ["97460"] },
      "type:foot": { field: "equip_type_name", value: ["Terrain de football"] },
    });
    expect(filters).toEqual({
      "address.postalCode": { $in: ["97460"] },
      equip_type_name: { $in: ["Terrain de football"] },
    });
  });

  it("une entrée `token` vide n'émet rien", () => {
    const { filters } = searchByFieldsToQuery({
      "utilisateur:x": { field: "equip_utilisateur", type: TOKEN_MATCH_TYPE, value: [] },
    });
    expect(filters).toEqual({});
  });
});
