import { describe, expect, it } from "vitest";
import {
  CARRIER_NONE,
  carrierKey,
  parseDiscussions,
  errorCodeOf,
  refusalOf,
  sortThreads,
  threadsOfCarrier,
  totalUnread,
} from "./discussions";
import type { DiscussionThread } from "../types";

const ORG = "65a1000000000000000000a1";
const PROJ = "65a1000000000000000000a2";
const ACT = "65b2000000000000000000b1";
const NEWS = "65b2000000000000000000b2";

const railReponse = {
  result: true,
  depth: "rail",
  limit: 200,
  truncated: false,
  carriers: [
    { id: ORG, type: "organizations", name: "Une orga", slug: "orga", image: null, threads: 2, total: 5, unread: 1, last: 1758000000, mine: false },
    { id: null, type: null, name: null, slug: null, image: null, threads: 1, total: 3, unread: 0, last: 1757000000, mine: true },
  ],
};

const filsReponse = {
  result: true,
  depth: "fils",
  limit: 200,
  truncated: true,
  carriers: railReponse.carriers,
  threads: [
    { key: `actions:${ACT}`, contextType: "actions", contextId: ACT, path: null, title: "Une action", carrier: { type: "projects", id: PROJ }, total: 4, unread: 0, last: 1758000100, mine: true },
    { key: `news:${NEWS}`, contextType: "news", contextId: NEWS, path: null, title: "Une actu", carrier: { type: "organizations", id: ORG }, total: 2, unread: 2, last: 1757000000, mine: false },
  ],
};

describe("refusalOf", () => {
  it("lit le refus rendu en HTTP 200 — c'est `result`, jamais le code HTTP, qui fait foi", () => {
    expect(refusalOf({ result: false, code: "login", msg: "Vous devez être connecté." })).toBe("login");
  });

  it("rend un CODE, jamais le texte du serveur — c'est l'écran qui traduit", () => {
    expect(refusalOf({ result: false, code: "hidden", msg: "Discussion introuvable…" })).toBe("hidden");
  });

  it("un refus sans code connu devient `refused`, plutôt que null ou un texte brut", () => {
    expect(refusalOf({ result: false })).toBe("refused");
    expect(refusalOf({ result: false, code: "bad-request", msg: "Le mode `fil` exige…" })).toBe("refused");
  });

  it("laisse passer une réponse valide", () => {
    expect(refusalOf(railReponse)).toBeNull();
  });

  it.each([[null], [undefined], ["texte"], [{}], [{ result: "true" }]])(
    "traite %p comme illisible plutôt que d'exploser", value => {
      expect(refusalOf(value)).toBe("unreadable");
    });
});

describe("errorCodeOf", () => {
  it("rend le code porté par l'erreur de refus que lève `parseDiscussions`", () => {
    let erreur: unknown = null;
    try { parseDiscussions({ result: false, code: "hidden" }); } catch (e) { erreur = e; }
    expect(errorCodeOf(erreur)).toBe("hidden");
  });

  it("une erreur sans marque de refus (réseau, 500) est un échec, pas un refus", () => {
    expect(errorCodeOf(new Error("Network Error"))).toBe("failed");
    expect(errorCodeOf(null)).toBe("failed");
  });
});

describe("parseDiscussions", () => {
  it("lève sur un refus, pour que React Query en fasse une erreur et non un panneau vide et muet", () => {
    let erreur: unknown = null;
    try { parseDiscussions({ result: false, code: "login", msg: "Non connecté" }); } catch (e) { erreur = e; }
    expect(erreur).toBeInstanceOf(Error);
    // Marquée « refus » (React Query ne la retente pas) et porteuse d'un CODE, que l'écran traduit.
    expect(erreur).toMatchObject({ refus: true, code: "login" });
  });

  it("lit le rail : les porteurs, sans fils", () => {
    const r = parseDiscussions(railReponse);
    expect(r.depth).toBe("rail");
    expect(r.carriers).toHaveLength(2);
    expect(r.threads).toEqual([]);
    expect(r.carriers[0]).toMatchObject({ id: ORG, type: "organizations", threads: 2, unread: 1 });
  });

  it("garde le groupe « sans porteur » au lieu de le jeter — 52 % des forms sont dans ce cas", () => {
    const sansPorteur = parseDiscussions(railReponse).carriers.find(c => c.id === null);
    expect(sansPorteur).toBeDefined();
    expect(sansPorteur!.type).toBeNull();
    expect(sansPorteur!.threads).toBe(1);
  });

  it("lit les fils et leur porteur", () => {
    const r = parseDiscussions(filsReponse);
    expect(r.depth).toBe("fils");
    expect(r.truncated).toBe(true);
    expect(r.threads).toHaveLength(2);
    expect(r.threads[0].target).toEqual({ type: "actions", id: ACT, path: null });
    expect(r.threads[0].carrier).toEqual({ type: "projects", id: PROJ });
  });

  it("lit le mode `fil`, dont la forme est au SINGULIER et porte `canComment`", () => {
    const r = parseDiscussions({
      result: true, depth: "fil", canComment: false,
      thread: filsReponse.threads[0],
      carrier: railReponse.carriers[0],
    });
    expect(r.depth).toBe("fil");
    expect(r.threads).toHaveLength(1);
    expect(r.carriers).toHaveLength(1);
    expect(r.canComment).toBe(false);
  });

  it("laisse `canComment` à null hors du mode `fil` — l'absence de réponse n'est pas un « non »", () => {
    expect(parseDiscussions(railReponse).canComment).toBeNull();
  });

  it("garde le `path`, qui distingue deux fils du MÊME document de formulaire", () => {
    const chemin = "65a1.65a2.question_abc.comment";
    const r = parseDiscussions({
      result: true, depth: "fils", carriers: [], truncated: false,
      threads: [{ contextType: "forms", contextId: ORG, path: chemin, total: 1, unread: 0, last: 1, mine: false }],
    });
    expect(r.threads[0].target.path).toBe(chemin);
    expect(r.threads[0].key).toBe(`forms:${ORG}:${chemin}`);
  });

  it("écarte un fil dont le type n'est pas commentable, sans faire tomber les autres", () => {
    const r = parseDiscussions({
      result: true, depth: "fils", carriers: [], truncated: false,
      threads: [
        { contextType: "users", contextId: ORG, total: 1, unread: 0, last: 1, mine: false },
        filsReponse.threads[0],
      ],
    });
    expect(r.threads).toHaveLength(1);
    expect(r.threads[0].target.type).toBe("actions");
  });

  it("écarte un porteur dont le type sort de la liste blanche", () => {
    const r = parseDiscussions({
      result: true, depth: "rail", carriers: [{ id: ORG, type: "badges", threads: 1, total: 1, unread: 0, last: 1, mine: false }],
    });
    expect(r.carriers).toEqual([]);
  });

  it("accepte `cities` comme PORTEUR alors qu'il n'est pas commentable — une action peut avoir une ville pour parent", () => {
    const r = parseDiscussions({
      result: true, depth: "rail",
      carriers: [{ id: ORG, type: "cities", name: "Une ville", threads: 1, total: 1, unread: 0, last: 1, mine: false }],
    });
    expect(r.carriers).toHaveLength(1);
    expect(r.carriers[0].type).toBe("cities");
  });

  it("remplace les compteurs absents par 0 plutôt que par NaN", () => {
    const r = parseDiscussions({
      result: true, depth: "fils", carriers: [], truncated: false,
      threads: [{ contextType: "news", contextId: NEWS }],
    });
    expect(r.threads[0]).toMatchObject({ total: 0, unread: 0, last: null, mine: false, title: null });
  });
});

describe("carrierKey", () => {
  it("rend une clé stable", () => {
    expect(carrierKey({ type: "organizations", id: ORG })).toBe(`organizations:${ORG}`);
  });

  it("range les fils orphelins sous une clé unique plutôt que sous « undefined »", () => {
    expect(carrierKey(null)).toBe(CARRIER_NONE);
    expect(carrierKey({ id: null, type: null } as never)).toBe(CARRIER_NONE);
  });
});

const fil = (over: Partial<DiscussionThread>): DiscussionThread => ({
  key: "k", target: { type: "news", id: NEWS, path: null }, title: null,
  carrier: null, total: 0, unread: 0, last: 0, mine: false, virtual: false, ...over,
});

describe("sortThreads", () => {
  it("met les non-lus devant, quelle que soit leur date", () => {
    const ordre = sortThreads([
      fil({ key: "récent-lu", unread: 0, last: 2000 }),
      fil({ key: "ancien-non-lu", unread: 3, last: 1000 }),
    ]).map(t => t.key);
    expect(ordre).toEqual(["ancien-non-lu", "récent-lu"]);
  });

  it("à égalité de non-lus, classe par dernière activité décroissante", () => {
    const ordre = sortThreads([
      fil({ key: "vieux", last: 1000 }),
      fil({ key: "neuf", last: 3000 }),
      fil({ key: "moyen", last: 2000 }),
    ]).map(t => t.key);
    expect(ordre).toEqual(["neuf", "moyen", "vieux"]);
  });

  it("traite une date absente comme la plus ancienne, sans NaN", () => {
    const ordre = sortThreads([fil({ key: "sans-date", last: null }), fil({ key: "daté", last: 1 })]).map(t => t.key);
    expect(ordre).toEqual(["daté", "sans-date"]);
  });

  it("ne mute pas le tableau reçu", () => {
    const source = [fil({ key: "a", last: 1 }), fil({ key: "b", last: 2 })];
    sortThreads(source);
    expect(source.map(t => t.key)).toEqual(["a", "b"]);
  });
});

describe("threadsOfCarrier", () => {
  const threads = parseDiscussions(filsReponse).threads;

  it("filtre sur le porteur demandé", () => {
    const r = threadsOfCarrier(threads, `organizations:${ORG}`);
    expect(r).toHaveLength(1);
    expect(r[0].target.type).toBe("news");
  });

  it("rend tout, trié, quand aucun porteur n'est demandé", () => {
    expect(threadsOfCarrier(threads, null)).toHaveLength(2);
  });

  it("retrouve les fils orphelins par la clé « none »", () => {
    const orphelin = fil({ key: "orphelin", carrier: null });
    expect(threadsOfCarrier([orphelin, ...threads], CARRIER_NONE)).toEqual([orphelin]);
  });
});

describe("totalUnread", () => {
  it("additionne les non-lus de tous les porteurs", () => {
    expect(totalUnread(parseDiscussions(railReponse).carriers)).toBe(1);
  });

  it("rend 0 sur un rail vide", () => {
    expect(totalUnread([])).toBe(0);
  });
});
