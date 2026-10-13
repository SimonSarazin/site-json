import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { createCommentMarkdown } from "../markdownEngine";
import { linkifyMentions } from "../linkifyMentions";
import { commentExtensions } from "./extensions";
import { SERIALIZED_MARKS, SERIALIZED_NODES, mentionsOf, parseMarkdown, serializeMarkdown } from "./markdownBridge";
import type { CommentMention } from "../../types";

/**
 * Le pont éditeur ⇄ markdown, jugé sur ce qu'il PROMET : le texte qui sort se rend comme ce que
 * l'éditeur montrait. Le juge est le moteur du fil lui-même (`createCommentMarkdown`) — pas une
 * chaîne attendue écrite à la main, qui dirait seulement que le pont n'a pas changé.
 *
 * Deux familles : les ALLERS-RETOURS (un texte relu puis réécrit se rend pareil), et les
 * DOCUMENTS TAPÉS (ce qu'on a écrit dans l'éditeur ne devient pas autre chose une fois relu).
 */

const schema = getSchema(commentExtensions());
const fil = createCommentMarkdown();
const rendu = (texte: string, mentions: readonly CommentMention[] = []) => fil.render(linkifyMentions(texte, mentions));

const MARIE: CommentMention = { id: "65a1000000000000000000a1", name: "Marie Dupont", slug: "marie-dupont" };
const MARIE_COURTE: CommentMention = { id: "65a1000000000000000000a2", name: "Marie", slug: "marie" };
const ORGA: CommentMention = { id: "65a1000000000000000000a3", name: "Une orga", slug: "une_orga", type: "organizations" };

/** Un paragraphe TAPÉ : du texte, et `null` pour un saut de ligne (Maj+Entrée). */
function paragraphe(...morceaux: readonly (string | null | ProseNode)[]): ProseNode {
  return schema.node("paragraph", null, morceaux.filter(m => m !== "").map(m =>
    m === null ? schema.node("hardBreak") : typeof m === "string" ? schema.text(m) : m));
}
const doc = (...blocs: readonly ProseNode[]) => schema.node("doc", null, [...blocs]);
const marque = (texte: string, ...noms: readonly string[]) => schema.text(texte, noms.map(nom => schema.mark(nom)));
const lien = (texte: string, href: string) => schema.text(texte, [schema.mark("link", { href })]);
const mention = (m: CommentMention) => schema.node("mention", { id: m.id, label: m.name, slug: m.slug, kind: m.type ?? null });
/** Le texte brut que montre un document : ce qu'on a tapé, sauts de ligne compris. */
const texteDe = (html: string) => html.replace(/<br>\n?/g, "\n").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").trim();

describe("le sérialiseur couvre le schéma", () => {
  it("sait écrire chaque nœud et chaque marque du schéma — sinon envoyer un message lèverait", () => {
    const noeuds = Object.keys(schema.nodes).filter(nom => nom !== "doc");
    expect(noeuds.filter(nom => !SERIALIZED_NODES.includes(nom))).toEqual([]);
    expect(Object.keys(schema.marks).filter(nom => !SERIALIZED_MARKS.includes(nom))).toEqual([]);
  });

  it("le schéma n'a ni titre, ni souligné, ni image — et garde le filet", () => {
    expect(schema.nodes.heading).toBeUndefined();
    expect(schema.nodes.image).toBeUndefined();
    expect(schema.marks.underline).toBeUndefined();
    expect(schema.nodes.horizontalRule).toBeDefined();
  });
});

describe("aller-retour : un message relu puis réécrit se rend pareil", () => {
  const CAS: readonly string[] = [
    "Bonjour **tout le monde**, voici *une* ~~rature~~ et du `code`.",
    "Ligne 1\nLigne 2\n\nParagraphe 2",
    "- un\n- deux\n  - deux bis\n- trois",
    "1. un\n2. deux",
    "3. trois\n4. quatre",
    "> une citation\n> sur deux lignes",
    "> citation\n\naprès",
    "```js\nconst a = 1 * 2;\n```",
    "```\nsans langage\n```",
    "    code indenté",
    "Un [lien](https://exemple.org/a_b) et https://auto.exemple.org/x_y_z.",
    "Voir https://exemple.org/page et la suite",
    "(https://exemple.org/entre-parentheses)",
    "<https://exemple.org/chevrons>",
    "2 * 3 * 4 = 24 et snake_case_nom, a_b_ c",
    "# pas un titre",
    "1986\\. une année",
    "\\- pas une liste",
    "Texte avec <b>balise</b> & esperluette",
    "Une entité tapée : \\&amp; et une vraie : &amp;",
    "![image](https://x.org/a.png)",
    "ligne\n\n---\n\nautre",
    "du `code avec ` accent` dedans",
    "**gras *et italique* mêlés**",
    "fin de phrase avec un lien [ici](https://exemple.org/a(b)c).",
    "| a | b |\n|---|---|\n| 1 | 2 |",
    "- [x] pas une case\n- [ ] non plus",
    "un\\\nsaut dur",
    "",
  ];
  for (const texte of CAS) {
    it(JSON.stringify(texte), () => {
      const sorti = serializeMarkdown(parseMarkdown(schema, texte));
      expect(rendu(sorti)).toBe(rendu(texte));
    });
  }

  it("le texte réécrit est STABLE : le relire et le réécrire ne le change plus", () => {
    for (const texte of CAS) {
      const une = serializeMarkdown(parseMarkdown(schema, texte));
      expect(serializeMarkdown(parseMarkdown(schema, une))).toBe(une);
    }
  });
});

describe("ce qu'on a tapé ne devient pas autre chose", () => {
  /** Le document tapé doit se relire comme du TEXTE : un paragraphe, les mêmes caractères. */
  const resteDuTexte = (document: ProseNode, attendu: string) => {
    const html = rendu(serializeMarkdown(document));
    expect(html).not.toMatch(/<(ul|ol|blockquote|h[1-6]|pre|hr|table|a|em|strong|s|code)\b/);
    expect(texteDe(html)).toBe(attendu);
  };

  it("une ligne qui commence par un tiret, après un saut de ligne, n'est pas une liste", () => {
    resteDuTexte(doc(paragraphe("les courses", null, "- du pain", null, "- du lait")), "les courses\n- du pain\n- du lait");
  });

  it("ni une liste numérotée : « 1. » comme « 1) », en tête de bloc comme après un saut", () => {
    resteDuTexte(doc(paragraphe("1. premier")), "1. premier");
    resteDuTexte(doc(paragraphe("1) premier")), "1) premier");
    resteDuTexte(doc(paragraphe("étapes", null, "1. premier", null, "2) second")), "étapes\n1. premier\n2) second");
  });

  it("ni une citation, ni un titre, ni un filet", () => {
    resteDuTexte(doc(paragraphe("il a dit", null, "> pas une citation")), "il a dit\n> pas une citation");
    resteDuTexte(doc(paragraphe("# pas un titre")), "# pas un titre");
    resteDuTexte(doc(paragraphe("au-dessus", null, "---", null, "en dessous")), "au-dessus\n---\nen dessous");
    resteDuTexte(doc(paragraphe("***")), "***");
    resteDuTexte(doc(paragraphe("+ un plus")), "+ un plus");
  });

  it("les signes du markdown tapés restent des signes", () => {
    resteDuTexte(doc(paragraphe("2 * 3 * 4 et _souligné_ et ~~barré~~ et `code` et [crochets](x)")), "2 * 3 * 4 et _souligné_ et ~~barré~~ et `code` et [crochets](x)");
    resteDuTexte(doc(paragraphe("un nom_de_variable et C:\\dossier")), "un nom_de_variable et C:\\dossier");
  });

  it("une entité tapée garde ses caractères — elle n'est pas décodée", () => {
    resteDuTexte(doc(paragraphe("écrire &amp; pour une esperluette, &#39; pour une apostrophe, et R&D tel quel")), "écrire &amp; pour une esperluette, &#39; pour une apostrophe, et R&D tel quel");
  });

  it("du HTML tapé reste du texte", () => {
    resteDuTexte(doc(paragraphe("<b>pas gras</b> <script>alert(1)</script>")), "<b>pas gras</b> <script>alert(1)</script>");
  });

  it("quatre espaces en tête de paragraphe ne font pas un bloc de code", () => {
    const html = rendu(serializeMarkdown(doc(paragraphe("    indenté"))));
    expect(html).not.toContain("<pre>");
    expect(texteDe(html)).toBe("indenté");
  });

  it("une définition de lien tapée ne disparaît pas — son adresse se lit, liée comme toute adresse tapée", () => {
    // Relue telle quelle, la ligne serait une définition : le fil n'en afficherait RIEN.
    const html = rendu(serializeMarkdown(doc(paragraphe("[note]: https://exemple.org"))));
    expect(texteDe(html)).toBe("[note]: https://exemple.org");
    expect(html).toContain('<a href="https://exemple.org">https://exemple.org</a>');
  });

  it("une clôture de code tapée dans un paragraphe ne l'ouvre pas", () => {
    resteDuTexte(doc(paragraphe("```", null, "pas du code", null, "```")), "```\npas du code\n```");
  });

  it("un souligné ne reste nu qu'entre deux lettres ou chiffres : `__init__` n'est pas de l'italique", () => {
    resteDuTexte(doc(paragraphe("__init__ et __a__ et x__y__z et _privé et fin_")), "__init__ et __a__ et x__y__z et _privé et fin_");
    expect(serializeMarkdown(doc(paragraphe("nom_de_variable et a_1_b")))).toBe("nom_de_variable et a_1_b");
  });

  it("un marqueur de liste SEUL sur sa ligne n'ouvre pas une liste vide", () => {
    for (const marqueur of ["1.", "2.", "12)", "+", "-"]) {
      resteDuTexte(doc(paragraphe(marqueur)), marqueur);
      resteDuTexte(doc(paragraphe("avant", null, marqueur)), `avant\n${marqueur}`);
    }
  });

  it("des espaces devant un tiret, après un saut de ligne, ne laissent pas une liste couper le paragraphe", () => {
    resteDuTexte(doc(paragraphe("les courses", null, "  - du pain", null, "   1. et du lait")), "les courses\n- du pain\n1. et du lait");
  });

  it("quatre espaces en tête d'un texte en gras ne font pas un bloc de code non plus", () => {
    const html = rendu(serializeMarkdown(doc(paragraphe(marque("    important", "bold")))));
    expect(html).toBe("<p><strong>important</strong></p>\n");
  });

  it("une adresse entre chevrons tapée garde ses chevrons", () => {
    const html = rendu(serializeMarkdown(doc(paragraphe("<https://exemple.org/page> et <contact@exemple.org>"))));
    expect(texteDe(html)).toBe("<https://exemple.org/page> et <contact@exemple.org>");
  });
});

describe("une adresse tapée sans être un lien", () => {
  // Entrée envoie avant que l'éditeur ait lié l'adresse : elle part en texte, et c'est le fil qui la lie.
  it("garde ses signes : ni `~`, ni `_`, ni `*` ne reçoivent une barre oblique inverse qui partirait dans le lien", () => {
    const adresse = "https://exemple.org/~jean/_brouillon_/a*b*c?x=[1]";
    const sorti = serializeMarkdown(doc(paragraphe(`voir ${adresse} ici`)));
    expect(sorti).toBe(`voir ${adresse} ici`);
    expect(rendu(sorti)).toContain(`<a href="${fil.normalizeLink(adresse)}">${adresse}</a>`);
  });

  it("le texte autour, lui, reste échappé", () => {
    const sorti = serializeMarkdown(doc(paragraphe("*pas italique* https://exemple.org/_x_ *non plus*")));
    expect(rendu(sorti)).toBe('<p>*pas italique* <a href="https://exemple.org/_x_">https://exemple.org/_x_</a> *non plus*</p>\n');
  });

  it("une étoile finale n'est pas dans l'adresse : elle reste un signe", () => {
    const html = rendu(serializeMarkdown(doc(paragraphe("*https://exemple.org/a* et la suite*"))));
    expect(html).not.toContain("<em>");
    expect(html).toContain('<a href="https://exemple.org/a">https://exemple.org/a</a>');
    expect(texteDe(html)).toBe("*https://exemple.org/a* et la suite*");
  });

  it.each(["*", "_", "~", "`", "[", "]"])("un « %s » collé derrière l'adresse n'y fait pas entrer de barre oblique inverse", signe => {
    const tape = `https://exemple.org/a${signe} fin`;
    const html = rendu(serializeMarkdown(doc(paragraphe(tape))));
    expect(html).not.toContain("%5C");
    expect(texteDe(html)).toBe(tape);
  });

  it.each(["_", "~~", "`", "[", "**"])("ni un « %s » qui l'entoure", signe => {
    const ferme = signe === "[" ? "]" : signe;
    const tape = `${signe}https://exemple.org/a${ferme}`;
    const html = rendu(serializeMarkdown(doc(paragraphe(tape))));
    expect(html).not.toMatch(/<(em|strong|s|code)\b|%5C/);
    expect(texteDe(html)).toBe(tape);
  });

  it("deux adresses suivies chacune d'une étoile ne font pas une marque entre elles", () => {
    const tape = "https://exemple.org/*) et https://exemple.org/b*";
    const html = rendu(serializeMarkdown(doc(paragraphe(tape))));
    expect(html).not.toContain("<em>");
    expect(texteDe(html)).toBe(tape);
  });
});

describe("les marques et les blocs s'écrivent en markdown", () => {
  it("gras, italique, barré, code", () => {
    const sorti = serializeMarkdown(doc(paragraphe("du ", marque("gras", "bold"), ", de l'", marque("italique", "italic"), ", du ", marque("barré", "strike"), " et du ", marque("code", "code"))));
    expect(sorti).toBe("du **gras**, de l'*italique*, du ~~barré~~ et du `code`");
  });

  it("une marque ne garde pas l'espace qui la borde : « **gras **» ne se relirait pas", () => {
    const sorti = serializeMarkdown(doc(paragraphe(marque("gras ", "bold"), "suite")));
    expect(sorti).toBe("**gras** suite");
    expect(rendu(sorti)).toContain("<strong>gras</strong> suite");
  });

  it("un saut de ligne est un simple retour à la ligne, et un saut final ne s'écrit pas", () => {
    expect(serializeMarkdown(doc(paragraphe("un", null, "deux", null)))).toBe("un\ndeux");
    // Plusieurs sauts en fin de paragraphe : aucun ne se lirait, aucun ne s'écrit.
    expect(serializeMarkdown(doc(paragraphe("un", null, null)))).toBe("un");
  });

  it("seul le DÉBUT d'une ligne est échappé comme tel : plus loin, un tiret reste un tiret", () => {
    const sorti = serializeMarkdown(doc(paragraphe("à", null, "voir ", marque("ici", "bold"), "- et là, 1. non plus")));
    expect(sorti).toBe("à\nvoir **ici**- et là, 1. non plus");
  });

  it("un croisillon en tête de ligne est échappé — le fil n'a pas de titre, un autre lecteur du message pourrait", () => {
    expect(serializeMarkdown(doc(paragraphe("# pas un titre", null, "## non plus")))).toBe("\\# pas un titre\n\\## non plus");
  });

  it("deux paragraphes sont séparés d'une ligne vide", () => {
    expect(serializeMarkdown(doc(paragraphe("un"), paragraphe("deux")))).toBe("un\n\ndeux");
  });

  it("une liste à puces, une liste numérotée qui garde son départ, une citation, un bloc de code", () => {
    const item = (texte: string) => schema.node("listItem", null, [paragraphe(texte)]);
    expect(serializeMarkdown(doc(schema.node("bulletList", null, [item("un"), item("deux")])))).toBe("- un\n- deux");
    expect(serializeMarkdown(doc(schema.node("orderedList", { start: 3 }, [item("trois"), item("quatre")])))).toBe("3. trois\n4. quatre");
    expect(serializeMarkdown(doc(schema.node("blockquote", null, [paragraphe("cité", null, "encore")])))).toBe("> cité\n> encore");
    expect(serializeMarkdown(doc(schema.node("codeBlock", { language: "js" }, [schema.text("const a = 1 * 2;")])))).toBe("```js\nconst a = 1 * 2;\n```");
  });

  it("dans un bloc de code rien n'est échappé, et la clôture dépasse les accents du contenu", () => {
    const sorti = serializeMarkdown(doc(schema.node("codeBlock", null, [schema.text("a * b\n```\n# c")])));
    expect(sorti).toBe("````\na * b\n```\n# c\n````");
    expect(rendu(sorti)).toContain("a * b\n```\n# c");
  });

  it("dans une citation, une ligne après un saut garde son chevron — et son échappement", () => {
    const sorti = serializeMarkdown(doc(schema.node("blockquote", null, [paragraphe("cité", null, "- pas une liste")])));
    expect(sorti).toBe("> cité\n> \\- pas une liste");
    expect(rendu(sorti)).not.toContain("<ul>");
  });
});

describe("les liens", () => {
  it("un lien dont le texte est l'adresse s'écrit par son adresse seule, quand rien ne s'y colle", () => {
    const adresse = "https://exemple.org/a_b";
    expect(serializeMarkdown(doc(paragraphe("voir ", lien(adresse, adresse), " merci")))).toBe(`voir ${adresse} merci`);
    expect(serializeMarkdown(doc(paragraphe(lien(adresse, adresse))))).toBe(adresse);
    expect(serializeMarkdown(doc(paragraphe("voir", null, lien(adresse, adresse), null, "merci")))).toBe(`voir\n${adresse}\nmerci`);
  });

  it("… entre chevrons dès qu'un caractère s'y colle, devant ou derrière", () => {
    const adresse = "https://exemple.org/page";
    const colleDerriere = serializeMarkdown(doc(paragraphe("voir ", lien(adresse, adresse), ".")));
    expect(colleDerriere).toBe(`voir <${adresse}>.`);
    expect(rendu(colleDerriere)).toContain(`<a href="${adresse}">${adresse}</a>.`);
    expect(serializeMarkdown(doc(paragraphe("(", lien(adresse, adresse), ")")))).toBe(`(<${adresse}>)`);
    // Collé devant SEULEMENT : c'est assez pour que le fil ne relise plus l'adresse seule.
    expect(serializeMarkdown(doc(paragraphe("x", lien(adresse, adresse))))).toBe(`x<${adresse}>`);
  });

  it("… entre chevrons aussi quand l'adresse seule ne se relirait pas entière", () => {
    // Une parenthèse fermante finale est retirée de l'adresse par `linkify`.
    const adresse = "https://exemple.org/a)";
    const sorti = serializeMarkdown(doc(paragraphe(lien(adresse, adresse))));
    expect(sorti).toBe(`<${adresse}>`);
  });

  it("un lien nommé garde sa forme, parenthèses de l'adresse échappées", () => {
    const sorti = serializeMarkdown(doc(paragraphe("voir ", lien("la page", "https://exemple.org/a(b)c"))));
    expect(sorti).toBe("voir [la page](https://exemple.org/a\\(b\\)c)");
    expect(rendu(sorti)).toContain('<a href="https://exemple.org/a(b)c">la page</a>');
  });

  it("le texte d'un lien nommé est échappé comme le reste", () => {
    const sorti = serializeMarkdown(doc(paragraphe(lien("a*b", "https://exemple.org"))));
    expect(rendu(sorti)).toContain(">a*b</a>");
  });

  it("ce que le fil lie de lui-même sans protocole s'écrit tel quel, et ne change pas à l'édition", () => {
    for (const texte of ["voir www.exemple.org ici", "écrire à contact@exemple.org", "exemple.org"]) {
      expect(serializeMarkdown(parseMarkdown(schema, texte))).toBe(texte);
    }
  });

  it("le texte d'un lien écrit seul sort signe pour signe : échappé, le fil n'y relirait plus le lien entier", () => {
    const sorti = serializeMarkdown(doc(paragraphe(lien("www.exemple.org/~jean/a*b", "http://www.exemple.org/~jean/a*b"))));
    expect(sorti).toBe("www.exemple.org/~jean/a*b");
    expect(rendu(sorti)).toBe('<p><a href="http://www.exemple.org/~jean/a*b">www.exemple.org/~jean/a*b</a></p>\n');
  });

  it("une espace dans l'adresse d'un lien nommé est encodée : elle le couperait", () => {
    const sorti = serializeMarkdown(doc(paragraphe(lien("le fichier", "https://exemple.org/mon fichier.pdf"))));
    expect(sorti).toBe("[le fichier](https://exemple.org/mon%20fichier.pdf)");
    expect(rendu(sorti)).toContain('<a href="https://exemple.org/mon%20fichier.pdf">le fichier</a>');
  });

  it("une adresse où une marque se lirait s'écrit quand même par elle seule : c'est le rendu qui juge", () => {
    const adresse = "https://exemple.org/_a_/b*c*d";
    const sorti = serializeMarkdown(doc(paragraphe(lien(adresse, adresse))));
    expect(sorti).toBe(adresse);
    expect(rendu(sorti)).toBe(`<p><a href="${adresse}">${adresse}</a></p>\n`);
  });

  it("un lien interne garde sa forme nommée", () => {
    expect(serializeMarkdown(doc(paragraphe(lien("@Marie", "/profil/marie"))))).toBe("[@Marie](/profil/marie)");
  });

  it("une adresse relue par `linkify` redevient un lien de même cible", () => {
    const relu = parseMarkdown(schema, "voir https://exemple.org/x_y ici");
    const liens: string[] = [];
    relu.descendants(node => { for (const m of node.marks) if (m.type.name === "link") liens.push(String(m.attrs.href)); });
    expect(liens).toEqual(["https://exemple.org/x_y"]);
  });
});

describe("les mentions", () => {
  it("une mention s'écrit `@slug`, et se relit en nœud quand le message la porte", () => {
    const tape = doc(paragraphe("Salut ", mention(MARIE), " !"));
    expect(serializeMarkdown(tape)).toBe("Salut @marie-dupont !");
    const relu = parseMarkdown(schema, "Salut @marie-dupont !", [MARIE]);
    expect(mentionsOf(relu)).toEqual([MARIE]);
    expect(serializeMarkdown(relu)).toBe("Salut @marie-dupont !");
  });

  it("sans la liste du message, `@slug` reste du texte — et n'est pas renvoyé comme une mention", () => {
    const relu = parseMarkdown(schema, "Salut @marie-dupont !");
    expect(mentionsOf(relu)).toEqual([]);
    expect(serializeMarkdown(relu)).toBe("Salut @marie-dupont !");
  });

  it("le plus long slug d'abord : `@marie` ne se lit pas dans `@marie-dupont`", () => {
    const relu = parseMarkdown(schema, "@marie-dupont et @marie", [MARIE_COURTE, MARIE]);
    expect(mentionsOf(relu).map(m => m.slug)).toEqual(["marie-dupont", "marie"]);
  });

  // Un slug à point : rien, derrière « jean », n'interdit de le lire dans « jean.dupont » — sauf l'ordre.
  it("le plus long d'abord, même quand la frontière ne suffit pas à les départager", () => {
    const jean: CommentMention = { id: "65a1000000000000000000b1", name: "Jean", slug: "jean" };
    const jeanDupont: CommentMention = { id: "65a1000000000000000000b2", name: "Jean Dupont", slug: "jean.dupont" };
    const relu = parseMarkdown(schema, "avec @jean.dupont", [jean, jeanDupont]);
    expect(mentionsOf(relu)).toEqual([jeanDupont]);
    expect(serializeMarkdown(relu)).toBe("avec @jean.dupont");
  });

  it("ni caractère de mot ni tiret derrière : `@marie2` et `@marie-x` ne sont pas `@marie`", () => {
    expect(mentionsOf(parseMarkdown(schema, "@marie2 et @marie-x et @marie_y", [MARIE_COURTE]))).toEqual([]);
    expect(mentionsOf(parseMarkdown(schema, "@marie, @marie. (@marie)", [MARIE_COURTE]))).toEqual([MARIE_COURTE]);
  });

  it("dans du code, `@slug` est du texte", () => {
    expect(mentionsOf(parseMarkdown(schema, "`@marie` et\n```\n@marie\n```", [MARIE_COURTE]))).toEqual([]);
  });

  it("comme le fil, on ne regarde pas ce qui précède", () => {
    const texte = "contact@marie.org";
    expect(mentionsOf(parseMarkdown(schema, texte, [MARIE_COURTE]))).toEqual([MARIE_COURTE]);
    expect(rendu(texte, [MARIE_COURTE])).toContain("/profil/marie");
  });

  it("le type d'une mention venue du legacy survit à l'édition", () => {
    const relu = parseMarkdown(schema, "avec @une_orga", [ORGA]);
    expect(mentionsOf(relu)).toEqual([ORGA]);
    expect(serializeMarkdown(relu)).toBe("avec @une_orga");
  });

  it("une personne citée deux fois n'est renvoyée qu'une fois ; retirée du texte, elle ne l'est plus", () => {
    expect(mentionsOf(doc(paragraphe(mention(MARIE), " et ", mention(MARIE))))).toEqual([MARIE]);
    expect(mentionsOf(doc(paragraphe("plus personne")))).toEqual([]);
  });

  it("le message relu se rend comme l'original, mentions comprises", () => {
    const texte = "Salut @marie-dupont et **@marie** !";
    const sorti = serializeMarkdown(parseMarkdown(schema, texte, [MARIE, MARIE_COURTE]));
    expect(rendu(sorti, [MARIE, MARIE_COURTE])).toBe(rendu(texte, [MARIE, MARIE_COURTE]));
  });

  it("une mention en tête de ligne, après un saut, ne décale pas l'échappement de la suite", () => {
    const sorti = serializeMarkdown(doc(paragraphe("à", null, mention(MARIE), " - pas une liste")));
    expect(sorti).toBe("à\n@marie-dupont - pas une liste");
  });
});

describe("le document vide", () => {
  it("un message vide donne un document à un paragraphe vide, qui ne s'écrit pas", () => {
    const vide = parseMarkdown(schema, "");
    expect(vide.childCount).toBe(1);
    expect(vide.firstChild?.type.name).toBe("paragraph");
    expect(serializeMarkdown(vide)).toBe("");
  });
});
