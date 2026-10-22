import { describe, expect, it } from "vitest";
import {
  formatDiscussionValue, messageAnchorId, parseDiscussionValue, parseMessageFragment,
  sameTarget, threadValue,
} from "./filKey";

const ID = "65a1b2c3d4e5f60718293a4b";
const ID2 = "65b0c1d2e3f405162738495a";

describe("parseDiscussionValue", () => {
  it("lit un fil sur l'entité entière", () => {
    expect(parseDiscussionValue(`organizations:${ID}`))
      .toEqual({ kind: "thread", target: { type: "organizations", id: ID, path: null } });
  });

  it("lit un fil sur un champ précis", () => {
    expect(parseDiscussionValue(`actions:${ID}:aapStep1`))
      .toEqual({ kind: "thread", target: { type: "actions", id: ID, path: "aapStep1" } });
  });

  it("lit un porteur seul, préfixé par @", () => {
    expect(parseDiscussionValue(`@projects:${ID2}`)).toEqual({ kind: "holder", type: "projects", id: ID2 });
  });

  it("accepte une VILLE comme porteur, alors qu'elle n'est pas commentable", () => {
    // Mesuré : `actions.parentType` vaut cities, citoyens, events, organizations ou projects.
    // Valider le porteur avec la liste des types COMMENTABLES ferait disparaître de l'URL —
    // donc du panneau — tout fil rattaché à une ville.
    expect(parseDiscussionValue(`@cities:${ID2}`)).toEqual({ kind: "holder", type: "cities", id: ID2 });
  });

  it("refuse un porteur d'un type qui ne porte jamais rien", () => {
    // `news` reçoit des fils mais n'en porte pas : ce n'est pas un porteur.
    expect(parseDiscussionValue(`@news:${ID2}`)).toEqual({ kind: "none" });
    expect(parseDiscussionValue(`@badges:${ID2}`)).toEqual({ kind: "none" });
  });

  it("refuse une VILLE comme cible de FIL — l'asymétrie va dans les deux sens", () => {
    expect(parseDiscussionValue(`cities:${ID2}`)).toEqual({ kind: "none" });
  });

  it("lit la demande explicite « tout »", () => {
    expect(parseDiscussionValue("all")).toEqual({ kind: "all" });
  });

  it("rend « none » sur une valeur absente ou vide", () => {
    for (const v of [null, undefined, "", "   "]) expect(parseDiscussionValue(v)).toEqual({ kind: "none" });
  });

  it("refuse un type d'entité qui ne porte pas de commentaires", () => {
    expect(parseDiscussionValue(`badges:${ID}`)).toEqual({ kind: "none" });
    expect(parseDiscussionValue(`comments:${ID}`)).toEqual({ kind: "none" });
    expect(parseDiscussionValue(`inventé:${ID}`)).toEqual({ kind: "none" });
  });

  it("refuse un identifiant qui n'est pas un ObjectId", () => {
    for (const bad of ["abc", "65a1", `${ID}0`, "../../etc/passwd", "65A1B2C3D4E5F60718293A4B"])
      expect(parseDiscussionValue(`organizations:${bad}`)).toEqual({ kind: "none" });
  });

  it("ne se laisse pas dérouter par une valeur hostile, et ne lève jamais", () => {
    const hostiles = [
      "organizations:<script>alert(1)</script>",
      `organizations:${ID}:../../secret`,
      `organizations:${ID}:a b`,
      `organizations:${ID}:${"x".repeat(300)}`,
      `@organizations:${ID}:trop`,
      `organizations:${ID}:a:b:c`,
      "@all", ":::", "@",
    ];
    for (const v of hostiles) expect(() => parseDiscussionValue(v)).not.toThrow();
    // On nomme la valeur fautive : sinon un échec ici n'apprend rien.
    for (const v of hostiles) expect(parseDiscussionValue(v).kind, `valeur : ${v}`).toBe("none");
  });

  it("tolère les espaces autour de la valeur", () => {
    expect(parseDiscussionValue(`  poi:${ID}  `).kind).toBe("thread");
  });

  it("accepte un chemin pointé long, tel qu'il existe réellement en base", () => {
    // Mesuré : les `path` du parc sont des chemins pointés de ~190 caractères.
    const reel = "6371fd003205405ce32ae1b8.637c7197588c83203b303c95.68788b02c016d131c60ede04"
      + ".openOrganisation22112022_752_0larv1u2uoyt62l25ip"
      + ".question_openOrganisation22112022_752_0larv1u2uoyt62l25ip.comment";
    const lu = parseDiscussionValue(`forms:${ID}:${reel}`);
    expect(lu).toEqual({ kind: "thread", target: { type: "forms", id: ID, path: reel } });
  });
});

describe("formatDiscussionValue — aller-retour", () => {
  it("redonne exactement la valeur lue", () => {
    for (const v of [`organizations:${ID}`, `actions:${ID}:aapStep1`, `@projects:${ID2}`, "all"])
      expect(formatDiscussionValue(parseDiscussionValue(v))).toBe(v);
  });

  it("rend null pour « aucune sélection », ce qui retire le paramètre de l'URL", () => {
    expect(formatDiscussionValue({ kind: "none" })).toBeNull();
  });

  it("threadValue omet le path quand il n'y en a pas", () => {
    expect(threadValue({ type: "news", id: ID })).toBe(`news:${ID}`);
    expect(threadValue({ type: "news", id: ID, path: "x" })).toBe(`news:${ID}:x`);
  });
});

describe("sameTarget", () => {
  it("distingue un fil d'entité d'un fil de champ", () => {
    expect(sameTarget({ type: "news", id: ID }, { type: "news", id: ID, path: null })).toBe(true);
    expect(sameTarget({ type: "news", id: ID }, { type: "news", id: ID, path: "x" })).toBe(false);
    expect(sameTarget({ type: "news", id: ID }, { type: "poi", id: ID })).toBe(false);
  });

  it("gère les absences sans lever", () => {
    expect(sameTarget(null, null)).toBe(true);
    expect(sameTarget(null, { type: "news", id: ID })).toBe(false);
  });
});

describe("fragment de message", () => {
  it("fait l'aller-retour", () => {
    expect(parseMessageFragment(`#${messageAnchorId(ID)}`)).toBe(ID);
    expect(parseMessageFragment(messageAnchorId(ID))).toBe(ID);
  });

  it("rend null sur un fragment étranger ou mal formé", () => {
    for (const v of [null, undefined, "", "#section-2", "#m-", "#m-abc", "#m-../x"])
      expect(parseMessageFragment(v)).toBeNull();
  });
});
