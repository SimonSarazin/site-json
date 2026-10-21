import { describe, expect, it } from "vitest";
import { flattenThread, shouldStayExpanded, type ThreadRow } from "./flattenThread";
import { GROUP_WINDOW_SECONDS } from "../constants/display";
import type { CommentNode } from "../types";

const JOUR = 1_700_000_000;   // instant de référence, en secondes

const noeud = (id: string, over: Partial<CommentNode> = {}): CommentNode => ({
  id, text: `texte ${id}`,
  author: { id: "u1", name: "Alice", slug: null, avatarUrl: null },
  createdAt: JOUR, updatedAt: null, parentId: null, path: null,
  reactions: {}, myReaction: null, mentions: [], images: [], unread: false, replies: [],
  ...over,
});

const auteur = (id: string, name: string) => ({ id, name, slug: null, avatarUrl: null });
const messages = (rows: readonly ThreadRow[]) => rows.filter(r => r.kind === "message");

/**
 * Des réponses consécutives sous une même racine : c'est là, et là seulement, que le
 * groupement joue — une racine ouvre un sujet et n'est jamais fondue dans le bloc d'avant.
 *
 * Ces tests portaient sur des RACINES. Ils seraient restés verts après la règle du 28/09, mais
 * pour une mauvaise raison : une racine ne se groupant plus jamais, ils n'auraient plus rien
 * éprouvé de ce qu'ils nomment.
 */
const sous = (...reponses: CommentNode[]) => messages(flattenThread([
  noeud("racine", { createdAt: JOUR - 3_600, author: auteur("u9", "Racine"), replies: reponses }),
], { timeZone: "UTC" })).slice(1);

describe("groupement des messages consécutifs", () => {
  it("fond deux réponses du même auteur postées coup sur coup", () => {
    const rows = sous(noeud("a", { createdAt: JOUR }), noeud("b", { createdAt: JOUR + 60 }));
    expect(rows[0]).toMatchObject({ grouped: false });
    expect(rows[1]).toMatchObject({ grouped: true });
  });

  it("ne groupe pas au-delà de la fenêtre", () => {
    const rows = sous(noeud("a", { createdAt: JOUR }), noeud("b", { createdAt: JOUR + GROUP_WINDOW_SECONDS + 1 }));
    expect(rows[1]).toMatchObject({ grouped: false });
  });

  it("ne groupe pas deux auteurs différents", () => {
    const rows = sous(noeud("a", { createdAt: JOUR }), noeud("b", { createdAt: JOUR + 10, author: auteur("u2", "Bob") }));
    expect(rows[1]).toMatchObject({ grouped: false });
  });

  it("ne groupe pas à travers un changement de profondeur", () => {
    const rows = messages(flattenThread([
      noeud("a", { createdAt: JOUR, replies: [noeud("b", { createdAt: JOUR + 10, parentId: "a" })] }),
    ]));
    expect(rows[1]).toMatchObject({ grouped: false, depth: 1 });
  });

  it("ne groupe pas un message antérieur au précédent (horloges désordonnées)", () => {
    const rows = sous(noeud("a", { createdAt: JOUR + 100 }), noeud("b", { createdAt: JOUR }));
    expect(rows[1]).toMatchObject({ grouped: false });
  });

  it("ne groupe pas à travers minuit, même dans la fenêtre", () => {
    // 23:58 puis 00:01 : trois minutes, sous la fenêtre de sept — mais pas le même jour. La
    // seconde doit montrer sa date, ce qu'une ligne groupée ne fait pas.
    const minuit = 1_700_006_400;   // 2023-11-15T00:00:00Z
    const rows = sous(noeud("a", { createdAt: minuit - 120 }), noeud("b", { createdAt: minuit + 60 }));
    expect(rows[1]).toMatchObject({ grouped: false });
  });

  /**
   * Le cas réel du 28/09 : trois racines du même auteur postées à trois secondes d'écart. La
   * troisième — « Second sujet, sans rapport » — s'affichait sans en-tête, collée sous la
   * deuxième, alors qu'elle ouvrait un autre sujet et portait trois réponses.
   */
  it("ne groupe JAMAIS une racine, même collée à la précédente", () => {
    const rows = messages(flattenThread([
      noeud("r1", { createdAt: JOUR }),
      noeud("r2", { createdAt: JOUR + 2 }),
      noeud("r3", { createdAt: JOUR + 3, replies: [noeud("x", { createdAt: JOUR + 400 })] }),
    ]));
    expect(rows.filter(r => r.realDepth === 0).map(r => r.grouped)).toEqual([false, false, false]);
  });
});

describe("séparateurs de date", () => {
  it("insère un séparateur au premier message, puis à chaque changement de jour", () => {
    const rows = flattenThread([
      noeud("a", { createdAt: JOUR }),
      noeud("b", { createdAt: JOUR + 60 }),
      noeud("c", { createdAt: JOUR + 86_400 * 2 }),
    ], { timeZone: "UTC" });
    expect(rows.filter(r => r.kind === "date")).toHaveLength(2);
    expect(rows[0].kind).toBe("date");
  });

  it("rompt le groupement au niveau des racines, où il pose un séparateur", () => {
    const rows = flattenThread([
      noeud("a", { createdAt: JOUR }),
      noeud("b", { createdAt: JOUR + 86_400 }),
    ], { timeZone: "UTC" });
    expect(messages(rows)[1]).toMatchObject({ grouped: false });
  });

  /**
   * Le fil de démonstration de la base de dev, reproduit tel quel : trois racines du même jour,
   * et deux réponses écrites cinq jours plus tard, nichées sous la première racine.
   *
   * À l'écran, ce fil rendait NEUF séparateurs alternés « 23 septembre » / « Aujourd'hui » — dont
   * huit sans le moindre message entre eux, et qui s'ajoutaient les uns aux autres à chaque fois
   * qu'on repliait puis dépliait une branche.
   */
  const filEnArbre = () => [
    noeud("r1", { createdAt: JOUR, replies: [
      noeud("rep-tard", { createdAt: JOUR + 86_400 * 5, replies: [] }),
      noeud("rep-meme-jour", { createdAt: JOUR + 300, replies: [] }),
    ] }),
    noeud("r2", { createdAt: JOUR + 2, replies: [] }),
    noeud("r3", { createdAt: JOUR + 3, replies: [] }),
  ];

  it("n'en pose qu'à la racine : une réponse d'un autre jour n'en déclenche pas", () => {
    const rows = flattenThread(filEnArbre(), { timeZone: "UTC" });
    const dates = rows.filter(r => r.kind === "date");
    // Un seul : toutes les racines sont du même jour, et les réponses n'en posent aucun.
    expect(dates).toHaveLength(1);
    expect(rows[0].kind).toBe("date");
  });

  it("marque d'un `dayShift` le message qu'aucun séparateur ne précède", () => {
    const rows = messages(flattenThread(filEnArbre(), { timeZone: "UTC" }));
    const parId = new Map(rows.map(r => [r.node.id, r]));
    // La réponse tardive porte sa date elle-même, faute de séparateur au-dessus d'elle…
    expect(parId.get("rep-tard")).toMatchObject({ dayShift: true });
    // …et personne d'autre ne la porte, sous peine de répéter la date à chaque ligne.
    for (const id of ["r1", "r2", "r3", "rep-meme-jour"]) {
      expect(parId.get(id)).toMatchObject({ dayShift: false });
    }
  });

  it("garde les clés uniques quand le jour revient en arrière", () => {
    // La garantie que l'ancienne clé `date-${jour}` ne donnait PAS : deux racines du même jour
    // séparées par une autre date produisaient deux lignes de même clé, et React s'y perdait.
    const rows = flattenThread([
      noeud("a", { createdAt: JOUR }),
      noeud("b", { createdAt: JOUR + 86_400 }),
      noeud("c", { createdAt: JOUR }),
    ], { timeZone: "UTC" });
    const cles = rows.map(r => r.key);
    expect(new Set(cles).size).toBe(cles.length);
  });
});

describe("marqueur de non-lus", () => {
  it("n'est posé qu'une fois, avant le premier non-lu, et annonce le total", () => {
    const rows = flattenThread([
      noeud("a"),
      noeud("b", { unread: true }),
      noeud("c", { unread: true }),
    ]);
    const marqueurs = rows.filter(r => r.kind === "unread");
    expect(marqueurs).toHaveLength(1);
    expect(marqueurs[0]).toMatchObject({ count: 2 });
    // il précède immédiatement « b »
    const i = rows.findIndex(r => r.kind === "unread");
    expect(rows[i + 1]).toMatchObject({ kind: "message", key: "b" });
  });

  it("compte aussi les non-lus nichés dans les réponses", () => {
    const rows = flattenThread([noeud("a", { replies: [noeud("b", { unread: true, parentId: "a" })] })]);
    expect(rows.find(r => r.kind === "unread")).toMatchObject({ count: 1 });
  });

  it("est absent quand tout est lu", () => {
    expect(flattenThread([noeud("a"), noeud("b")]).some(r => r.kind === "unread")).toBe(false);
  });
});

describe("retrait borné et ligne de contexte", () => {
  const profond = [
    noeud("n0", { replies: [
      noeud("n1", { parentId: "n0", author: auteur("u2", "Bob"), replies: [
        noeud("n2", { parentId: "n1", replies: [
          noeud("n3", { parentId: "n2" }),
        ] }),
      ] }),
    ] }),
  ];

  it("borne le retrait visuel tout en gardant la profondeur réelle", () => {
    const rows = messages(flattenThread(profond, { maxDepth: 2 }));
    expect(rows.map(r => r.kind === "message" && r.depth)).toEqual([0, 1, 2, 2]);
    expect(rows.map(r => r.kind === "message" && r.realDepth)).toEqual([0, 1, 2, 3]);
  });

  it("cite le parent dès que le retrait maximal est dépassé — et pas avant", () => {
    const rows = messages(flattenThread(profond, { maxDepth: 2 }));
    expect(rows[2]).toMatchObject({ contextParent: null });
    expect(rows[3]).toMatchObject({ contextParent: { id: "n2" } });
  });

  it("un retrait maximal d'un niveau reste possible, par option", () => {
    const rows = messages(flattenThread(profond, { maxDepth: 1 }));
    expect(rows.map(r => r.kind === "message" && r.depth)).toEqual([0, 1, 1, 1]);
  });

  it("l'extrait cité est compacté et tronqué", () => {
    // Le parent CITÉ est le parent direct du message qui dépasse le retrait : ici « e », pas « p ».
    const long = "mot ".repeat(60);
    const rows = messages(flattenThread([
      noeud("p", { replies: [noeud("e", { parentId: "p", text: long, replies: [noeud("f", { parentId: "e" })] })] }),
    ], { maxDepth: 1 }));
    const cite = rows[2].kind === "message" ? rows[2].contextParent : null;
    expect(cite?.excerpt.length).toBeLessThanOrEqual(90);
    expect(cite?.excerpt).not.toContain("  ");
    expect(cite?.excerpt.endsWith("…")).toBe(true);
  });

  it("une image du texte s'y lit par sa description, pas par son adresse", () => {
    const texte = "Voici ![un chat](https://images.example.org/tres/long/chemin/chat(1).jpg) et ![](/upload/a.png) fin";
    const rows = messages(flattenThread([
      noeud("p", { replies: [noeud("e", { parentId: "p", text: texte, replies: [noeud("f", { parentId: "e" })] })] }),
    ], { maxDepth: 1 }));
    const cite = rows[2].kind === "message" ? rows[2].contextParent : null;
    expect(cite?.excerpt).toBe("Voici un chat et fin");
  });
});

describe("repli d'une branche", () => {
  it("omet les réponses d'un message replié, mais garde le message", () => {
    const arbre = [noeud("a", { replies: [noeud("b", { parentId: "a" })] })];
    const rows = messages(flattenThread(arbre, { collapsed: new Set(["a"]) }));
    expect(rows.map(r => r.kind === "message" && r.key)).toEqual(["a"]);
  });

  it("shouldStayExpanded garde ouverte une branche qui contient un non-lu", () => {
    const avecNonLu = noeud("a", { replies: [noeud("b", { unread: true })] });
    expect(shouldStayExpanded(avecNonLu)).toBe(true);
  });

  /**
   * Arbitré le 28/09 : une mention DÉJÀ VUE cesse d'être une nouvelle — son fond disparaît de
   * la ligne, et elle ne retient plus la branche. Pas encore vue, elle est non lue : la règle
   * du non-lu la couvre.
   */
  it("shouldStayExpanded ne retient plus une branche pour une mention déjà lue", () => {
    const mention = [{ id: "moi", name: "Moi", slug: "moi" }];
    expect(shouldStayExpanded(noeud("a", { replies: [noeud("b", { mentions: mention })] }))).toBe(false);
    expect(shouldStayExpanded(noeud("a", { replies: [noeud("b", { mentions: mention, unread: true })] }))).toBe(true);
  });

  it("shouldStayExpanded laisse replier une branche sans rien de notable", () => {
    expect(shouldStayExpanded(noeud("a", { replies: [noeud("b")] }))).toBe(false);
  });
});

describe("cas limites", () => {
  it("rend une liste vide pour un fil vide", () => {
    expect(flattenThread([])).toEqual([]);
  });

  it("donne une clé unique à chaque ligne, séparateurs et arbre compris", () => {
    const rows = flattenThread([
      noeud("a", { unread: true, replies: [noeud("a1", { createdAt: JOUR + 86_400 * 3 })] }),
      noeud("b", { createdAt: JOUR + 86_400, unread: true }),
      noeud("c", { createdAt: JOUR }),
    ], { timeZone: "UTC" });
    const cles = rows.map(r => r.key);
    expect(new Set(cles).size).toBe(cles.length);
  });
});
