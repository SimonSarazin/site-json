import { describe, expect, it } from "vitest";
import { linkifyMentions, markSelfMentions } from "./linkifyMentions";
import type { CommentMention } from "../types";

const m = (slug: string, name: string): CommentMention => ({ id: slug, name, slug });

describe("linkifyMentions", () => {
  it("transforme une mention en lien vers le profil", () => {
    expect(linkifyMentions("bonjour @marie", [m("marie", "Marie")]))
      .toBe("bonjour [@Marie](/profil/marie)");
  });

  it("laisse le texte intact quand il n'y a aucune mention", () => {
    expect(linkifyMentions("bonjour @marie", [])).toBe("bonjour @marie");
    expect(linkifyMentions("texte simple", [m("marie", "Marie")])).toBe("texte simple");
  });

  it("ne coupe PAS un slug plus long — le bug de `parseMentionsToMarkdown`", () => {
    // Avec `\b` et sans tri, `@marie` était substitué dans `@marie-dupont`, laissant
    // « [@Marie](/profil/marie)-dupont » à l'écran.
    const mentions = [m("marie", "Marie"), m("marie-dupont", "Marie Dupont")];
    expect(linkifyMentions("salut @marie-dupont", mentions))
      .toBe("salut [@Marie Dupont](/profil/marie-dupont)");
  });

  it("traite les deux quand les deux sont mentionnés", () => {
    const mentions = [m("marie", "Marie"), m("marie-dupont", "Marie Dupont")];
    expect(linkifyMentions("@marie et @marie-dupont", mentions))
      .toBe("[@Marie](/profil/marie) et [@Marie Dupont](/profil/marie-dupont)");
  });

  it("échappe les métacaractères d'un slug — sinon le slug devient de la syntaxe", () => {
    const mentions = [m("a.b", "Point")];
    expect(linkifyMentions("@axb", mentions)).toBe("@axb");
    expect(linkifyMentions("@a.b", mentions)).toBe("[@Point](/profil/a.b)");
  });

  it("ne re-balaie pas un lien qu'il vient de produire", () => {
    const mentions = [m("marie", "Marie"), m("profil", "Profil")];
    const out = linkifyMentions("@marie", mentions);
    expect(out).toBe("[@Marie](/profil/marie)");
    expect(out).not.toContain("[@Profil]");
  });

  it("ne touche pas à une mention écrite dans un span de code", () => {
    expect(linkifyMentions("voir `@marie` ici", [m("marie", "Marie")]))
      .toBe("voir `@marie` ici");
  });

  it("ne touche pas à une mention dans un bloc de code clôturé", () => {
    const text = "```\ncurl -u @marie\n```";
    expect(linkifyMentions(text, [m("marie", "Marie")])).toBe(text);
  });

  it("substitue hors code même quand du code est présent", () => {
    const out = linkifyMentions("salut @marie, cf. `@marie`", [m("marie", "Marie")]);
    expect(out).toBe("salut [@Marie](/profil/marie), cf. `@marie`");
  });

  it("un accent grave ÉCHAPPÉ est un signe, pas un code : la mention qui le suit reste liée", () => {
    // Sans cela le premier accent s'appariait au deuxième, et « @marie » passait pour du code.
    expect(linkifyMentions("le signe \\` puis @marie et du `code`", [m("marie", "Marie")]))
      .toBe("le signe \\` puis [@Marie](/profil/marie) et du `code`");
    expect(linkifyMentions("\\`@marie\\`", [m("marie", "Marie")])).toBe("\\`[@Marie](/profil/marie)\\`");
  });

  it("dans un code, une barre oblique inverse n'échappe rien : le span se ferme à son accent", () => {
    expect(linkifyMentions("`a\\` @marie `b`", [m("marie", "Marie")])).toBe("`a\\` [@Marie](/profil/marie) `b`");
    expect(linkifyMentions("`@marie\\` et @marie", [m("marie", "Marie")])).toBe("`@marie\\` et [@Marie](/profil/marie)");
  });

  it("une barre oblique inverse échappée, puis un vrai code : le code reste du code", () => {
    expect(linkifyMentions("C:\\\\`@marie`", [m("marie", "Marie")])).toBe("C:\\\\`@marie`");
  });

  it("échappe les crochets d'un nom, qui casseraient le lien", () => {
    expect(linkifyMentions("@x", [m("x", "Marie [test]")]))
      .toBe("[@Marie \\[test\\]](/profil/x)");
  });

  it("retombe sur le slug quand le nom est vide", () => {
    expect(linkifyMentions("@marie", [m("marie", "")])).toBe("[@marie](/profil/marie)");
  });

  it("ignore une mention sans slug plutôt que de produire un lien mort", () => {
    expect(linkifyMentions("@marie", [{ id: "1", name: "Marie", slug: "" }]))
      .toBe("@marie");
  });

  it("accepte un texte absent — la donnée runtime peut l'être malgré le type", () => {
    expect(linkifyMentions(undefined as unknown as string, [m("marie", "Marie")])).toBe("");
  });
});

describe("markSelfMentions — le @moi, marqué APRÈS l'assainissement", () => {
  const html = '<p><a href="/profil/raya">@Raya</a> et <a href="/profil/simon">@Simon</a></p>';

  it("marque le lien vers MON profil, et lui seul", () => {
    const out = markSelfMentions(html, ["/profil/raya"]);
    expect(out).toContain('<a href="/profil/raya" data-mention-me="">@Raya</a>');
    expect(out).toContain('<a href="/profil/simon">@Simon</a>');
  });

  it("exige un lien IDENTIQUE : /profil/raya ne marque pas /profil/raya-2", () => {
    expect(markSelfMentions('<a href="/profil/raya-2">@R2</a>', ["/profil/raya"])).not.toContain("data-mention-me");
  });

  it("échappe le lien : un point n'y est pas un joker", () => {
    expect(markSelfMentions('<a href="/profil/aXb">x</a>', ["/profil/a.b"])).not.toContain("data-mention-me");
  });

  it("marque chaque occurrence", () => {
    expect(markSelfMentions(`${html}${html}`, ["/profil/raya"]).match(/data-mention-me/g)).toHaveLength(2);
  });

  it("sans lien à marquer, rend le HTML intact", () => {
    expect(markSelfMentions(html, [])).toBe(html);
    expect(markSelfMentions(html, [""])).toBe(html);
  });
});
