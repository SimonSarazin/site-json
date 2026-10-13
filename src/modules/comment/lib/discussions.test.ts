import { describe, expect, it } from "vitest";
import cocolightApiClient from "@communecter/cocolight-api-client";
import {
  CARRIER_NONE,
  assertGranted,
  carrierKey,
  parseDiscussions,
  errorCodeOf,
  errorLabelKey,
  isRefusalCode,
  rawOrRefusal,
  refusalError,
  refusalOf,
  sortThreads,
  threadsOfCarrier,
  totalUnread,
  unreadableError,
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

  // Un refus, c'est le serveur qui a dit non. Un corps qui n'est pas celui d'une réponse n'en dit rien.
  it.each([[null], [undefined], ["texte"], [42], [{}], [{ result: "true" }], [{ result: "false" }], [{ result: 0 }], [{ code: "hidden" }]])(
    "ne lit pas un refus dans %p", value => {
      expect(refusalOf(value)).toBeNull();
    });
});

describe("assertGranted", () => {
  const leve = (raw: unknown): unknown => {
    try { assertGranted(raw); } catch (erreur) { return erreur; }
    return null;
  };

  it("laisse passer une réponse accordée — et elle seule", () => {
    expect(leve(railReponse)).toBeNull();
    expect(leve({ result: true })).toBeNull();
  });

  it("lève un refus MARQUÉ, avec son code", () => {
    expect(leve({ result: false, code: "hidden" })).toMatchObject({ refus: true, code: "hidden" });
    expect(leve({ result: false })).toMatchObject({ refus: true, code: "refused" });
  });

  it.each([[null], [undefined], ["<html>Maintenance</html>"], [42], [{}], [{ result: "true" }], [{ result: 1 }], [[]]])(
    "lève une réponse ILLISIBLE sur %p — qui n'est pas un refus, et n'en porte pas la marque", value => {
      const erreur = leve(value);
      expect(erreur).toBeInstanceOf(Error);
      expect(erreur).toMatchObject({ refus: false, code: "unreadable" });
      expect(errorCodeOf(erreur)).toBe("unreadable");
      expect(isRefusalCode(errorCodeOf(erreur))).toBe(false);
    });
});

describe("isRefusalCode", () => {
  it("un refus : `login`, `hidden`, `refused` — le serveur a répondu, et il a dit non", () => {
    expect((["login", "hidden", "refused"] as const).map(isRefusalCode)).toEqual([true, true, true]);
  });

  it("une panne : réponse illisible, échec — et l'absence d'erreur n'est pas un refus", () => {
    expect(isRefusalCode("unreadable")).toBe(false);
    expect(isRefusalCode("failed")).toBe(false);
    expect(isRefusalCode(null)).toBe(false);
  });
});

/**
 * Les erreurs sont celles du SDK, construites par SES classes : c'est leur forme réelle que
 * `rawOrRefusal` doit reconnaître, pas celle d'une doublure écrite pour lui plaire.
 */
describe("rawOrRefusal", () => {
  const { ApiAuthenticationError, ApiResponseError, ApiValidationError } = cocolightApiClient.error;

  it("rend la réponse telle quelle quand l'appel aboutit", async () => {
    await expect(rawOrRefusal(async () => railReponse)).resolves.toBe(railReponse);
  });

  it("rend le CORPS du refus que le SDK lève — il ne le rend jamais en valeur de retour", async () => {
    const corps = { result: false, code: "hidden", msg: "Discussion introuvable…" };
    const raw = await rawOrRefusal(async () => { throw new ApiResponseError(corps.msg, 200, corps); });
    expect(raw).toBe(corps);
    expect(refusalOf(raw)).toBe("hidden");
  });

  it("sans session, le SDK refuse lui-même : c'est un refus `login`, pas une panne", async () => {
    const raw = await rawOrRefusal(async () => {
      throw new ApiAuthenticationError("Vous devez être connecté pour effectuer cette action.", 401);
    });
    expect(refusalOf(raw)).toBe("login");
  });

  it.each([
    ["une panne de réseau", new Error("Network Error")],
    ["une requête que le schéma refuse", new ApiValidationError("Request validation failed.", 400, ["contextType"])],
    // Le SDK lève aussi sur `resultErrors.result === false` : ce corps-là n'est pas un refus de l'endpoint.
    ["une erreur métier dont le corps n'est pas un refus", new ApiResponseError("Erreur inconnue", 200, { result: true, resultErrors: { result: false } })],
    ["une erreur sans corps", new ApiResponseError("Erreur inconnue", 200, null as unknown as object)],
  ])("laisse %s en exception — la MÊME, pas une copie", async (_cas, erreur) => {
    await expect(rawOrRefusal(async () => { throw erreur; })).rejects.toBe(erreur);
    expect(errorCodeOf(erreur)).toBe("failed");
  });

  it("ne lève pas sur ce qui n'est pas une erreur", async () => {
    await expect(rawOrRefusal(async () => { throw null; })).rejects.toBeNull();
  });
});

describe("errorLabelKey", () => {
  it("donne à chaque code sa clé de libellé — et à `login` une invitation, pas un constat d'échec", () => {
    expect(errorLabelKey("login")).toBe("panel.loginRequired");
    expect((["hidden", "refused", "unreadable", "failed"] as const).map(errorLabelKey))
      .toEqual(["panel.error.hidden", "panel.error.refused", "panel.error.unreadable", "panel.error.failed"]);
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

  it("rend à chaque erreur du module son code, et à elle seule", () => {
    expect(errorCodeOf(refusalError("login"))).toBe("login");
    expect(errorCodeOf(unreadableError())).toBe("unreadable");
    // Ni la marque sans le code, ni le code sans la marque : une erreur venue d'ailleurs reste un échec.
    expect(errorCodeOf({ refus: false, code: "hidden" })).toBe("failed");
    expect(errorCodeOf({ code: "unreadable" })).toBe("failed");
    expect(errorCodeOf({ refus: true })).toBe("failed");
    expect(errorCodeOf({ refus: "oui", code: "hidden" })).toBe("failed");
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

  it("lève aussi sur un corps illisible — sans la marque de refus : c'est une panne, qui se réessaie", () => {
    let erreur: unknown = null;
    try { parseDiscussions("<html>Erreur</html>"); } catch (e) { erreur = e; }
    expect(erreur).toMatchObject({ refus: false, code: "unreadable" });
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
