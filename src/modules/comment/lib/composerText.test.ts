import { describe, expect, it } from "vitest";
import {
  applyMark,
  findMentionQuery,
  insertAtCursor,
  replaceMentionQuery,
  shouldSubmitOnEnter,
  type FieldState,
} from "./composerText";

/** Écrit l'état comme on le lit : `|` marque le curseur, `[…]` la sélection. */
function state(spec: string): FieldState {
  if (spec.includes("[")) {
    const start = spec.indexOf("[");
    const end = spec.indexOf("]") - 1;
    return { text: spec.replace(/[[\]]/g, ""), selectionStart: start, selectionEnd: end };
  }
  const caret = spec.indexOf("|");
  return { text: spec.replace("|", ""), selectionStart: caret, selectionEnd: caret };
}

/** Et le relit de la même façon, pour que les attentes restent lisibles. */
function show(s: FieldState): string {
  if (s.selectionStart === s.selectionEnd) {
    return `${s.text.slice(0, s.selectionStart)}|${s.text.slice(s.selectionStart)}`;
  }
  return `${s.text.slice(0, s.selectionStart)}[${s.text.slice(s.selectionStart, s.selectionEnd)}]${s.text.slice(s.selectionEnd)}`;
}

describe("applyMark — marques entourantes", () => {
  it("entoure la sélection et la garde sélectionnée", () => {
    expect(show(applyMark(state("dis [bonjour] au monde"), "bold", "gras")))
      .toBe("dis **[bonjour]** au monde");
  });

  it("insère un exemple SÉLECTIONNÉ quand rien n'est choisi — prêt à être remplacé", () => {
    expect(show(applyMark(state("dis |"), "italic", "italique"))).toBe("dis *[italique]*");
  });

  it("bascule : reposer la marque sur un texte déjà marqué la retire", () => {
    const marked = applyMark(state("dis [bonjour] au monde"), "bold", "gras");
    expect(show(applyMark(marked, "bold", "gras"))).toBe("dis [bonjour] au monde");
  });

  it("le lien laisse le texte sélectionné et l'URL à compléter", () => {
    expect(show(applyMark(state("voir [ici] svp"), "link", "texte"))).toBe("voir [[ici]](url) svp");
  });

  it("le code entoure d'un seul accent grave", () => {
    expect(show(applyMark(state("[npm run build]"), "code", "code"))).toBe("`[npm run build]`");
  });
});

describe("applyMark — marques de ligne", () => {
  it("préfixe la ligne courante", () => {
    expect(applyMark(state("une remarque|"), "quote", "citation").text).toBe("> une remarque");
  });

  it("préfixe TOUTES les lignes d'une sélection multiligne", () => {
    const s: FieldState = { text: "un\ndeux\ntrois", selectionStart: 0, selectionEnd: 13 };
    expect(applyMark(s, "list", "élément").text).toBe("- un\n- deux\n- trois");
  });

  it("bascule : retire le préfixe quand toutes les lignes le portent", () => {
    const s: FieldState = { text: "- un\n- deux", selectionStart: 0, selectionEnd: 11 };
    expect(applyMark(s, "list", "élément").text).toBe("un\ndeux");
  });

  it("ne touche qu'aux lignes sélectionnées", () => {
    const s: FieldState = { text: "avant\ncible\napres", selectionStart: 6, selectionEnd: 11 };
    expect(applyMark(s, "quote", "citation").text).toBe("avant\n> cible\napres");
  });

  it("sur une ligne vide, insère un exemple sélectionné", () => {
    expect(show(applyMark(state("|"), "quote", "citation"))).toBe("> [citation]");
  });
});

describe("insertAtCursor", () => {
  it("insère au curseur et place le curseur derrière", () => {
    expect(show(insertAtCursor(state("bravo |"), "🎉"))).toBe("bravo 🎉|");
  });

  it("remplace la sélection", () => {
    expect(show(insertAtCursor(state("bravo [toi]"), "🎉"))).toBe("bravo 🎉|");
  });
});

describe("findMentionQuery", () => {
  it("repère le @ en cours de frappe", () => {
    expect(findMentionQuery("salut @mar", 10)).toEqual({ start: 6, query: "mar" });
  });

  it("repère un @ en tout début de message", () => {
    expect(findMentionQuery("@mar", 4)).toEqual({ start: 0, query: "mar" });
  });

  it("rend une requête vide juste après le @ — l'autocomplétion s'ouvre aussitôt", () => {
    expect(findMentionQuery("salut @", 7)).toEqual({ start: 6, query: "" });
  });

  it("ignore un @ collé à un mot — sinon toute adresse e-mail ouvrirait la liste", () => {
    expect(findMentionQuery("ecris a contact@commun.fr", 25)).toBeNull();
  });

  it("se ferme à la première espace", () => {
    expect(findMentionQuery("salut @marie et ", 16)).toBeNull();
  });

  it("ne regarde que devant le curseur", () => {
    // Curseur avant le @ : rien à compléter.
    expect(findMentionQuery("salut @marie", 5)).toBeNull();
  });

  it("rend null sans @", () => {
    expect(findMentionQuery("bonjour", 7)).toBeNull();
  });
});

describe("replaceMentionQuery", () => {
  it("remplace la frappe par le slug et laisse une espace", () => {
    const s = state("salut @mar|");
    const query = findMentionQuery(s.text, s.selectionStart);
    expect(query).not.toBeNull();
    expect(show(replaceMentionQuery(s, query!, "marie-dupont")))
      .toBe("salut @marie-dupont |");
  });

  it("préserve ce qui suit le curseur", () => {
    const s: FieldState = { text: "salut @mar, ça va ?", selectionStart: 10, selectionEnd: 10 };
    const query = findMentionQuery(s.text, s.selectionStart)!;
    expect(replaceMentionQuery(s, query, "marie").text).toBe("salut @marie , ça va ?");
  });
});

describe("shouldSubmitOnEnter", () => {
  const base = { key: "Enter", shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };

  it("Entrée envoie", () => {
    expect(shouldSubmitOnEnter(base)).toBe(true);
  });

  it("Maj+Entrée passe à la ligne", () => {
    expect(shouldSubmitOnEnter({ ...base, shiftKey: true })).toBe(false);
  });

  it("n'envoie pas pendant une composition (accents, saisie IME)", () => {
    // Sans cette garde, valider un caractère composé enverrait le message à moitié écrit.
    expect(shouldSubmitOnEnter({ ...base, isComposing: true })).toBe(false);
  });

  it("laisse les combinaisons au navigateur", () => {
    expect(shouldSubmitOnEnter({ ...base, ctrlKey: true })).toBe(false);
    expect(shouldSubmitOnEnter({ ...base, metaKey: true })).toBe(false);
    expect(shouldSubmitOnEnter({ ...base, altKey: true })).toBe(false);
  });

  it("ignore les autres touches", () => {
    expect(shouldSubmitOnEnter({ ...base, key: "a" })).toBe(false);
  });
});
