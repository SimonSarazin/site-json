import { describe, expect, it } from "vitest";
import {
  OPTIMISTIC_ID_PREFIX,
  errorMessage,
  isMaybeWritten,
  isOptimisticId,
  makeOptimisticNode,
  nextOptimisticId,
  settleOptimistic,
} from "./optimistic";
import type { CommentAuthor } from "../types";

const AUTHOR: CommentAuthor = { id: "a".repeat(24), name: "Moi", slug: "moi", avatarUrl: null };

describe("nextOptimisticId", () => {
  it("préfixe les identifiants provisoires de façon reconnaissable", () => {
    expect(nextOptimisticId().startsWith(OPTIMISTIC_ID_PREFIX)).toBe(true);
  });

  it("ne collisionne pas dans la même milliseconde", () => {
    // Sans compteur, deux envois rapprochés partageraient la clé de rendu et React
    // fusionnerait les deux messages à l'écran.
    const ids = new Set(Array.from({ length: 50 }, () => nextOptimisticId()));
    expect(ids.size).toBe(50);
  });

  it("ne peut pas être confondu avec un ObjectId", () => {
    expect(isOptimisticId("f".repeat(24))).toBe(false);
    expect(isOptimisticId(nextOptimisticId())).toBe(true);
  });
});

describe("makeOptimisticNode", () => {
  it("construit un message en cours d'envoi, jamais marqué non lu", () => {
    const node = makeOptimisticNode({ text: "bonjour", author: AUTHOR, createdAt: 1_700_000_000 });
    expect(node.pending).toBe(true);
    expect(node.unread).toBe(false);
    expect(node.text).toBe("bonjour");
    expect(node.createdAt).toBe(1_700_000_000);
    expect(node.replies).toEqual([]);
    expect(node.reactions).toEqual({});
  });

  it("porte son parent et son chemin quand on les lui donne", () => {
    const node = makeOptimisticNode({ text: "réponse", author: AUTHOR, parentId: "p1", path: "answers.step" });
    expect(node.parentId).toBe("p1");
    expect(node.path).toBe("answers.step");
  });

  it("date en SECONDES, comme le reste de l'arbre", () => {
    const node = makeOptimisticNode({ text: "x", author: AUTHOR });
    // Millisecondes = 13 chiffres ; on veut 10.
    expect(String(node.createdAt).length).toBeLessThanOrEqual(11);
  });
});

describe("settleOptimistic", () => {
  it("pose l'identifiant du serveur et retire le voile d'envoi", () => {
    const optimistic = makeOptimisticNode({ text: "bonjour", author: AUTHOR });
    const settled = settleOptimistic(optimistic, "b".repeat(24));
    expect(settled.id).toBe("b".repeat(24));
    expect(settled.pending).toBeUndefined();
    expect("pending" in settled).toBe(false);
    expect(settled.text).toBe("bonjour");
  });

  it("garde l'identifiant provisoire si le serveur n'en a pas rendu", () => {
    const optimistic = makeOptimisticNode({ text: "bonjour", author: AUTHOR });
    const settled = settleOptimistic(optimistic, null);
    expect(settled.id).toBe(optimistic.id);
    expect("pending" in settled).toBe(false);
  });

  it("ne modifie pas le nœud d'origine", () => {
    const optimistic = makeOptimisticNode({ text: "bonjour", author: AUTHOR });
    settleOptimistic(optimistic, "c".repeat(24));
    expect(optimistic.pending).toBe(true);
  });
});

describe("isMaybeWritten", () => {
  it("dit oui au-delà de 500 : le serveur a pu écrire avant de tomber", () => {
    // Le cas B8 exactement : commentaire inséré, puis la notification lève.
    expect(isMaybeWritten(Object.assign(new Error("x"), { status: 500 }))).toBe(true);
    expect(isMaybeWritten(Object.assign(new Error("x"), { status: 502 }))).toBe(true);
    expect(isMaybeWritten(Object.assign(new Error("x"), { status: 503 }))).toBe(true);
  });

  it("dit non pour un refus franc : rien n'a été écrit", () => {
    for (const status of [400, 401, 403, 404, 422, 499]) {
      expect(isMaybeWritten(Object.assign(new Error("x"), { status }))).toBe(false);
    }
  });

  it("dit non quand l'erreur ne porte aucun statut", () => {
    expect(isMaybeWritten(new Error("validation AJV côté client"))).toBe(false);
    expect(isMaybeWritten(null)).toBe(false);
    expect(isMaybeWritten(undefined)).toBe(false);
    expect(isMaybeWritten("boum")).toBe(false);
    expect(isMaybeWritten({ status: "500" })).toBe(false);
  });
});

describe("errorMessage", () => {
  it("préfère le message de l'erreur", () => {
    expect(errorMessage(new Error("détail utile"), "repli")).toBe("détail utile");
  });

  it("retombe sur le repli plutôt que d'afficher « undefined »", () => {
    expect(errorMessage(new Error(""), "repli")).toBe("repli");
    expect(errorMessage({ nope: true }, "repli")).toBe("repli");
    expect(errorMessage(null, "repli")).toBe("repli");
  });
});
