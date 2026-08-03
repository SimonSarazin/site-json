import { describe, it, expect } from "vitest";
import {
  activeValues,
  nextValues,
  toParam,
  fromParam,
  toSearchByFields,
} from "./installationFilter";
import { searchByFieldsToQuery } from "./searchByFieldsToQuery";

const PARAM = "poi-installation";
const FIELD = "inst_numero";

describe("activeValues", () => {
  it("extrait les valeurs du param, dans l'ordre d'insertion", () => {
    const state = toSearchByFields(PARAM, FIELD, ["I974150156", "I974070032"]);
    expect(activeValues(state, PARAM)).toEqual(["I974150156", "I974070032"]);
  });

  it("ignore les clés des AUTRES filtres (isolation par préfixe)", () => {
    const state = {
      ...toSearchByFields(PARAM, FIELD, ["I974150156"]),
      "type:terrain-de-football": { field: "equip_type_name", value: ["Terrain de football"] },
      "poi-postalCode:97400": { field: "address.postalCode", value: ["97400"] },
    };
    expect(activeValues(state, PARAM)).toEqual(["I974150156"]);
  });

  it("ignore les clés sans séparateur", () => {
    expect(activeValues({ orphan: { field: "x", value: ["y"] } }, PARAM)).toEqual([]);
  });

  it("état vide → aucune valeur", () => {
    expect(activeValues({}, PARAM)).toEqual([]);
  });
});

describe("nextValues", () => {
  it("ajoute une valeur absente", () => {
    expect(nextValues([], "I974150156")).toEqual(["I974150156"]);
  });

  it("retire une valeur présente (toggle off depuis n'importe quelle carte)", () => {
    expect(nextValues(["I974150156"], "I974150156")).toEqual([]);
  });

  it("cumule une 2ᵉ installation sans toucher à la 1ʳᵉ", () => {
    expect(nextValues(["I974150156"], "I974070032")).toEqual(["I974150156", "I974070032"]);
  });

  it("ne retire que la valeur ciblée", () => {
    expect(nextValues(["A", "B", "C"], "B")).toEqual(["A", "C"]);
  });

  it("ne mute pas l'entrée", () => {
    const active = ["A"];
    nextValues(active, "B");
    expect(active).toEqual(["A"]);
  });
});

describe("toParam / fromParam", () => {
  it("écrit les valeurs jointes par virgule", () => {
    const p = new URLSearchParams();
    toParam(p, PARAM, ["A", "B"]);
    expect(p.get(PARAM)).toBe("A,B");
  });

  it("sélection vide → param supprimé (pas de `?param=` résiduel)", () => {
    const p = new URLSearchParams(`${PARAM}=A&keep=1`);
    toParam(p, PARAM, []);
    expect(p.has(PARAM)).toBe(false);
    expect(p.get("keep")).toBe("1");
  });

  it("préserve les autres params (pagination, preview…)", () => {
    const p = new URLSearchParams("preview=abc&type=terrain-de-football");
    toParam(p, PARAM, ["A"]);
    expect(p.get("preview")).toBe("abc");
    expect(p.get("type")).toBe("terrain-de-football");
  });

  it("aller-retour écriture → lecture", () => {
    const p = new URLSearchParams();
    toParam(p, PARAM, ["I974150156", "I974070032"]);
    expect(fromParam(p.get(PARAM))).toEqual(["I974150156", "I974070032"]);
  });

  it("lecture tolérante : espaces, vides et doublons", () => {
    expect(fromParam(" A , ,B,A ")).toEqual(["A", "B"]);
  });

  it("param absent ou vide → aucune valeur", () => {
    expect(fromParam(null)).toEqual([]);
    expect(fromParam("")).toEqual([]);
  });
});

describe("toSearchByFields", () => {
  it("produit des clés préfixées et le shape attendu par searchByFieldsToQuery", () => {
    expect(toSearchByFields(PARAM, FIELD, ["I974150156"])).toEqual({
      "poi-installation:I974150156": { field: "inst_numero", value: ["I974150156"] },
    });
  });

  it("aucune valeur → objet vide", () => {
    expect(toSearchByFields(PARAM, FIELD, [])).toEqual({});
  });
});

describe("intégration : cumul → requête backend", () => {
  it("deux installations fusionnent en un seul $in (OU logique)", () => {
    const state = toSearchByFields(PARAM, FIELD, ["I974150156", "I974070032"]);
    const { filters } = searchByFieldsToQuery(state);
    expect(filters).toEqual({ inst_numero: { $in: ["I974150156", "I974070032"] } });
  });

  it("cohabite avec un filtre de dropdown sur un autre champ", () => {
    const state = {
      ...toSearchByFields(PARAM, FIELD, ["I974150156"]),
      "type:terrain-de-football": { field: "equip_type_name", value: ["Terrain de football"] },
    };
    const { filters } = searchByFieldsToQuery(state);
    expect(filters).toEqual({
      inst_numero: { $in: ["I974150156"] },
      equip_type_name: { $in: ["Terrain de football"] },
    });
  });

  it("valeur avec espaces (libellé) : supportée par l'état, mais on filtre sur l'identifiant", () => {
    // Garde-fou du choix d'architecture : un identifiant stable ne contient
    // jamais de virgule, contrairement à certains libellés d'installation.
    const p = new URLSearchParams();
    toParam(p, PARAM, ["Case, boulodrome et terrain Pausé"]);
    // La virgule du libellé casserait la relecture — d'où `groupKey`.
    expect(fromParam(p.get(PARAM))).toEqual(["Case", "boulodrome et terrain Pausé"]);
  });
});
