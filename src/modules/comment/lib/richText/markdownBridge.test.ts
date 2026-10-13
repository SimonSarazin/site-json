import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { createCommentMarkdown } from "../markdownEngine";
import { linkifyMentions } from "../linkifyMentions";
import { commentExtensions } from "./extensions";
import { SERIALIZED_MARKS, SERIALIZED_NODES, addressOf, isBlank, mentionsOf, parseMarkdown, serializeMarkdown } from "./markdownBridge";
import type { CommentMention } from "../../types";

/**
 * Le pont éditeur ⇄ markdown, jugé sur ce qu'il PROMET : le texte qui sort se rend comme ce que
 * l'éditeur montrait. Le juge est le moteur du fil lui-même (`createCommentMarkdown`) — pas une
 * chaîne attendue écrite à la main, qui dirait seulement que le pont n'a pas changé.
 *
 * Deux familles : les ALLERS-RETOURS (un texte relu puis réécrit se rend pareil), et les
 * DOCUMENTS TAPÉS (ce qu'on a écrit dans l'éditeur ne devient pas autre chose une fois relu).
 *
 * Et une seconde promesse, jugée elle sur le TEXTE : il sort tel qu'on l'a tapé chaque fois que le
 * fil le rendrait pareil — un message se lit aussi là où le markdown n'est pas rendu.
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
/** Un lien ÉCRIT (le bouton Lien, ou un `[texte](adresse)` relu) : sa cible est celle qu'on lui a donnée. */
const lienEcrit = (texte: string, href: string) => schema.text(texte, [schema.mark("link", { href, explicit: true })]);
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

  // EN TÊTE de paragraphe, l'éditeur fait lui-même une liste de « - » : qui l'a défaite veut le signe.
  it("en tête de paragraphe, un tiret tapé n'est pas une liste", () => {
    resteDuTexte(doc(paragraphe("- du pain")), "- du pain");
    resteDuTexte(doc(paragraphe("- du pain", null, "et du lait")), "- du pain\net du lait");
  });

  it("ni une liste numérotée : « 1. » comme « 1) »", () => {
    resteDuTexte(doc(paragraphe("1. premier")), "1. premier");
    resteDuTexte(doc(paragraphe("1) premier")), "1) premier");
  });

  it("ni une citation, ni un titre, ni un filet", () => {
    resteDuTexte(doc(paragraphe("> pas une citation")), "> pas une citation");
    resteDuTexte(doc(paragraphe(">collé")), ">collé");
    resteDuTexte(doc(paragraphe("# pas un titre")), "# pas un titre");
    resteDuTexte(doc(paragraphe("---")), "---");
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

  it("quatre espaces en tête d'un texte en gras ne font pas un bloc de code non plus", () => {
    const html = rendu(serializeMarkdown(doc(paragraphe(marque("    important", "bold")))));
    expect(html).toBe("<p><strong>important</strong></p>\n");
  });

  it("une adresse entre chevrons tapée garde ses chevrons", () => {
    const html = rendu(serializeMarkdown(doc(paragraphe("<https://exemple.org/page> et <contact@exemple.org>"))));
    expect(texteDe(html)).toBe("<https://exemple.org/page> et <contact@exemple.org>");
  });

  // Entre chevrons, le markdown lie un courriel que le fil ne lierait pas de lui-même (sans domaine de tête).
  it("… un courriel sans domaine de tête aussi : `<jean@serveur>` reste écrit tel quel", () => {
    const html = rendu(serializeMarkdown(doc(paragraphe("écrire à <jean@serveur> ou <tel:0102>"))));
    expect(html).not.toContain("<a ");
    expect(texteDe(html)).toBe("écrire à <jean@serveur> ou <tel:0102>");
  });
});

/**
 * La seconde promesse : le texte sort TEL QU'ON L'A TAPÉ chaque fois que le fil le rendrait pareil.
 * Jugée sur la chaîne elle-même — c'est elle qu'affichent l'écran legacy, une notification, la
 * citation d'une réponse, où une barre oblique inverse « de précaution » se verrait.
 */
describe("le texte sort tel qu'on l'a tapé", () => {
  const telQuel = (tape: string) => expect(serializeMarkdown(doc(paragraphe(tape)))).toBe(tape);

  it("des signes du markdown qui ne font rien ne reçoivent aucune barre oblique inverse", () => {
    telQuel("[urgent] réunion ~10h, 2 * 3 = 6, voir fichier_ et C:\\dossier");
    telQuel("un [crochet] seul, une * étoile seule, un ~ tilde, un ` accent, un _ souligné");
    telQuel("-5 degrés");
    telQuel("-> voilà");
    telQuel("# pas un titre");
    telQuel("1986 fut une année. 2) non plus");
    telQuel("R&D, <3 et a < b > c");
    telQuel("prix* (*hors taxes");
  });

  it("… et ceux qui feraient quelque chose la reçoivent, eux seuls", () => {
    const sortis = (tape: string) => serializeMarkdown(doc(paragraphe(tape)));
    expect(sortis("a *x* b")).toBe("a \\*x\\* b");
    expect(sortis("du `code` tapé")).toBe("du \\`code\\` tapé");
    expect(sortis("[texte](https://exemple.org)")).toContain("\\[texte\\]");
    expect(sortis("- du pain")).toBe("\\- du pain");
    expect(sortis("1. premier")).toBe("1\\. premier");
    expect(sortis("> cité")).toBe("\\> cité");
    expect(sortis("une entité &amp; tapée")).toBe("une entité \\&amp; tapée");
    expect(sortis("__init__")).toBe("\\_\\_init\\_\\_");
  });

  it("le fil est le seul juge : ce qu'il rend du texte sorti est ce qu'il rendrait du texte tout échappé", () => {
    for (const tape of ["[urgent] ~10h 2 * 3", "a *x* b", "- du pain", "# titre", "fin_ et _debut", "a_b_c", "**", "~~", "``", "[a](b", "![x](y)"]) {
      const html = rendu(serializeMarkdown(doc(paragraphe(tape))));
      expect(html).not.toMatch(/<(ul|ol|blockquote|h[1-6]|pre|hr|table|a|em|strong|s|code)\b/);
      expect(texteDe(html)).toBe(tape);
    }
  });

  it("bloc par bloc : un paragraphe qui a besoin d'être échappé n'entraîne pas son voisin", () => {
    const sorti = serializeMarkdown(doc(paragraphe("[urgent] ~10h"), paragraphe("a *x* b et [là]"), paragraphe("fin [là]")));
    expect(sorti).toBe("[urgent] ~10h\n\na \\*x\\* b et \\[là\\]\n\nfin [là]");
  });

  it("une définition de lien tapée reste échappée — et le `[note]` d'un autre paragraphe ne devient pas un lien", () => {
    const sorti = serializeMarkdown(doc(paragraphe("voir [note]"), paragraphe("[note]: https://exemple.org")));
    expect(sorti.startsWith("voir [note]\n\n\\[note\\]: ")).toBe(true);
    expect(rendu(sorti)).not.toContain(">note</a>");
    expect(texteDe(rendu(sorti))).toBe("voir [note]\n[note]: https://exemple.org".replace("\n", "\n"));
  });

  it("dans une liste, un seul élément qui en a besoin fait échapper la liste entière — jamais l'inverse", () => {
    const item = (texte: string) => schema.node("listItem", null, [paragraphe(texte)]);
    expect(serializeMarkdown(doc(schema.node("bulletList", null, [item("[un]"), item("~deux")])))).toBe("- [un]\n- ~deux");
    const melee = serializeMarkdown(doc(schema.node("bulletList", null, [item("[un]"), item("a *x* b")])));
    expect(melee).toBe("- \\[un\\]\n- a \\*x\\* b");
  });

  it("une mention n'y change rien : le texte autour sort nu, et elle reste liée", () => {
    const sorti = serializeMarkdown(doc(paragraphe("[urgent] ", mention(MARIE), " ~10h")));
    expect(sorti).toBe("[urgent] @marie-dupont ~10h");
    expect(rendu(sorti, [MARIE])).toContain('<a href="/profil/marie-dupont">@Marie Dupont</a>');
  });

  it("un texte relu puis réécrit ne gagne pas de barres obliques inverses", () => {
    for (const texte of ["[urgent] réunion ~10h, 2 * 3 = 6", "# pas un titre", "Voir C:\\dossier et fichier_"]) {
      expect(serializeMarkdown(parseMarkdown(schema, texte))).toBe(texte);
    }
  });
});

/**
 * L'exception assumée : après un Maj+Entrée, une ligne tapée comme une liste, une citation ou un
 * filet PART TELLE QUELLE — le fil en fait une liste, une citation, un filet, comme il l'a toujours
 * fait d'un texte tapé ainsi. La neutraliser coûterait une barre oblique inverse visible partout où
 * le markdown n'est pas rendu.
 */
describe("après un saut de ligne, une ligne tapée comme du markdown en est", () => {
  it("une liste à tirets, puis une liste numérotée", () => {
    const sorti = serializeMarkdown(doc(paragraphe("Courses :", null, "- pain", null, "- lait", null, "1. et le reste")));
    expect(sorti).toBe("Courses :\n- pain\n- lait\n1. et le reste");
    expect(rendu(sorti)).toBe("<p>Courses :</p>\n<ul>\n<li>pain</li>\n<li>lait</li>\n</ul>\n<ol>\n<li>et le reste</li>\n</ol>\n");
  });

  it("une citation, un filet", () => {
    expect(rendu(serializeMarkdown(doc(paragraphe("il a dit", null, "> ceci"))))).toBe("<p>il a dit</p>\n<blockquote>\n<p>ceci</p>\n</blockquote>\n");
    expect(rendu(serializeMarkdown(doc(paragraphe("au-dessus", null, "---", null, "en dessous"))))).toBe("<p>au-dessus</p>\n<hr>\n<p>en dessous</p>\n");
  });

  it("une clôture de code, elle, reste neutralisée : ouverte, elle avalerait la suite du message", () => {
    const sorti = serializeMarkdown(doc(paragraphe("voici", null, "```", null, "pas du code"), paragraphe("ni ceci")));
    expect(rendu(sorti)).not.toContain("<pre>");
    expect(texteDe(rendu(sorti))).toBe("voici\n```\npas du code\nni ceci");
  });

  it("une ligne VIDE au milieu d'un paragraphe ouvre un bloc : quatre espaces derrière elle n'en font pas du code", () => {
    const sorti = serializeMarkdown(doc(paragraphe("un", null, null, "    indenté")));
    expect(sorti).toBe("un\n\nindenté");
    expect(rendu(sorti)).toBe("<p>un</p>\n<p>indenté</p>\n");
    // … dans une citation aussi, où la ligne vide porte son chevron.
    const cite = serializeMarkdown(doc(schema.node("blockquote", null, [paragraphe("un", null, null, "    indenté")])));
    expect(rendu(cite)).not.toContain("<pre>");
    // Après un saut SIMPLE, les espaces restent : un bloc de code ne coupe pas un paragraphe.
    expect(serializeMarkdown(doc(paragraphe("un", null, "    indenté")))).toBe("un\n    indenté");
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

  it("en fin de texte, suivie de rien, elle reste nue même dans un bloc qu'il faut échapper", () => {
    expect(serializeMarkdown(doc(paragraphe("a *x* b et https://exemple.org/a")))).toBe("a \\*x\\* b et https://exemple.org/a");
    expect(serializeMarkdown(doc(paragraphe("a *x* b et https://exemple.org/a", null, "suite")))).toBe("a \\*x\\* b et https://exemple.org/a\nsuite");
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

  it("un croisillon en tête de ligne sort tel quel : le fil n'a pas de titre, il n'y a rien à neutraliser", () => {
    expect(serializeMarkdown(doc(paragraphe("# pas un titre", null, "## non plus")))).toBe("# pas un titre\n## non plus");
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

  it("dans un bloc de code, le retrait de la première ligne est du code : il reste", () => {
    const sorti = serializeMarkdown(doc(schema.node("codeBlock", null, [schema.text("    retrait\n  moins")])));
    expect(sorti).toBe("```\n    retrait\n  moins\n```");
  });

  it("dans un bloc de code rien n'est échappé, et la clôture dépasse les accents du contenu", () => {
    const sorti = serializeMarkdown(doc(schema.node("codeBlock", null, [schema.text("a * b\n```\n# c")])));
    expect(sorti).toBe("````\na * b\n```\n# c\n````");
    expect(rendu(sorti)).toContain("a * b\n```\n# c");
  });

  it("dans une citation, une ligne après un saut garde son chevron", () => {
    const sorti = serializeMarkdown(doc(schema.node("blockquote", null, [paragraphe("cité", null, "encore, 2 * 3")])));
    expect(sorti).toBe("> cité\n> encore, 2 * 3");
    expect(rendu(sorti)).toBe("<blockquote>\n<p>cité<br>\nencore, 2 * 3</p>\n</blockquote>\n");
  });
});

describe("les liens", () => {
  it("un lien dont le texte est l'adresse s'écrit par son adresse seule, quand rien ne s'y colle", () => {
    const adresse = "https://exemple.org/a_b";
    expect(serializeMarkdown(doc(paragraphe("voir ", lien(adresse, adresse), " merci")))).toBe(`voir ${adresse} merci`);
    expect(serializeMarkdown(doc(paragraphe(lien(adresse, adresse))))).toBe(adresse);
    expect(serializeMarkdown(doc(paragraphe("voir", null, lien(adresse, adresse), null, "merci")))).toBe(`voir\n${adresse}\nmerci`);
  });

  // Ce que tape tout le monde : une adresse en fin de phrase, ou entre parenthèses.
  it("une ponctuation collée derrière, des parenthèses autour : l'adresse reste nue — le fil s'arrête de lui-même où il faut", () => {
    const adresse = "https://exemple.org/page";
    const suivie = serializeMarkdown(doc(paragraphe("voir ", lien(adresse, adresse), ". Merci")));
    expect(suivie).toBe(`voir ${adresse}. Merci`);
    expect(rendu(suivie)).toBe(`<p>voir <a href="${adresse}">${adresse}</a>. Merci</p>\n`);
    const entouree = serializeMarkdown(doc(paragraphe("(", lien(adresse, adresse), "), et la suite")));
    expect(entouree).toBe(`(${adresse}), et la suite`);
    expect(rendu(entouree)).toBe(`<p>(<a href="${adresse}">${adresse}</a>), et la suite</p>\n`);
  });

  it("… entre chevrons quand, sans eux, le fil lirait autre chose : une lettre collée devant, un gras collé derrière", () => {
    const adresse = "https://exemple.org/page";
    // Collé devant SEULEMENT : c'est assez pour que le fil ne relise plus l'adresse.
    expect(serializeMarkdown(doc(paragraphe("x", lien(adresse, adresse))))).toBe(`x<${adresse}>`);
    const gras = serializeMarkdown(doc(paragraphe(lien(adresse, adresse), marque("b", "bold"))));
    expect(gras).toBe(`<${adresse}>**b**`);
    expect(rendu(gras)).toBe(`<p><a href="${adresse}">${adresse}</a><strong>b</strong></p>\n`);
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

/**
 * La cible d'un lien dont le texte est une adresse. L'éditeur lie de lui-même une adresse tapée ou
 * collée, puis laisse corriger son texte sans toucher à sa cible (relecture du 13/10) : on lisait
 * une adresse, on allait à une autre. Sauf lien ÉCRIT exprès, c'est le texte qui dit où il mène.
 */
describe("un lien dont le texte est une adresse", () => {
  it("mène à l'adresse qu'on LIT : complétée, corrigée ou remplacée, la cible suit le texte", () => {
    for (const [texte, perimee] of [
      ["https://exemple.org/page", "https://exemple.org/pag"],
      ["https://exemple.org/nouvelle-page", "https://exemple.org/ancienne-page"],
      ["https://exemple.org/pagesuite", "https://exemple.org/page"],
    ] as const) {
      const sorti = serializeMarkdown(doc(paragraphe("voir ", lien(texte, perimee), " merci")));
      expect(sorti).toBe(`voir ${texte} merci`);
      expect(rendu(sorti)).toBe(`<p>voir <a href="${texte}">${texte}</a> merci</p>\n`);
      expect(rendu(sorti)).not.toContain(`href="${perimee}"`);
    }
  });

  it("sans protocole aussi : `www.…` mène à lui-même, pas à la cible qu'on lui a collée", () => {
    const sorti = serializeMarkdown(doc(paragraphe(lien("www.exemple.org", "https://tout-autre.example"))));
    expect(sorti).toBe("www.exemple.org");
    expect(rendu(sorti)).toBe('<p><a href="http://www.exemple.org">www.exemple.org</a></p>\n');
  });

  it("collée à autre chose, elle garde SA cible, sous une forme qui s'arrête où il faut", () => {
    const sorti = serializeMarkdown(doc(paragraphe("(", lien("https://exemple.org/page", "https://exemple.org/pag"), ")")));
    expect(sorti).toBe("(https://exemple.org/page)");
    expect(rendu(sorti)).toBe('<p>(<a href="https://exemple.org/page">https://exemple.org/page</a>)</p>\n');
    // … entre chevrons là où il le faut, et toujours vers l'adresse qu'on lit.
    expect(serializeMarkdown(doc(paragraphe("x", lien("https://exemple.org/page", "https://exemple.org/pag"))))).toBe("x<https://exemple.org/page>");
    const fuzzy = serializeMarkdown(doc(paragraphe("x", lien("www.exemple.org", "https://tout-autre.example"), "y")));
    expect(fuzzy).toBe("x[www.exemple.org](http://www.exemple.org)y");
  });

  // Selon le navigateur, une lettre tapée en fin de lien y entre ou reste dehors : l'adresse est ce
  // qu'on lit d'un trait, dans les deux cas.
  it("du texte tapé tout contre elle la prolonge, même resté hors du lien de l'éditeur", () => {
    const sorti = serializeMarkdown(doc(paragraphe("voir ", lien("https://exemple.org/pag", "https://exemple.org/pag"), "e merci")));
    expect(sorti).toBe("voir https://exemple.org/page merci");
    expect(rendu(sorti)).toBe('<p>voir <a href="https://exemple.org/page">https://exemple.org/page</a> merci</p>\n');
    // Ses signes ne reçoivent aucune barre oblique inverse : elle entrerait dans l'adresse.
    const signes = serializeMarkdown(doc(paragraphe(lien("https://exemple.org/a", "https://exemple.org/a"), "/~jean/_x_ fin")));
    expect(signes).toBe("https://exemple.org/a/~jean/_x_ fin");
    expect(rendu(signes)).toContain('<a href="https://exemple.org/a/~jean/_x_">https://exemple.org/a/~jean/_x_</a> fin');
  });

  it("… ni par ce qui la couperait : des soulignés où le fil lirait un italique", () => {
    const sorti = serializeMarkdown(doc(paragraphe(lien("www.exemple.org", "http://www.exemple.org"), "/_a_ fin")));
    expect(rendu(sorti)).not.toContain("<em>");
    expect(texteDe(rendu(sorti))).toBe("www.exemple.org/_a_ fin");
    expect(rendu(sorti)).toContain('<a href="http://www.exemple.org">www.exemple.org</a>');
  });

  it("… mais pas ce qui n'en fait pas partie : un point final, une parenthèse, un mot en gras", () => {
    const adresse = "https://exemple.org/page";
    // Le point et la parenthèse restent hors du lien : le fil s'y arrête de lui-même.
    for (const [devant, derriere] of [["voir ", ". Merci"], ["(", ")"]] as const) {
      const sorti = serializeMarkdown(doc(paragraphe(devant, lien(adresse, adresse), derriere)));
      expect(sorti).toBe(`${devant}${adresse}${derriere}`);
      expect(rendu(sorti)).toContain(`<a href="${adresse}">${adresse}</a>${derriere.charAt(0)}`);
    }
    expect(serializeMarkdown(doc(paragraphe(lien(adresse, adresse), marque("x", "bold"))))).toBe(`<${adresse}>**x**`);
    // Un lien ÉCRIT n'est pas une adresse qu'on prolonge.
    expect(serializeMarkdown(doc(paragraphe(lienEcrit("exemple.org", "https://exemple.org/fr"), "/suite")))).toBe("[exemple.org](https://exemple.org/fr)/suite");
  });

  it("un lien ÉCRIT garde la cible qu'on lui a donnée, même sous un texte en forme d'adresse", () => {
    const sorti = serializeMarkdown(doc(paragraphe(lienEcrit("exemple.org", "https://exemple.org/fr/accueil"))));
    expect(sorti).toBe("[exemple.org](https://exemple.org/fr/accueil)");
    expect(rendu(sorti)).toBe('<p><a href="https://exemple.org/fr/accueil">exemple.org</a></p>\n');
  });

  it("… et un lien écrit dont le texte EST sa cible s'écrit toujours par elle seule", () => {
    expect(serializeMarkdown(doc(paragraphe(lienEcrit("https://exemple.org/a", "https://exemple.org/a"))))).toBe("https://exemple.org/a");
  });

  it("un texte qui n'est pas une adresse garde la cible du lien, écrit ou non", () => {
    expect(serializeMarkdown(doc(paragraphe(lien("la page", "https://exemple.org/pag"))))).toBe("[la page](https://exemple.org/pag)");
    expect(serializeMarkdown(doc(paragraphe(lien("https://exemple.org /pag", "https://exemple.org/pag"))))).toBe("[https://exemple.org /pag](https://exemple.org/pag)");
  });

  it("à la relecture : `[texte](adresse)` est un lien écrit, une adresse liée d'office ou entre chevrons ne l'est pas", () => {
    const ecrits = (texte: string) => {
      const vus: boolean[] = [];
      parseMarkdown(schema, texte).descendants(node => { for (const m of node.marks) if (m.type.name === "link") vus.push(m.attrs.explicit === true); });
      return vus;
    };
    expect(ecrits("[exemple.org](https://exemple.org/fr/accueil)")).toEqual([true]);
    expect(ecrits("voir https://exemple.org/a et www.exemple.org")).toEqual([false, false]);
    expect(ecrits("<https://exemple.org/a>")).toEqual([false]);
  });

  it("une adresse relue entre chevrons s'arrête où son auteur l'a dit : ce qui la suit ne la prolonge pas", () => {
    for (const texte of ["<https://exemple.org/page>suite", "voir <https://exemple.org/pag>e et la fin"]) {
      expect(serializeMarkdown(parseMarkdown(schema, texte))).toBe(texte);
    }
    const bornes = (texte: string) => {
      const vus: boolean[] = [];
      parseMarkdown(schema, texte).descendants(node => { for (const m of node.marks) if (m.type.name === "link") vus.push(m.attrs.bounded === true); });
      return vus;
    };
    expect(bornes("<https://exemple.org/a> et https://exemple.org/b et [c](https://exemple.org/c)")).toEqual([true, false, false]);
  });

  it("… si bien qu'un lien écrit ailleurs, sous un texte en forme d'adresse, survit à l'édition", () => {
    const texte = "voir [exemple.org](https://exemple.org/fr/accueil) et [www.exemple.org/x](https://autre.example/y)";
    expect(serializeMarkdown(parseMarkdown(schema, texte))).toBe(texte);
  });

  it("`addressOf` : l'adresse qu'un texte EST, ou rien", () => {
    expect(addressOf("https://exemple.org/page")).toBe("https://exemple.org/page");
    expect(addressOf("www.exemple.org")).toBe("http://www.exemple.org");
    expect(addressOf("contact@exemple.org")).toBe("mailto:contact@exemple.org");
    expect(addressOf("voir https://exemple.org")).toBeNull();
    expect(addressOf("https://exemple.org puis")).toBeNull();
    expect(addressOf("https://a.org https://b.org")).toBeNull();
    expect(addressOf("la page")).toBeNull();
    expect(addressOf("")).toBeNull();
    expect(addressOf("javascript:alert(1)")).toBeNull();
  });
});

describe("une adresse sans protocole tapée en texte", () => {
  // Le fil la lie de lui-même. Échappés, ses soulignés ou son tilde la coupaient — et le lien menait ailleurs.
  it.each([
    ["voir fr.wikipedia.org/wiki/Paris_(homonymie)", "http://fr.wikipedia.org/wiki/Paris_(homonymie)", "fr.wikipedia.org/wiki/Paris_(homonymie)"],
    ["voir www.exemple.org/~jean. Merci", "http://www.exemple.org/~jean", "www.exemple.org/~jean"],
    ["écrire à jean_@exemple.org", "mailto:jean_@exemple.org", "jean_@exemple.org"],
  ])("%s", (tape, cible, texte) => {
    const sorti = serializeMarkdown(doc(paragraphe(tape)));
    expect(sorti).toBe(tape);
    expect(rendu(sorti)).toContain(`<a href="${fil.normalizeLink(cible)}">${texte}</a>`);
  });

  it("même au milieu d'un texte qui, lui, doit être échappé", () => {
    const sorti = serializeMarkdown(doc(paragraphe("a *x* b, voir www.exemple.org/~jean/_brouillon et *y* z")));
    expect(sorti).toBe("a \\*x\\* b, voir www.exemple.org/~jean/_brouillon et \\*y\\* z");
    expect(rendu(sorti)).toContain('<a href="http://www.exemple.org/~jean/_brouillon">www.exemple.org/~jean/_brouillon</a>');
  });

  it("une adresse où une marque se lirait vraiment est échappée comme un texte : mieux vaut un lien court qu'un italique", () => {
    const sorti = serializeMarkdown(doc(paragraphe("a *x* b et www.exemple.org/_a_ ici")));
    expect(rendu(sorti)).not.toContain("<em>");
    expect(texteDe(rendu(sorti))).toBe("a *x* b et www.exemple.org/_a_ ici");
  });
});

describe("une adresse dans ou contre une marque", () => {
  it("dans le texte d'un lien écrit, une adresse est un texte comme un autre : ses soulignés n'y font pas un gras", () => {
    const adresse = "https://github.com/a/b/blob/main/__init__.py";
    const sorti = serializeMarkdown(doc(paragraphe(schema.text(adresse, [schema.mark("link", { href: adresse }), schema.mark("bold")]))));
    expect(rendu(sorti)).toBe(`<p><a href="${adresse}"><strong>${adresse}</strong></a></p>\n`);
    const nomme = serializeMarkdown(doc(paragraphe(lienEcrit("voir https://exemple.org/_a_ ici", "https://exemple.org/cible"))));
    expect(rendu(nomme)).toBe('<p><a href="https://exemple.org/cible">voir https://exemple.org/_a_ ici</a></p>\n');
  });

  it("une adresse tapée, suivie sans espace d'un gras : elle s'arrête où le gras commence", () => {
    const sorti = serializeMarkdown(doc(paragraphe("voir https://exemple.org/a", marque("b", "bold"))));
    expect(sorti).toBe("voir <https://exemple.org/a>**b**");
    expect(rendu(sorti)).toBe('<p>voir <a href="https://exemple.org/a">https://exemple.org/a</a><strong>b</strong></p>\n');
  });

  it("… suivie d'une mention aussi, quand le fil y perdrait l'une ou l'autre", () => {
    // Le fil lie la mention AVANT de lire le markdown : c'est son rendu entier qui juge, et il n'impose
    // les chevrons que là où l'adresse avalerait la mention.
    for (const personne of [MARIE, MARIE_COURTE]) {
      const sorti = serializeMarkdown(doc(paragraphe("https://exemple.org/a", mention(personne))));
      expect(rendu(sorti, [personne])).toBe(`<p><a href="https://exemple.org/a">https://exemple.org/a</a><a href="/profil/${personne.slug}">@${personne.name}</a></p>\n`);
    }
    expect(serializeMarkdown(doc(paragraphe("https://exemple.org/a", mention(MARIE_COURTE))))).toBe("<https://exemple.org/a>@marie");
    // … et pas ailleurs : là où le fil s'en sort seul, l'adresse reste nue.
    expect(serializeMarkdown(doc(paragraphe("https://exemple.org/a", mention(MARIE))))).toBe("https://exemple.org/a@marie-dupont");
  });

  it("suivie d'une espace ou de rien, elle reste nue", () => {
    expect(serializeMarkdown(doc(paragraphe("voir https://exemple.org/a", marque(" b", "bold"))))).toBe("voir https://exemple.org/a **b**");
    expect(serializeMarkdown(doc(paragraphe("voir https://exemple.org/a")))).toBe("voir https://exemple.org/a");
    expect(serializeMarkdown(doc(paragraphe("voir https://exemple.org/a", null, "suite")))).toBe("voir https://exemple.org/a\nsuite");
  });

  it("une barre oblique inverse dans la cible d'un lien écrit ne mange pas sa parenthèse", () => {
    const sorti = serializeMarkdown(doc(paragraphe(lienEcrit("ici", "https://exemple.org/a\\"))));
    expect(rendu(sorti)).toContain(">ici</a>");
    expect(rendu(sorti)).not.toContain("](");
  });
});

describe("le code dans une autre marque", () => {
  it.each([
    "[`npm i`](https://x.org)",
    "[voir `code` ici](https://x.org)",
    "**gras `code` suite**",
    "*italique `code` suite* et ~~barré `code`~~",
  ])("%s se relit et se réécrit sans rien perdre", texte => {
    expect(serializeMarkdown(parseMarkdown(schema, texte))).toBe(texte);
  });

  it("le code cohabite avec les autres marques dans le schéma — et se range après elles", () => {
    expect(schema.marks.code.spec.excludes).toBe("");
    expect(Object.keys(schema.marks).slice(-1)).toEqual(["code"]);
    const lu = parseMarkdown(schema, "[`npm i`](https://x.org)").firstChild!.firstChild!;
    expect(lu.marks.map(m => m.type.name)).toEqual(["link", "code"]);
  });
});

describe("une mention dans un lien", () => {
  // Le fil fait lui-même un lien d'une mention : dans un autre lien, on lisait les crochets.
  const cible = "https://exemple.org/doc";
  const lie = (texte: string) => schema.text(texte, [schema.mark("link", { href: cible, explicit: true })]);
  const mentionLiee = schema.node("mention", { id: MARIE.id, label: MARIE.name, slug: MARIE.slug, kind: null }, undefined, [schema.mark("link", { href: cible, explicit: true })]);

  it("le lien s'arrête devant elle et reprend derrière", () => {
    const sorti = serializeMarkdown(doc(paragraphe(lie("merci "), mentionLiee, lie(" pour tout"))));
    expect(sorti).toBe(`[merci ](${cible})@marie-dupont[ pour tout](${cible})`);
    const html = rendu(sorti, [MARIE]);
    expect(html).toBe(`<p><a href="${cible}">merci </a><a href="/profil/marie-dupont">@Marie Dupont</a><a href="${cible}"> pour tout</a></p>\n`);
  });

  it("en tête, en queue ou seule dans le lien : aucun lien vide ne reste", () => {
    expect(serializeMarkdown(doc(paragraphe(mentionLiee, lie(" suite"))))).toBe(`@marie-dupont[ suite](${cible})`);
    expect(serializeMarkdown(doc(paragraphe(lie("début "), mentionLiee)))).toBe(`[début ](${cible})@marie-dupont`);
    expect(serializeMarkdown(doc(paragraphe(mentionLiee)))).toBe("@marie-dupont");
    expect(serializeMarkdown(doc(paragraphe(lie("a "), mentionLiee, mentionLiee, lie(" b"))))).toBe(`[a ](${cible})@marie-dupont@marie-dupont[ b](${cible})`);
  });

  it("relu d'un message qui en portait une, le lien se réécrit de même", () => {
    const relu = parseMarkdown(schema, `[merci @marie-dupont pour tout](${cible})`, [MARIE]);
    expect(mentionsOf(relu)).toEqual([MARIE]);
    expect(serializeMarkdown(relu)).toBe(`[merci ](${cible})@marie-dupont[ pour tout](${cible})`);
  });
});

describe("les blocs, aux bords", () => {
  it("une liste numérotée garde son départ, zéro compris", () => {
    for (const texte of ["0. zéro\n1. un", "3. trois\n4. quatre", "1. un\n2. deux"]) {
      expect(serializeMarkdown(parseMarkdown(schema, texte))).toBe(texte);
    }
    const item = (texte: string) => schema.node("listItem", null, [paragraphe(texte)]);
    expect(serializeMarkdown(doc(schema.node("orderedList", { start: "x" }, [item("un")])))).toBe("1. un");
  });

  it("le nom du langage d'un bloc de code ne porte que ce qu'un nom porte", () => {
    const sorti = serializeMarkdown(doc(schema.node("codeBlock", { language: "a`b c" }, [schema.text("x")]), paragraphe("après")));
    expect(sorti).toBe("```abc\nx\n```\n\naprès");
    expect(rendu(sorti)).toContain("<p>après</p>");
    expect(serializeMarkdown(doc(schema.node("codeBlock", { language: "c++" }, [schema.text("x")])))).toBe("```c++\nx\n```");
  });
});

describe("le document sans rien à envoyer", () => {
  const item = (...contenu: ProseNode[]) => schema.node("listItem", null, contenu);
  it.each([
    ["un paragraphe vide", () => doc(schema.node("paragraph"))],
    ["des espaces et des sauts de ligne", () => doc(paragraphe("  \u00a0 ", null, " "))],
    ["une liste vide", () => doc(schema.node("bulletList", null, [item(schema.node("paragraph"))]))],
    ["une citation vide", () => doc(schema.node("blockquote", null, [schema.node("paragraph")]))],
    ["un bloc de code vide, ou d'espaces", () => doc(schema.node("codeBlock"), schema.node("codeBlock", null, [schema.text("  \n ")]))],
  ])("%s : rien à envoyer", (_cas, document) => {
    expect(isBlank(document())).toBe(true);
  });

  it.each([
    ["une lettre", () => doc(paragraphe("a"))],
    ["une lettre au fond d'une liste", () => doc(schema.node("bulletList", null, [item(schema.node("paragraph"), schema.node("bulletList", null, [item(paragraphe("a"))]))]))],
    ["une mention seule", () => doc(paragraphe(mention(MARIE)))],
    ["un filet seul", () => doc(schema.node("horizontalRule"))],
    ["du code", () => doc(schema.node("codeBlock", null, [schema.text("x")]))],
  ])("%s : un message", (_cas, document) => {
    expect(isBlank(document())).toBe(false);
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

  it("une mention sans slug n'en est pas une qu'on sait renvoyer : son nom part en texte, et personne n'est notifié", () => {
    const sansSlug = schema.node("mention", { id: "65a1000000000000000000c1", label: "Une *personne*", slug: null, kind: null });
    const tape = doc(paragraphe("avec ", sansSlug, " ici"));
    expect(mentionsOf(tape)).toEqual([]);
    const sorti = serializeMarkdown(tape);
    // Son nom est un texte comme un autre : ses étoiles n'y font pas un italique.
    expect(rendu(sorti)).toBe("<p>avec @Une *personne* ici</p>\n");
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

  it("une mention en tête de ligne, après un saut : ce qui la suit n'est pas un début de ligne", () => {
    const sorti = serializeMarkdown(doc(paragraphe("à", null, mention(MARIE), " - pas une liste")));
    expect(sorti).toBe("à\n@marie-dupont - pas une liste");
    expect(rendu(sorti, [MARIE])).not.toContain("<ul>");
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
