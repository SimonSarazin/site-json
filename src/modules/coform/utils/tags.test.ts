import { describe, expect, it } from "vitest";
import {
  addTags,
  filterLocalTags,
  normalizeTagsValue,
  parseSearchTagsResponse,
  removeTag,
  splitTagInput,
} from "./tags";

/**
 * Tests des helpers du champ `tags` (`tpls.forms.tags`).
 *
 * Les fixtures sont issues de la base réelle (`pixelhumain1`, 2026-08-19),
 * formulaire « Les communs des CAEs » `677e7e389058e31575550ac8` :
 *  - le vocabulaire partagé `params.tags.list` (82 entrées) ;
 *  - les 2 réponses enregistrées, `["open source"]` et `["peertube"]`.
 */

/** Extrait fidèle de `form.params.tags.list` — casse et doublons de casse d'origine. */
const VOCABULAIRE_CAE = [
  "diagnostique",
  "outils",
  "Foncier",
  "Commun",
  "cartographie",
  "communs",
  "coopération",
  "collaboration",
  "coConstruction",
  "CO-CRÉATION",
  "co-création",
  "communication",
  "communauté",
  "coFinancement",
  "opensource",
  "peertube",
];

describe("parseSearchTagsResponse", () => {
  it("extrait les libellés d'une réponse hétérogène de l'index global", () => {
    // Forme réelle du endpoint : un élément SYNTHÉTIQUE en tête (echo du terme,
    // sans `_id`), puis les documents existants.
    const raw = [
      { tag: "perma" },
      { _id: { $id: "aaaaaaaaaaaaaaaaaaaaaaaa" }, tag: "permaculture", field_length: 12 },
      { _id: { $id: "bbbbbbbbbbbbbbbbbbbbbbbb" }, tag: "permacole", field_length: 9 },
    ];
    expect(parseSearchTagsResponse(raw)).toEqual(["perma", "permaculture", "permacole"]);
  });

  it("ignore un `tag` null — le synthétique le permet quand `q` est absent", () => {
    expect(parseSearchTagsResponse([{ tag: null }, { tag: "ok" }])).toEqual(["ok"]);
  });

  it("déduplique et ignore les entrées non exploitables", () => {
    const raw = [{ tag: "a" }, { tag: " a " }, { tag: "" }, null, "pas un objet", { autre: 1 }];
    expect(parseSearchTagsResponse(raw)).toEqual(["a"]);
  });

  it("tolère une réponse qui n'est pas un tableau", () => {
    expect(parseSearchTagsResponse(null)).toEqual([]);
    expect(parseSearchTagsResponse({ error: "boom" })).toEqual([]);
  });
});

describe("filterLocalTags", () => {
  it("filtre par PRÉFIXE insensible à la casse, comme SearchTagsAction", () => {
    const res = filterLocalTags(VOCABULAIRE_CAE, "co", []);
    expect(res).toContain("Commun");
    expect(res).toContain("coopération");
    expect(res).toContain("CO-CRÉATION");
    // « opensource » CONTIENT "co"… non : il ne commence pas par "co".
    expect(res).not.toContain("opensource");
    // « diagnostique » contient "co" en fin de mot mais ne commence pas par.
    expect(res).not.toContain("diagnostique");
  });

  it("garde distinctes deux entrées qui ne diffèrent que par la casse", () => {
    // Le vocabulaire réel contient bien la paire — le legacy ne les fusionne pas.
    const res = filterLocalTags(VOCABULAIRE_CAE, "co-", []);
    expect(res).toEqual(["CO-CRÉATION", "co-création"]);
  });

  it("retire ce qui est déjà sélectionné", () => {
    const res = filterLocalTags(VOCABULAIRE_CAE, "co", ["coopération", "Commun"]);
    expect(res).not.toContain("coopération");
    expect(res).not.toContain("Commun");
    expect(res).toContain("collaboration");
  });

  it("renvoie tout le vocabulaire quand la requête est vide", () => {
    // `|| empty($q)` côté legacy.
    expect(filterLocalTags(VOCABULAIRE_CAE, "", [])).toHaveLength(VOCABULAIRE_CAE.length);
    expect(filterLocalTags(VOCABULAIRE_CAE, "   ", [])).toHaveLength(VOCABULAIRE_CAE.length);
  });

  it("déduplique — ce que le legacy ne fait PAS (son garde-fou compare deux formes différentes)", () => {
    expect(filterLocalTags(["a", "a", " a ", "b"], "", [])).toEqual(["a", "b"]);
  });

  it("ignore les entrées vides ou non-string du vocabulaire", () => {
    expect(filterLocalTags(["", "  ", "ok", null as unknown as string], "", [])).toEqual(["ok"]);
  });
});

describe("splitTagInput", () => {
  it("découpe sur la virgule, comme `tokenSeparators: [',']`", () => {
    expect(splitTagInput("a, b ,c")).toEqual(["a", "b", "c"]);
  });

  it("ignore les segments vides", () => {
    expect(splitTagInput(",,a,,")).toEqual(["a"]);
    expect(splitTagInput("   ")).toEqual([]);
  });

  it("conserve les espaces internes — « open source » est un tag réel", () => {
    expect(splitTagInput("open source")).toEqual(["open source"]);
  });
});

describe("addTags", () => {
  it("ajoute en préservant l'ordre", () => {
    expect(addTags(["a"], "b, c")).toEqual(["a", "b", "c"]);
  });

  it("n'ajoute pas de doublon", () => {
    expect(addTags(["a", "b"], "b")).toEqual(["a", "b"]);
  });

  it("déduplique aussi À L'INTÉRIEUR d'une même saisie", () => {
    expect(addTags([], "a, a, b")).toEqual(["a", "b"]);
  });

  it("retourne la MÊME référence quand rien n'est ajouté", () => {
    // Ce que consomme le composant pour ne pas déclencher un onChange inutile
    // (et donc un dirty-state parasite sur le formulaire).
    const value = ["a"];
    expect(addTags(value, "a")).toBe(value);
    expect(addTags(value, "   ")).toBe(value);
    expect(addTags(value, "")).toBe(value);
  });
});

describe("removeTag", () => {
  it("retire le tag demandé", () => {
    expect(removeTag(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("retourne la MÊME référence si le tag est absent", () => {
    const value = ["a"];
    expect(removeTag(value, "zzz")).toBe(value);
  });
});

describe("normalizeTagsValue", () => {
  it("accepte les réponses réelles du formulaire CAE", () => {
    expect(normalizeTagsValue(["open source"])).toEqual(["open source"]);
    expect(normalizeTagsValue(["peertube"])).toEqual(["peertube"]);
  });

  it("rattrape une valeur restée en chaîne (avant le split legacy)", () => {
    expect(normalizeTagsValue("a,b")).toEqual(["a", "b"]);
  });

  it("absorbe le `{}` que PHP sérialise à la place d'un tableau vide", () => {
    expect(normalizeTagsValue({})).toEqual([]);
    expect(normalizeTagsValue(undefined)).toEqual([]);
    expect(normalizeTagsValue(null)).toEqual([]);
  });

  it("ignore les éléments non-string d'un tableau mixte", () => {
    expect(normalizeTagsValue(["a", 42, null, "b"])).toEqual(["a", "b"]);
  });
});
