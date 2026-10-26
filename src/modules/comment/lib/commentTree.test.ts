import { describe, expect, it } from "vitest";
import {
  addReply, ancestorsOf, branchAuthors, countNodes, countUnread, findNode, lastActivityAt, mapNode,
  maxDepth, removeNode, replaceNode, toCommentTree, toggleReaction, toUnixSeconds, updateNodeText,
} from "./commentTree";
import type { CommentNode } from "../types";

/** Fabrique un nœud normalisé, pour les tests d'opérations. */
const noeud = (id: string, over: Partial<CommentNode> = {}): CommentNode => ({
  id,
  text: `texte ${id}`,
  author: { id: "u1", name: "Auteur", slug: null, avatarUrl: null },
  createdAt: 1_700_000_000,
  updatedAt: null,
  parentId: null,
  path: null,
  reactions: {},
  myReaction: null,
  mentions: [],
  images: [],
  unread: false,
  replies: [],
  ...over,
});

/** Arbre de référence : a ─ b ─ c, plus d en racine. */
const arbre = (): readonly CommentNode[] => [
  noeud("a", { replies: [noeud("b", { parentId: "a", replies: [noeud("c", { parentId: "b" })] })] }),
  noeud("d"),
];

describe("toUnixSeconds — les quatre formes de date rencontrées", () => {
  it("accepte des secondes UNIX (forme Mongo)", () => {
    expect(toUnixSeconds(1_744_720_837)).toBe(1_744_720_837);
  });

  it("ramène des millisecondes à des secondes", () => {
    expect(toUnixSeconds(1_744_720_837_000)).toBe(1_744_720_837);
  });

  it("accepte un objet Date (forme rendue par l'API)", () => {
    expect(toUnixSeconds(new Date("2026-09-23T15:56:29.000Z"))).toBe(1790178989);
  });

  it("accepte une chaîne ISO et la forme legacy { sec, usec }", () => {
    expect(toUnixSeconds("2026-09-23T15:56:29.000Z")).toBe(1790178989);
    expect(toUnixSeconds({ sec: 1_744_720_837, usec: 0 })).toBe(1_744_720_837);
  });

  it("renvoie 0 plutôt que NaN sur une entrée inexploitable", () => {
    for (const v of [null, undefined, "", "pas une date", {}, []]) expect(toUnixSeconds(v)).toBe(0);
  });
});

describe("toCommentTree — ordre chronologique", () => {
  it("remet le fil à l'endroit : l'API rend les racines en ordre DÉCROISSANT", () => {
    // Défaut vu à l'écran, puis mesuré sur le backend : le dernier message s'affichait en tête.
    const tree = toCommentTree([
      { id: "c".repeat(24), text: "troisième", created: 1_700_000_300 },
      { id: "b".repeat(24), text: "deuxième", created: 1_700_000_200 },
      { id: "a".repeat(24), text: "premier", created: 1_700_000_100 },
    ]);
    expect(tree.map(n => n.text)).toEqual(["premier", "deuxième", "troisième"]);
  });

  it("trie aussi les réponses, à tous les niveaux", () => {
    const tree = toCommentTree([{
      id: "a".repeat(24), text: "racine", created: 1_700_000_000,
      replies: [
        { id: "c".repeat(24), text: "réponse tardive", created: 1_700_000_900 },
        { id: "b".repeat(24), text: "réponse rapide", created: 1_700_000_100 },
      ],
    }]);
    expect(tree[0]?.replies.map(n => n.text)).toEqual(["réponse rapide", "réponse tardive"]);
  });

  it("garde l'ordre reçu quand les dates sont identiques (tri stable)", () => {
    const tree = toCommentTree([
      { id: "a".repeat(24), text: "premier arrivé", created: 1_700_000_000 },
      { id: "b".repeat(24), text: "second arrivé", created: 1_700_000_000 },
    ]);
    expect(tree.map(n => n.text)).toEqual(["premier arrivé", "second arrivé"]);
  });

  it("place les messages sans date en tête plutôt que de les perdre", () => {
    const tree = toCommentTree([
      { id: "b".repeat(24), text: "daté", created: 1_700_000_000 },
      { id: "a".repeat(24), text: "sans date" },
    ]);
    expect(tree.map(n => n.text)).toEqual(["sans date", "daté"]);
  });
});

describe("toCommentTree — normalisation", () => {
  it("déballe une instance SDK comme un objet nu, et récursivement", () => {
    const depuisInstance = toCommentTree([
      { serverData: { id: "a", text: "salut", created: 1_700_000_000, author: "u1",
        replies: [{ serverData: { id: "b", text: "re", parentId: "a", author: "u2" } }] } },
    ]);
    expect(depuisInstance).toHaveLength(1);
    expect(depuisInstance[0].replies[0].id).toBe("b");
    expect(depuisInstance[0].replies[0].text).toBe("re");
  });

  it("n'expose de l'auteur que l'identité d'affichage — jamais son adresse e-mail", () => {
    const [n] = toCommentTree([{ id: "a", author: { serverData: {
      id: "u1", name: "Nom Affiché", email: "prive@example.org",
      profilThumbImageUrl: "http://exemple/avatar.png" } } }]);
    expect(n.author).toEqual({ id: "u1", name: "Nom Affiché", slug: null, avatarUrl: "http://exemple/avatar.png" });
    expect(JSON.stringify(n)).not.toContain("prive@example.org");
  });

  it("traite `parentId: \"\"` comme une racine — le backend n'écrit pas null", () => {
    const [n] = toCommentTree([{ id: "a", parentId: "" }]);
    expect(n.parentId).toBeNull();
  });

  it("écarte les compteurs de réaction nuls ou négatifs", () => {
    const [n] = toCommentTree([{ id: "a", voteCount: { love: 3, like: 0, sad: -1 } }]);
    expect(n.reactions).toEqual({ love: 3 });
  });

  it("lit la réaction de l'utilisateur courant, et rien quand il est anonyme", () => {
    const brut = [{ id: "a", vote: { u9: { status: "love" } }, voteCount: { love: 1 } }];
    expect(toCommentTree(brut, { meId: "u9" })[0].myReaction).toBe("love");
    expect(toCommentTree(brut, { meId: "u1" })[0].myReaction).toBeNull();
    expect(toCommentTree(brut)[0].myReaction).toBeNull();
  });

  it("ne marque pas non-lu ses propres messages, ni quoi que ce soit pour un anonyme", () => {
    const brut = [{ id: "a", author: "moi", views: {} }, { id: "b", author: "autre", views: {} }];
    const vus = toCommentTree(brut, { meId: "moi" });
    expect(vus[0].unread).toBe(false);   // je l'ai écrit
    expect(vus[1].unread).toBe(true);    // d'un autre, jamais ouvert
    expect(toCommentTree(brut).every(n => !n.unread)).toBe(true); // anonyme : aucun non-lu
  });

  it("écarte un nœud sans identifiant au lieu de produire un nœud fantôme", () => {
    expect(toCommentTree([{ text: "orphelin" }, { id: "a" }])).toHaveLength(1);
  });

  it("coupe un cycle au lieu de déborder la pile", () => {
    const cyclique: Record<string, unknown> = { id: "a", text: "boucle" };
    cyclique.replies = [{ id: "b", replies: [cyclique] }];
    const arbreCyclique = toCommentTree([cyclique]);
    expect(arbreCyclique[0].replies[0].replies).toHaveLength(0);
  });

  it("renvoie un tableau vide sur une entrée qui n'est pas une liste", () => {
    for (const v of [null, undefined, {}, "", 0]) expect(toCommentTree(v)).toEqual([]);
  });

  it("garde le type stocké d'une mention, et n'en invente pas quand il manque", () => {
    const [n] = toCommentTree([{ id: "a", mentions: [
      { id: "o1", name: "La Fabrique", slug: "fabrique", type: "organizations" },
      { id: "c1", name: "Camille", slug: "camille" },
    ] }]);
    expect(n.mentions).toEqual([
      { id: "o1", name: "La Fabrique", slug: "fabrique", type: "organizations" },
      { id: "c1", name: "Camille", slug: "camille" },
    ]);
  });

  it("lit les mentions d'une liste PHP à trous, arrivée en OBJET — l'édition suivante les aurait perdues", () => {
    const [n] = toCommentTree([{ id: "a", mentions: { 0: { id: "c1", name: "Camille", slug: "camille" },
      2: { id: "c2", name: "Raya", slug: "raya" } } }]);
    expect(n.mentions.map(m => m.id)).toEqual(["c1", "c2"]);
  });
});

describe("opérations immuables — ce qui faisait échouer le rollback", () => {
  it("removeNode laisse l'arbre d'origine intact", () => {
    const avant = arbre();
    const copie = JSON.parse(JSON.stringify(avant));
    const apres = removeNode(avant, "c");
    expect(JSON.parse(JSON.stringify(avant))).toEqual(copie);       // l'original n'a pas bougé
    expect(findNode(apres, "c")).toBeNull();
    expect(findNode(avant, "c")).not.toBeNull();                    // et il porte toujours « c »
  });

  it("updateNodeText laisse l'arbre d'origine intact", () => {
    const avant = arbre();
    const apres = updateNodeText(avant, "b", "corrigé");
    expect(findNode(apres, "b")?.text).toBe("corrigé");
    expect(findNode(avant, "b")?.text).toBe("texte b");
  });

  it("addReply laisse l'arbre d'origine intact", () => {
    const avant = arbre();
    const apres = addReply(avant, "b", noeud("nouveau", { parentId: "b" }));
    expect(findNode(apres, "b")?.replies).toHaveLength(2);
    expect(findNode(avant, "b")?.replies).toHaveLength(1);
  });

  it("restaurer un instantané pris avant l'opération annule vraiment celle-ci", () => {
    // C'est exactement le scénario de `onError` : on garde une référence, on modifie, on restaure.
    const instantane = arbre();
    const optimiste = addReply(updateNodeText(instantane, "a", "brouillon"), null, noeud("temp"));
    expect(countNodes(optimiste)).toBe(5);

    const restaure = instantane;                                     // ce que fait le rollback
    expect(countNodes(restaure)).toBe(4);
    expect(findNode(restaure, "a")?.text).toBe("texte a");
    expect(findNode(restaure, "temp")).toBeNull();
  });

  it("rend la MÊME référence quand rien ne change, pour éviter un rendu inutile", () => {
    const avant = arbre();
    expect(removeNode(avant, "inconnu")).toBe(avant);
    expect(mapNode(avant, "inconnu", n => n)).toBe(avant);
  });

  it("ne recrée que la branche traversée", () => {
    const avant = arbre();
    const apres = updateNodeText(avant, "c", "modifié");
    expect(apres[1]).toBe(avant[1]);          // la racine « d » n'est pas recréée
    expect(apres[0]).not.toBe(avant[0]);      // la branche « a » l'est
  });

  it("addReply(null) ajoute à la racine", () => {
    expect(addReply(arbre(), null, noeud("e"))).toHaveLength(3);
  });

  it("replaceNode substitue un message optimiste par le message réel en gardant ses réponses", () => {
    const avant = addReply(arbre(), null, noeud("temp", { replies: [noeud("x")] }));
    const apres = replaceNode(avant, "temp", noeud("reel"));
    expect(findNode(apres, "temp")).toBeNull();
    expect(findNode(apres, "reel")?.replies).toHaveLength(1);   // les réponses survivent
  });
});

describe("toggleReaction", () => {
  it("pose une réaction quand il n'y en avait pas", () => {
    const [n] = toggleReaction([noeud("a")], "a", "love");
    expect(n.reactions).toEqual({ love: 1 });
    expect(n.myReaction).toBe("love");
  });

  it("retire la réaction quand on repose la même", () => {
    const depart = [noeud("a", { reactions: { love: 3 }, myReaction: "love" })];
    const [n] = toggleReaction(depart, "a", "love");
    expect(n.reactions).toEqual({ love: 2 });
    expect(n.myReaction).toBeNull();
  });

  it("transfère le compteur quand on change de réaction", () => {
    const depart = [noeud("a", { reactions: { love: 1, like: 2 }, myReaction: "love" })];
    const [n] = toggleReaction(depart, "a", "like");
    expect(n.reactions).toEqual({ like: 3 });   // love tombe à 0 et disparaît
    expect(n.myReaction).toBe("like");
  });

  it("fonctionne sur une réponse profonde, sans toucher au reste", () => {
    const avant = arbre();
    const apres = toggleReaction(avant, "c", "glad");
    expect(findNode(apres, "c")?.reactions).toEqual({ glad: 1 });
    expect(findNode(avant, "c")?.reactions).toEqual({});
  });
});

describe("lectures d'arbre", () => {
  it("countNodes compte les réponses", () => { expect(countNodes(arbre())).toBe(4); });

  it("maxDepth vaut 1 pour un fil plat et croît avec l'imbrication", () => {
    expect(maxDepth([])).toBe(0);
    expect(maxDepth([noeud("a")])).toBe(1);
    expect(maxDepth(arbre())).toBe(3);
  });

  it("ancestorsOf rend la chaîne du plus haut au parent direct", () => {
    expect(ancestorsOf(arbre(), "c").map(n => n.id)).toEqual(["a", "b"]);
    expect(ancestorsOf(arbre(), "a")).toEqual([]);
    expect(ancestorsOf(arbre(), "inconnu")).toEqual([]);
  });

  it("countUnread additionne les non-lus de tout l'arbre", () => {
    const avecNonLus = [noeud("a", { unread: true, replies: [noeud("b", { unread: true })] }), noeud("d")];
    expect(countUnread(avecNonLus)).toBe(2);
  });

  it("lastActivityAt prend la date la plus récente, réponse comprise", () => {
    const t = [noeud("a", { createdAt: 100, replies: [noeud("b", { createdAt: 900 })] })];
    expect(lastActivityAt(t)).toBe(900);
    expect(lastActivityAt([])).toBe(0);
  });
});

describe("branchAuthors — qui a répondu, pour un repli", () => {
  const par = (id: string, nom: string) => ({ id, name: nom, slug: null, avatarUrl: null });

  it("rend les auteurs distincts, le plus récent d'abord", () => {
    const branche = [
      noeud("a", { author: par("u1", "Alice"), createdAt: 100, replies: [
        noeud("b", { author: par("u2", "Bob"), createdAt: 300 }),
      ] }),
      noeud("c", { author: par("u1", "Alice"), createdAt: 500 }),
      noeud("d", { author: par("u3", "Chloé"), createdAt: 200 }),
    ];
    // Alice a écrit en dernier (500), puis Bob (300), puis Chloé (200) — Alice une seule fois.
    expect(branchAuthors(branche).map(a => a.name)).toEqual(["Alice", "Bob", "Chloé"]);
  });

  it("s'arrête au nombre demandé, et rend une liste vide pour une branche vide", () => {
    const branche = [1, 2, 3, 4].map(i => noeud(`n${i}`, { author: par(`u${i}`, `P${i}`), createdAt: i }));
    expect(branchAuthors(branche, 2).map(a => a.name)).toEqual(["P4", "P3"]);
    expect(branchAuthors([])).toEqual([]);
  });
});
