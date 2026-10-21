import { describe, expect, it, vi } from "vitest";
import {
  correspondAuxMots,
  filtrerFils,
  filtrerPorteurs,
  motsDeRequete,
  replierPourRecherche,
  segmenterCorrespondances,
} from "./searchDiscussions";
import type { CommentableType, DiscussionCarrier, DiscussionThread } from "../types";

const ORG = "65a1000000000000000000a1";
const NEWS = "65b2000000000000000000b2";

const porteur = (over: Partial<DiscussionCarrier>): DiscussionCarrier => ({
  id: ORG, type: "organizations", name: "Une orga", slug: null, image: null,
  threads: 1, total: 1, unread: 0, last: 1758000000, mine: false, membership: null, ...over,
});

const fil = (over: Partial<DiscussionThread>): DiscussionThread => ({
  key: "k", target: { type: "news", id: NEWS, path: null }, title: null,
  carrier: null, total: 0, unread: 0, last: 0, mine: false, virtual: false, ...over,
});

/** Le libellé qu'un composant passerait, calqué sur `t("contextTypes.<type>")`. */
const LIBELLES: Record<string, string> = {
  news: "Actualité", forms: "Formulaire", actions: "Action", organizations: "Organisation",
};
const libelleType = (type: CommentableType): string => LIBELLES[type] ?? type;

describe("replierPourRecherche", () => {
  it("replie les accents : « creche » doit retrouver « Crèche »", () => {
    expect(replierPourRecherche("Crèche")).toBe("creche");
    expect(replierPourRecherche("Écologie")).toBe("ecologie");
  });

  it("replie la casse dans les deux sens — la requête et la donnée passent par la même porte", () => {
    expect(replierPourRecherche("PARENTS")).toBe(replierPourRecherche("parents"));
    expect(replierPourRecherche("Arras")).toBe("arras");
  });

  it("ne rogne pas les espaces — le `trim` est fait une seule fois, dans `motsDeRequete`", () => {
    expect(replierPourRecherche("  Crèche ")).toBe("  creche ");
  });
});

describe("motsDeRequete", () => {
  it("rend [] sur une requête vide ou blanche", () => {
    expect(motsDeRequete("")).toEqual([]);
    expect(motsDeRequete("   \t \n ")).toEqual([]);
  });

  it("ignore les espaces surnuméraires plutôt que de fabriquer un mot vide", () => {
    // Un mot `""` serait sous-chaîne de TOUT : le filtre deviendrait silencieusement inopérant.
    expect(motsDeRequete("  parents   arras  ")).toEqual(["parents", "arras"]);
    expect(motsDeRequete("a  b").every(mot => mot !== "")).toBe(true);
  });

  it("replie chaque mot au passage", () => {
    expect(motsDeRequete("Crèche Écolo")).toEqual(["creche", "ecolo"]);
  });
});

describe("correspondAuxMots", () => {
  it("exige TOUS les mots, dans n'importe quel ordre", () => {
    const champ = "Réunion des parents — Arras";
    expect(correspondAuxMots(motsDeRequete("parents arras"), champ)).toBe(true);
    expect(correspondAuxMots(motsDeRequete("arras parents"), champ)).toBe(true);
    expect(correspondAuxMots(motsDeRequete("parents lille"), champ)).toBe(false);
  });

  it("cherche dans l'UNION des champs, un mot par champ suffit", () => {
    expect(correspondAuxMots(motsDeRequete("creche actualite"), "Crèche du centre", "Actualité")).toBe(true);
  });

  it("laisse tout passer quand la liste de mots est vide", () => {
    expect(correspondAuxMots([], null)).toBe(true);
  });

  it("ignore un champ absent au lieu de le comparer comme « null »", () => {
    expect(correspondAuxMots(motsDeRequete("null"), null, undefined)).toBe(false);
  });
});

describe("filtrerPorteurs", () => {
  const porteurs = [
    porteur({ id: ORG, name: "Crèche des Lilas" }),
    porteur({ id: "65a1000000000000000000a2", type: "projects", name: "Projet Arras" }),
    porteur({ id: null, type: null, name: null }), // le groupe « sans espace »
  ];

  it("une requête blanche ne filtre RIEN — et rend le tableau REÇU", () => {
    // `toBe`, pas `toEqual` : l'appelant mémoïse sur la référence, une copie ferait clignoter le rail.
    expect(filtrerPorteurs(porteurs, motsDeRequete("   "))).toBe(porteurs);
  });

  it("retrouve un porteur accentué depuis une requête sans accent", () => {
    expect(filtrerPorteurs(porteurs, motsDeRequete("creche")).map(c => c.name)).toEqual(["Crèche des Lilas"]);
  });

  it("un porteur sans nom quitte la liste dès le premier caractère", () => {
    // Sa rangée n'affiche aucun texte cherchable : le retenir serait un résultat inexplicable.
    const retenus = filtrerPorteurs(porteurs, motsDeRequete("a"));
    expect(retenus.some(c => c.name === null)).toBe(false);
  });

  it("ne filtre JAMAIS sur le type, qui n'est pas affiché sur une rangée de porteur", () => {
    expect(filtrerPorteurs(porteurs, motsDeRequete("organisation"))).toEqual([]);
  });

  it("ne mute pas le tableau reçu", () => {
    const source = [...porteurs];
    filtrerPorteurs(source, motsDeRequete("creche"));
    expect(source).toHaveLength(3);
    expect(source.map(c => c.name)).toEqual(["Crèche des Lilas", "Projet Arras", null]);
  });
});

describe("filtrerFils", () => {
  const fils = [
    fil({ key: "titré", title: "Réunion des parents", target: { type: "news", id: NEWS, path: null } }),
    fil({ key: "sans-titre", title: null, target: { type: "forms", id: ORG, path: null } }),
  ];

  it("une requête blanche ne filtre RIEN — et rend le tableau REÇU", () => {
    expect(filtrerFils(fils, motsDeRequete(""), libelleType)).toBe(fils);
  });

  it("compare le titre ET le libellé de type, tous deux affichés sur la rangée", () => {
    expect(filtrerFils(fils, motsDeRequete("parents"), libelleType).map(t => t.key)).toEqual(["titré"]);
    expect(filtrerFils(fils, motsDeRequete("actualite"), libelleType).map(t => t.key)).toEqual(["titré"]);
  });

  it("un fil sans titre ne correspond QUE par son libellé de type", () => {
    expect(filtrerFils(fils, motsDeRequete("formulaire"), libelleType).map(t => t.key)).toEqual(["sans-titre"]);
    expect(filtrerFils(fils, motsDeRequete("reunion"), libelleType).map(t => t.key)).toEqual(["titré"]);
  });

  it("ne compare jamais le libellé de repli « Sans titre » — c'est du chrome, pas de la donnée", () => {
    // « sans » est une sous-chaîne bien trop commune, et la réponse dépendrait de la locale.
    expect(filtrerFils(fils, motsDeRequete("sans titre"), libelleType)).toEqual([]);
    expect(filtrerFils(fils, motsDeRequete("sans"), libelleType)).toEqual([]);
  });

  it("ne traduit rien lui-même : le libellé de type lui est DONNÉ", () => {
    const espion = vi.fn((type: CommentableType) => LIBELLES[type] ?? type);
    const retenus = filtrerFils(fils, motsDeRequete("formulaire"), espion);
    expect(espion).toHaveBeenCalled();
    expect(espion).toHaveBeenCalledWith("forms");
    expect(retenus.map(t => t.key)).toEqual(["sans-titre"]);
  });

  it("n'appelle même pas le traducteur quand la requête est vide — le chemin court ne rend rien de traduit", () => {
    const espion = vi.fn(libelleType);
    filtrerFils(fils, [], espion);
    expect(espion).not.toHaveBeenCalled();
  });

  it("ne mute pas le tableau reçu", () => {
    const source = [...fils];
    filtrerFils(source, motsDeRequete("parents"), libelleType);
    expect(source.map(t => t.key)).toEqual(["titré", "sans-titre"]);
  });
});

describe("segmenterCorrespondances", () => {
  const recompose = (texte: string, mots: readonly string[]): string =>
    segmenterCorrespondances(texte, mots)
      .map(s => s.texte)
      .join("");

  it("marque la bonne plage après un émoji (deux unités UTF-16) — revue du 29/09", () => {
    // Exécuté avant correction : « 🎉 réunion » cherché « reunion union » rendait « 🎉 réunionnion ».
    const texte = "🎉 réunion";
    expect(recompose(texte, motsDeRequete("reunion union"))).toBe(texte);
    expect(segmenterCorrespondances(texte, motsDeRequete("union"))).toEqual([
      { texte: "🎉 ré", marque: false },
      { texte: "union", marque: true },
    ]);
    expect(segmenterCorrespondances("👩‍👩‍👧 Fête 🎉 de l'été", motsDeRequete("ete"))
      .filter(s => s.marque).map(s => s.texte)).toEqual(["ête", "été"]);
  });

  it("recompose EXACTEMENT le texte d'origine, accents compris", () => {
    // Tout l'intérêt : on compare sans accents, mais on rend ce que l'auteur a écrit.
    const texte = "Crèche des Lilas — réunion des parents à Arras";
    for (const requete of ["creche", "reunion parents", "à", "lilas arras", "introuvable"]) {
      expect(recompose(texte, motsDeRequete(requete))).toBe(texte);
    }
    const marque = segmenterCorrespondances(texte, motsDeRequete("creche"))
      .filter(s => s.marque)
      .map(s => s.texte);
    expect(marque).toEqual(["Crèche"]); // le segment marqué porte l'accent d'origine
  });

  it("recompose aussi un texte déjà DÉCOMPOSÉ en NFD, où l'accent est un caractère à part", () => {
    const texte = "Crèche"; // « Crèche » en NFD : les indices repliés ne collent plus au texte
    expect(recompose(texte, motsDeRequete("creche"))).toBe(texte);
    expect(segmenterCorrespondances(texte, motsDeRequete("creche"))).toEqual([{ texte, marque: true }]);
  });

  it("fusionne deux mots qui se chevauchent sans dupliquer de caractère", () => {
    const segments = segmenterCorrespondances("Crèche", motsDeRequete("crè eche"));
    expect(segments).toEqual([{ texte: "Crèche", marque: true }]);
    expect(segments.map(s => s.texte).join("")).toBe("Crèche");
  });

  it("marque TOUTES les occurrences d'un mot, pas seulement la première", () => {
    const segments = segmenterCorrespondances("parents et parents", motsDeRequete("parents"));
    expect(segments).toEqual([
      { texte: "parents", marque: true },
      { texte: " et ", marque: false },
      { texte: "parents", marque: true },
    ]);
  });

  it("rend un seul segment non marqué sur un texte vide ou sans mot", () => {
    expect(segmenterCorrespondances("", motsDeRequete("creche"))).toEqual([{ texte: "", marque: false }]);
    expect(segmenterCorrespondances("Crèche", [])).toEqual([{ texte: "Crèche", marque: false }]);
    // Un mot vide glissé par un appelant ne doit pas tout surligner (ni boucler sans fin).
    expect(segmenterCorrespondances("Crèche", [""])).toEqual([{ texte: "Crèche", marque: false }]);
  });

  it("laisse le texte intact quand aucun mot ne correspond", () => {
    expect(segmenterCorrespondances("Crèche", motsDeRequete("arras"))).toEqual([
      { texte: "Crèche", marque: false },
    ]);
  });
});
