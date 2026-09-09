import { describe, it, expect } from "vitest";
import { tallyVotes, getMyVote, toVote, getMinimumVotes, POUR, NEUTRE, CONTRE } from "./pourContre";

describe("toVote", () => {
  it("accepte les chaînes réellement stockées", () => {
    // Relevé : les 11 réponses en base stockent des CHAÎNES.
    expect(toVote("1")).toBe(POUR);
    expect(toVote("0")).toBe(NEUTRE);
    expect(toVote("-1")).toBe(CONTRE);
  });

  it("tolère un nombre, rejette le reste", () => {
    expect(toVote(1)).toBe(POUR);
    expect(toVote(-1)).toBe(CONTRE);
    expect(toVote("")).toBeNull();
    expect(toVote("2")).toBeNull();
    expect(toVote(null)).toBeNull();
  });
});

describe("tallyVotes — le legacy MULTIPLIE là où il faut diviser", () => {
  it("calcule la vraie part", () => {
    // 2 pour sur 3 → 67 %. Le legacy afficherait 2 × 3 × 100 = 600 %.
    const t = tallyVotes({ a: "1", b: "1", c: "-1" });
    expect(t).toMatchObject({ pour: 2, contre: 1, neutre: 0, total: 3 });
    expect(t.pourPct).toBe(67);
    expect(t.contrePct).toBe(33);
    expect(t.pourPct + t.neutrePct + t.contrePct).toBe(100);
  });

  it("les parts somment toujours à 100, même avec des arrondis fâcheux", () => {
    // 3 votants → 33,33 % chacun : sans compensation, la somme ferait 99.
    const t = tallyVotes({ a: "1", b: "0", c: "-1" });
    expect(t.pourPct + t.neutrePct + t.contrePct).toBe(100);
  });

  it("garde le garde-fou legacy : ni pour ni contre → neutre à 100 %", () => {
    expect(tallyVotes({ a: "0", b: "0" })).toMatchObject({ neutrePct: 100, total: 2 });
  });

  it("aucun vote : 100 % neutre et total nul, sans division par zéro", () => {
    expect(tallyVotes({})).toMatchObject({ total: 0, neutrePct: 100, pourPct: 0 });
    expect(tallyVotes(null)).toMatchObject({ total: 0, neutrePct: 100 });
  });

  it("ignore une entrée qui n'est pas un vote — total = somme des parts", () => {
    // Le legacy compte `count()` de TOUTES les entrées : son total pouvait
    // dépasser la somme des trois catégories, rendant les parts incohérentes.
    const t = tallyVotes({ a: "1", b: "", c: "n'importe quoi" });
    expect(t.total).toBe(1);
    expect(t.pour + t.neutre + t.contre).toBe(t.total);
  });
});

describe("getMyVote — le legacy écrase son résultat en cours de boucle", () => {
  it("retrouve mon vote quelle que soit sa position", () => {
    // Le legacy remet `$myVote` à "" pour chaque entrée d'un AUTRE évaluateur :
    // mon vote ne s'affichait que s'il était le dernier parcouru.
    const votes = { moi: "1", autre1: "0", autre2: "-1" };
    expect(getMyVote(votes, "moi")).toBe(POUR);
  });

  it("null quand je n'ai pas voté, ou sans utilisateur", () => {
    expect(getMyVote({ autre: "1" }, "moi")).toBeNull();
    expect(getMyVote({ moi: "1" }, null)).toBeNull();
    expect(getMyVote(null, "moi")).toBeNull();
  });
});

describe("getMinimumVotes — le legacy lit `$amswer`, une coquille", () => {
  it("lit la valeur configurée", () => {
    expect(getMinimumVotes({ pourContre: { minimumVotes: "70%" } })).toBe("70%");
    expect(getMinimumVotes({ pourContre: { minimumVotes: "70" } })).toBe("70%");
    expect(getMinimumVotes({ pourContre: { minimumVotes: 70 } })).toBe("70%");
  });

  it("renvoie null quand rien n'est configuré — pas le « 50% » du legacy", () => {
    // Ce « 50% » est le repli d'une lecture qui échoue TOUJOURS (coquille
    // `$amswer`), pas un défaut métier : le reconduire afficherait un seuil
    // inventé. L'appelant n'affiche alors pas la ligne.
    expect(getMinimumVotes(undefined)).toBeNull();
    expect(getMinimumVotes({})).toBeNull();
    expect(getMinimumVotes({ pourContre: { minimumVotes: "  " } })).toBeNull();
  });
});
