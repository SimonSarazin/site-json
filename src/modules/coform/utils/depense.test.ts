import { describe, expect, it } from "vitest";
import {
  addDepense,
  isDepenseOpen,
  normalizeDepenseValue,
  removeDepense,
  setDepenseOpen,
  toDepenseAmount,
  updateDepense,
  type DepenseEntry,
} from "./depense";

/**
 * Le fil rouge de ces tests : **rien ne doit jamais perdre les clés hors
 * contrat**. Une dépense réelle porte `financer[]`, `historique[]`, `milestone`…
 * que le champ n'édite pas mais que la soumission renvoie en bloc — le backend
 * remplaçant la clé entière, un strip détruirait la donnée en base.
 */

/** Forme relevée en base : `financer` et `historique` accompagnent la ligne. */
const LIGNE_REELLE: DepenseEntry = {
  poste: "Développement",
  price: 5000,
  date: "2026-01-15T00:00:00+00:00",
  user: "5f3a...",
  milestone: "m-abc123",
  financer: [{ id: "u1", amount: 250 }],
  historique: [{ date: "2026-01-15", from: 4000, to: 5000 }],
};

describe("toDepenseAmount", () => {
  it("accepte nombre, chaîne et virgule décimale", () => {
    expect(toDepenseAmount(12)).toBe(12);
    expect(toDepenseAmount("12")).toBe(12);
    expect(toDepenseAmount("12,7")).toBe(12);
    expect(toDepenseAmount(12.7)).toBe(12);
  });

  it("retombe à 0 sur une valeur inexploitable", () => {
    expect(toDepenseAmount("abc")).toBe(0);
    expect(toDepenseAmount(null)).toBe(0);
    expect(toDepenseAmount(undefined)).toBe(0);
    expect(toDepenseAmount({})).toBe(0);
  });

  it("chaîne FORMATÉE avec espace de milliers : « 1 500,00 » et « 1 500.00 » valent 1500", () => {
    // `Number("1 500.00")` rend NaN — donc 0 : un montant réel disparaissait à
    // la première relecture. 178 réponses portent `price` en chaîne.
    expect(toDepenseAmount("1 500,00")).toBe(1500);
    expect(toDepenseAmount("1 500.00")).toBe(1500);
    expect(toDepenseAmount(" 42 ")).toBe(42);
  });

  it("booléen ⇒ 0, jamais 1 (75 réponses en base)", () => {
    expect(toDepenseAmount(true)).toBe(0);
    expect(toDepenseAmount(false)).toBe(0);
  });
});

describe("normalizeDepenseValue", () => {
  it("préserve les clés hors contrat", () => {
    const [n] = normalizeDepenseValue([LIGNE_REELLE]);
    expect(n.financer).toEqual([{ id: "u1", amount: 250 }]);
    expect(n.historique).toHaveLength(1);
    expect(n.milestone).toBe("m-abc123");
  });

  it("lit `price` comme un montant de document ; `priceInt` (enveloppe) fait autorité s'il est là", () => {
    // `priceInt` n'est stocké sur aucun document — il ne vient que d'une
    // réponse d'enveloppe, où il fait autorité (`priceInt ?? price`).
    expect(normalizeDepenseValue([{ poste: "x", price: 10, priceInt: 42 }])[0].price).toBe(42);
    expect(normalizeDepenseValue([{ poste: "x", price: "80" }])[0].price).toBe(80);
    // Les formes réelles de `price` sur un document : chaîne formatée, booléen.
    expect(normalizeDepenseValue([{ poste: "x", price: "1 500,00" }])[0].price).toBe(1500);
    expect(normalizeDepenseValue([{ poste: "x", price: true }])[0].price).toBe(0);
  });

  it("absorbe le `{}` que PHP sérialise pour un tableau vide", () => {
    expect(normalizeDepenseValue({})).toEqual([]);
    expect(normalizeDepenseValue(null)).toEqual([]);
    expect(normalizeDepenseValue(undefined)).toEqual([]);
  });

  it("ignore les éléments non exploitables", () => {
    expect(normalizeDepenseValue(["x", 42, null, { poste: "ok", price: 1 }])).toHaveLength(1);
  });

  it("comble un poste manquant sans jeter la ligne", () => {
    const [n] = normalizeDepenseValue([{ price: 3, financer: [] }]);
    expect(n.poste).toBe("");
    expect(n.price).toBe(3);
  });
});

describe("isDepenseOpen", () => {
  it("actif tant que `include` n'est pas explicitement false", () => {
    expect(isDepenseOpen({ poste: "a", price: 0 })).toBe(true);
    expect(isDepenseOpen({ poste: "a", price: 0, include: true })).toBe(true);
    expect(isDepenseOpen({ poste: "a", price: 0, include: false })).toBe(false);
  });
});

describe("addDepense", () => {
  it("ajoute en fin de liste", () => {
    const r = addDepense([LIGNE_REELLE], { poste: "Hébergement", price: 300, milestone: "m-2" });
    expect(r).toHaveLength(2);
    expect(r[1].poste).toBe("Hébergement");
    expect(r[1].milestone).toBe("m-2");
    expect(r[1].financer).toEqual([]);
  });

  it("trime le libellé et refuse une ligne sans libellé", () => {
    expect(addDepense([], { poste: "  A  ", price: 1, milestone: "m" })[0].poste).toBe("A");
    const liste: DepenseEntry[] = [];
    expect(addDepense(liste, { poste: "   ", price: 1, milestone: "m" })).toBe(liste);
  });

  it("ne touche pas les lignes existantes", () => {
    const r = addDepense([LIGNE_REELLE], { poste: "B", price: 1, milestone: "m" });
    expect(r[0]).toBe(LIGNE_REELLE);
  });
});

describe("updateDepense", () => {
  it("ne modifie que les clés fournies et préserve le reste", () => {
    const r = updateDepense([LIGNE_REELLE], 0, { price: 7000 });
    expect(r[0].price).toBe(7000);
    expect(r[0].poste).toBe("Développement");
    expect(r[0].financer).toEqual([{ id: "u1", amount: 250 }]);
    expect(r[0].historique).toHaveLength(1);
    expect(r[0].milestone).toBe("m-abc123");
  });

  it("retourne la MÊME référence si rien ne change", () => {
    const liste = [LIGNE_REELLE];
    expect(updateDepense(liste, 0, { poste: "Développement", price: 5000 })).toBe(liste);
  });

  it("retourne la MÊME référence si l'index est hors bornes", () => {
    const liste = [LIGNE_REELLE];
    expect(updateDepense(liste, 5, { price: 1 })).toBe(liste);
    expect(updateDepense(liste, -1, { price: 1 })).toBe(liste);
  });
});

describe("setDepenseOpen", () => {
  it("clôture puis réactive", () => {
    const ferme = setDepenseOpen([LIGNE_REELLE], 0, false);
    expect(ferme[0].include).toBe(false);
    expect(isDepenseOpen(ferme[0])).toBe(false);
    expect(setDepenseOpen(ferme, 0, true)[0].include).toBe(true);
  });

  it("préserve les clés hors contrat", () => {
    expect(setDepenseOpen([LIGNE_REELLE], 0, false)[0].financer).toEqual([{ id: "u1", amount: 250 }]);
  });

  it("retourne la MÊME référence si l'état est déjà celui demandé", () => {
    const liste = [LIGNE_REELLE];
    expect(setDepenseOpen(liste, 0, true)).toBe(liste);
  });
});

describe("removeDepense", () => {
  it("retire la ligne visée", () => {
    const liste = [LIGNE_REELLE, { poste: "B", price: 1 }];
    expect(removeDepense(liste, 0)).toEqual([{ poste: "B", price: 1 }]);
  });

  it("retourne la MÊME référence hors bornes", () => {
    const liste = [LIGNE_REELLE];
    expect(removeDepense(liste, 9)).toBe(liste);
  });
});

describe("round-trip complet", () => {
  it("une ligne réelle traverse ajout, édition, clôture et suppression sans rien perdre", () => {
    let l = normalizeDepenseValue([LIGNE_REELLE]);
    l = addDepense(l, { poste: "Hébergement", price: 300, milestone: "m-2" });
    l = updateDepense(l, 0, { price: 6000 });
    l = setDepenseOpen(l, 1, false);
    expect(l[0]).toMatchObject({
      poste: "Développement",
      price: 6000,
      milestone: "m-abc123",
      financer: [{ id: "u1", amount: 250 }],
    });
    expect(l[0].historique).toHaveLength(1);
    expect(l[1]).toMatchObject({ poste: "Hébergement", include: false });
    expect(removeDepense(l, 1)).toHaveLength(1);
  });
});
