import { describe, expect, it } from "vitest";

import {
  findListLabel,
  isSamePermutation,
  prepareNewListKey,
  prepareNewValue,
  prepareRenamedValue,
  removeValueAt,
  toListRef,
} from "./costumListsEditing";

describe("prepareNewValue", () => {
  it("accepte une valeur inédite et la trime", () => {
    expect(prepareNewValue("  Pêche  ", ["Chasse"])).toEqual({ ok: true, value: "Pêche" });
  });

  it("rejette une valeur vide ou blanche", () => {
    expect(prepareNewValue("", ["a"])).toEqual({ ok: false, reason: "empty" });
    expect(prepareNewValue("   ", ["a"])).toEqual({ ok: false, reason: "empty" });
  });

  it("rejette un doublon casse/accents près", () => {
    expect(prepareNewValue("peche", ["Pêche"])).toEqual({ ok: false, reason: "duplicate" });
    expect(prepareNewValue("PECHE", ["Pêche"])).toEqual({ ok: false, reason: "duplicate" });
  });
});

describe("prepareRenamedValue", () => {
  const existing = ["Pêche", "Chasse", "Randonnée"];

  it("renomme l'entrée à l'index donné et renvoie le tableau complet", () => {
    expect(prepareRenamedValue("Voile", 1, existing)).toEqual({
      ok: true,
      value: ["Pêche", "Voile", "Randonnée"],
    });
  });

  it("autorise un renommage vers sa propre valeur à la casse/aux accents près", () => {
    expect(prepareRenamedValue("peche", 0, existing)).toEqual({
      ok: true,
      value: ["peche", "Chasse", "Randonnée"],
    });
  });

  it("rejette une collision avec une AUTRE entrée existante", () => {
    expect(prepareRenamedValue("chasse", 0, existing)).toEqual({ ok: false, reason: "duplicate" });
  });

  it("rejette une valeur vide", () => {
    expect(prepareRenamedValue("  ", 0, existing)).toEqual({ ok: false, reason: "empty" });
  });

  it("rejette un index hors bornes", () => {
    expect(prepareRenamedValue("Voile", -1, existing)).toEqual({ ok: false, reason: "invalidIndex" });
    expect(prepareRenamedValue("Voile", 3, existing)).toEqual({ ok: false, reason: "invalidIndex" });
  });
});

describe("removeValueAt", () => {
  const existing = ["a", "b", "c"];

  it("retire l'entrée au bon index et préserve l'ordre des autres", () => {
    expect(removeValueAt(existing, 1)).toEqual(["a", "c"]);
  });

  it("renvoie une copie inchangée si l'index est hors bornes", () => {
    expect(removeValueAt(existing, 5)).toEqual(["a", "b", "c"]);
    expect(removeValueAt(existing, -1)).toEqual(["a", "b", "c"]);
  });
});

describe("isSamePermutation", () => {
  it("accepte un même tableau réordonné", () => {
    expect(isSamePermutation(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });

  it("accepte deux tableaux vides", () => {
    expect(isSamePermutation([], [])).toBe(true);
  });

  it("rejette une longueur différente", () => {
    expect(isSamePermutation(["a", "b"], ["a"])).toBe(false);
  });

  it("rejette un élément dupliqué en plus", () => {
    expect(isSamePermutation(["a", "b"], ["a", "a"])).toBe(false);
  });

  it("rejette un élément manquant remplacé par un autre", () => {
    expect(isSamePermutation(["a", "b"], ["a", "c"])).toBe(false);
  });
});

describe("prepareNewListKey", () => {
  it("accepte un nom valide et le trime", () => {
    expect(prepareNewListKey("  themes  ", ["publics"])).toEqual({ ok: true, value: "themes" });
  });

  it("rejette un nom vide", () => {
    expect(prepareNewListKey("", ["publics"])).toEqual({ ok: false, reason: "empty" });
  });

  it("rejette un nom contenant un point (casserait le dot-path Mongo)", () => {
    expect(prepareNewListKey("a.b", [])).toEqual({ ok: false, reason: "invalidChars" });
  });

  it("rejette un nom contenant un $", () => {
    expect(prepareNewListKey("a$b", [])).toEqual({ ok: false, reason: "invalidChars" });
  });

  it("rejette un doublon casse/accents près contre les clés existantes", () => {
    expect(prepareNewListKey("Themes", ["themes"])).toEqual({ ok: false, reason: "duplicate" });
  });
});

describe("toListRef", () => {
  it("enveloppe une clé brute (string) en {key}", () => {
    expect(toListRef("themes")).toEqual({ key: "themes" });
  });

  it("laisse passer une entrée déjà {key,label} telle quelle", () => {
    const ref = { key: "categoriesParole", label: { fr: "Catégories des paroles" } };
    expect(toListRef(ref)).toBe(ref);
  });
});

describe("findListLabel", () => {
  const whitelist = [
    { key: "themes", label: { fr: "Thèmes", en: "Topics" } },
    { key: "categoriesParole" }, // pas de label déclaré
  ];

  it("renvoie le label déclaré pour la clé", () => {
    expect(findListLabel("themes", whitelist)).toEqual({ fr: "Thèmes", en: "Topics" });
  });

  it("renvoie undefined si la clé n'a pas de label (l'appelant retombe sur la clé brute)", () => {
    expect(findListLabel("categoriesParole", whitelist)).toBeUndefined();
  });

  it("renvoie undefined si la clé n'est pas dans la whitelist", () => {
    expect(findListLabel("publics", whitelist)).toBeUndefined();
  });

  it("renvoie undefined sans whitelist (mode « toutes les clés »)", () => {
    expect(findListLabel("themes", undefined)).toBeUndefined();
  });
});
