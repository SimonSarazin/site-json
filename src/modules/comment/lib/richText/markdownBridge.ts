import type MarkdownIt from "markdown-it";
import { MarkdownParser, MarkdownSerializer, MarkdownSerializerState } from "prosemirror-markdown";
import type { Mark, Node as ProseNode, Schema } from "@tiptap/pm/model";
import { createCommentMarkdown } from "../markdownEngine";
import type { CommentMention } from "../../types";

/**
 * Le PONT entre l'éditeur et le texte d'un message.
 *
 * Ce qu'on enregistre est du markdown — jamais le HTML de l'éditeur : c'est ce que le legacy
 * stocke, ce que le fil rend (`CommentMarkdown`), et ce qu'un autre client relira. L'éditeur n'est
 * qu'une façon de l'écrire. Ce module fait donc les deux trajets :
 *
 *   - `parseMarkdown`     : le texte d'un message → le document de l'éditeur (pour l'éditer) ;
 *   - `serializeMarkdown` : le document de l'éditeur → le texte à enregistrer.
 *
 * La règle qui les tient ensemble, et que les tests rejouent cas par cas : **ce que rend le texte
 * sorti est ce que montrait l'éditeur**. L'analyseur est `markdown-it` réglé COMME le fil
 * (`createCommentMarkdown`) ; le sérialiseur échappe tout ce qui, relu, deviendrait autre chose
 * que ce qu'on a tapé.
 *
 * Pur : ni DOM, ni éditeur monté — un schéma suffit.
 */

/** Les attributs du nœud `mention` : la personne, telle qu'il faut la renvoyer au serveur. */
export interface MentionAttrs {
  readonly id: string | null;
  /** Le nom affiché. */
  readonly label: string | null;
  /** Ce qui s'écrit dans le texte : `@slug`. */
  readonly slug: string | null;
  /** Le type stocké (`citoyens`, `organizations`…), gardé pour ne pas le perdre à l'édition. */
  readonly kind: string | null;
}

interface EnvDuPont {
  /** Les personnes mentionnées dans CE message, la plus longue d'abord. */
  readonly mentions?: readonly CommentMention[];
}

type RegleEnLigne = Parameters<MarkdownIt["inline"]["ruler"]["push"]>[1];

/**
 * `@slug` d'une personne CONNUE du message → un jeton `mention`.
 *
 * Même règle que le fil (`linkifyMentions`) : seules les mentions que porte le message comptent
 * — un `@quelquechose` tapé à la main reste du texte —, le plus long slug d'abord, et ni
 * caractère de mot ni tiret derrière (`@marie` ne se lit pas dans `@marie-dupont`). Comme lui, on
 * ne regarde pas ce qui PRÉCÈDE. Dans du code, la règle ne passe pas : `markdown-it` a déjà pris
 * le span ou le bloc entier.
 */
const regleMention: RegleEnLigne = (state, silent) => {
  if (state.src.charCodeAt(state.pos) !== 0x40 /* @ */) return false;
  const connues = (state.env as EnvDuPont | undefined)?.mentions ?? [];
  const reste = state.src.slice(state.pos + 1);
  const trouvee = connues.find(m => reste.startsWith(m.slug) && !/^[\w-]/.test(reste.slice(m.slug.length)));
  if (!trouvee) return false;
  if (!silent) state.push("mention", "", 0).meta = trouvee;
  state.pos += 1 + trouvee.slug.length;
  return true;
};

function attrsDeMention(mention: CommentMention): MentionAttrs {
  return { id: mention.id || null, label: mention.name || mention.slug, slug: mention.slug, kind: mention.type ?? null };
}

const analyseurs = new WeakMap<Schema, MarkdownParser>();

/** L'analyseur d'un schéma — construit une fois, il ne dépend que de lui. */
function analyseurPour(schema: Schema): MarkdownParser {
  const connu = analyseurs.get(schema);
  if (connu) return connu;
  // Pas de nœud de tableau dans l'éditeur : coupée ici, la règle laisse la source d'un tableau en
  // texte, qui ressort telle quelle — et que le fil, lui, rend toujours en tableau.
  const md = createCommentMarkdown().disable(["table"]);
  md.inline.ruler.after("text", "mention", regleMention);
  const analyseur = new MarkdownParser(schema, md, {
    blockquote: { block: "blockquote" },
    paragraph: { block: "paragraph" },
    list_item: { block: "listItem" },
    bullet_list: { block: "bulletList" },
    ordered_list: { block: "orderedList", getAttrs: jeton => ({ start: Number(jeton.attrGet("start") ?? 1) || 1 }) },
    code_block: { block: "codeBlock", noCloseToken: true },
    fence: { block: "codeBlock", getAttrs: jeton => ({ language: jeton.info.trim().split(/\s+/)[0] || null }), noCloseToken: true },
    hr: { node: "horizontalRule" },
    hardbreak: { node: "hardBreak" },
    // Le fil est en `breaks` : un retour à la ligne simple EST un saut de ligne.
    softbreak: { node: "hardBreak" },
    em: { mark: "italic" },
    strong: { mark: "bold" },
    s: { mark: "strike" },
    link: { mark: "link", getAttrs: jeton => ({ href: jeton.attrGet("href") }) },
    code_inline: { mark: "code", noCloseToken: true },
    mention: { node: "mention", getAttrs: jeton => ({ ...attrsDeMention(jeton.meta as CommentMention) }) },
  });
  analyseurs.set(schema, analyseur);
  return analyseur;
}

/**
 * Le texte d'un message → le document de l'éditeur.
 *
 * `mentions` : les personnes que le message mentionne. Sans elles, les `@slug` restent du texte, et
 * l'édition les perdrait (le serveur efface les mentions qu'on ne lui renvoie pas).
 */
export function parseMarkdown(schema: Schema, text: string, mentions: readonly CommentMention[] = []): ProseNode {
  const connues = mentions.filter(m => m.slug).slice().sort((a, b) => b.slug.length - a.slug.length);
  const env: EnvDuPont = { mentions: connues };
  return analyseurPour(schema).parse(text ?? "", env);
}

/** Les champs que la bibliothèque tient dans son état sans les déclarer dans ses types. */
interface EtatInterne {
  out: string;
  atBlockStart: boolean;
  inAutolink: boolean | undefined;
}

/** Comment s'écrit le lien en cours : son adresse nue, entre chevrons, ou `[texte](adresse)`. */
type FormeDeLien = "nu" | "chevrons" | "crochets";

/**
 * L'état du sérialiseur, avec les échappements du dialecte du fil.
 *
 * `prosemirror-markdown` échappe pour CommonMark, au début d'un BLOC seulement. Or dans une
 * messagerie Entrée envoie : un message de plusieurs lignes est UN paragraphe coupé de sauts de
 * ligne, et chaque ligne peut commencer par ce que markdown lirait comme une liste, une citation
 * ou un titre. On échappe donc aussi après un saut de ligne (`echappe`, plus bas, dit comment).
 */
class EtatDuFil extends MarkdownSerializerState {
  /** On vient d'écrire un saut de ligne DANS un bloc : ce qui suit commence une ligne. */
  apresSaut = false;
  lien: FormeDeLien | null = null;

  private get interne(): EtatInterne {
    return this as unknown as EtatInterne;
  }

  override esc(str: string, startOfLine = false): string {
    const debutDeLigne = startOfLine || this.apresSaut;
    // Une adresse à protocole tapée sans être un lien (Entrée envoie avant que l'éditeur l'ait
    // liée) : le fil la lie en lisant la SOURCE, signe pour signe — une barre oblique inverse posée
    // devant un `~` ou un `_` y partirait dans le lien. Elle sort donc telle quelle, et seul le
    // texte qui l'entoure est échappé.
    const adresses = adressesDe(str);
    let sorti = "";
    let curseur = 0;
    adresses.forEach(({ debut, fin }, rang) => {
      const adresse = str.slice(debut, fin);
      const suite = echappe(str.slice(fin, adresses[rang + 1]?.debut ?? str.length), false);
      // Un chevron tapé juste devant en ferait un lien automatique, chevrons avalés.
      sorti += echappe(str.slice(curseur, debut), debutDeLigne && curseur === 0).replace(/<$/, "\\<");
      // Ce qui la suit commence par un signe échappé : sa barre oblique inverse entrerait dans le
      // lien. Entre chevrons, l'adresse s'arrête où elle doit.
      sorti += suite.startsWith("\\") && seRelit(`<${adresse}>`, adresse, adresse) ? `<${adresse}>` : adresse;
      curseur = fin;
    });
    return sorti + echappe(str.slice(curseur), debutDeLigne && curseur === 0);
  }

  override text(text: string, escape = true): void {
    // Quatre espaces en tête de bloc feraient un bloc de code à la relecture. Le fil ne les
    // affiche pas (le HTML les avale) : les retirer ne change rien à ce qu'on lit. Après un saut
    // de ligne il n'y a rien à retirer : un bloc de code ne coupe pas un paragraphe, et `echappe`
    // voit un marqueur de liste derrière ses espaces.
    const propre = escape && this.interne.atBlockStart ? text.replace(/^[ \t]+/, "") : text;
    super.text(propre, escape);
    if (propre !== "") this.apresSaut = false;
  }

  get sortie(): string {
    return this.interne.out;
  }

  set dansUnLienNu(valeur: boolean | undefined) {
    this.interne.inAutolink = valeur;
  }

  get dansUnLienNu(): boolean | undefined {
    return this.interne.inAutolink;
  }
}

const etatDe = (state: MarkdownSerializerState) => state as EtatDuFil;

/** Le moteur du fil : c'est à lui qu'on demande ce qu'il ferait d'un texte. */
const moteur = createCommentMarkdown();

/** Le protocole qui précède `://` — la règle de `markdown-it` (`rules_inline/linkify`), à la lettre. */
const PROTOCOLE = /(?:^|[^a-z0-9.+-])([a-z][a-z0-9.+-]*)$/i;

/**
 * Les adresses à protocole d'un texte (`https://…`), cherchées COMME le fil les cherche : à chaque
 * `://`, le protocole qui le précède, puis ce que `linkify` lit à partir de lui — sans l'étoile
 * finale, que le fil laisse hors du lien.
 */
function adressesDe(str: string): Array<{ debut: number; fin: number }> {
  const adresses: Array<{ debut: number; fin: number }> = [];
  let apres = 0;
  for (let position = str.indexOf("://"); position !== -1; position = str.indexOf("://", Math.max(apres, position + 3))) {
    const protocole = PROTOCOLE.exec(str.slice(apres, position))?.[1];
    if (!protocole) continue;
    const debut = position - protocole.length;
    const lue = moteur.linkify.matchAtStart(str.slice(debut));
    const adresse = lue?.url.replace(/\*+$/, "") ?? "";
    if (adresse.length <= protocole.length + 3 || !moteur.validateLink(moteur.normalizeLink(adresse))) continue;
    adresses.push({ debut, fin: debut + adresse.length });
    apres = debut + adresse.length;
  }
  return adresses;
}

/**
 * Échappe un texte pour qu'il se relise comme du TEXTE.
 *
 * Réécrit en entier plutôt que repris de la bibliothèque : sa règle laisse passer des textes qui,
 * relus, deviennent autre chose (`__init__` en italique, « 1. » ou « + » seuls en liste vide).
 */
function echappe(str: string, debutDeLigne: boolean): string {
  // Les signes qui ouvrent une marque, un code ou un lien. Un souligné pris entre deux lettres
  // ou chiffres n'ouvre rien (`nom_de_variable`) — mais entre deux soulignés, si : la
  // bibliothèque comptait le souligné parmi les « lettres ».
  let sorti = str.replace(/[`*\\~[\]_]/g, (signe, index: number) =>
    signe === "_" && /[A-Za-z0-9]/.test(str.charAt(index - 1)) && /[A-Za-z0-9]/.test(str.charAt(index + 1))
      ? signe
      : `\\${signe}`);
  if (debutDeLigne) {
    sorti = sorti
      // Ce qui, en tête de ligne, ouvrirait une liste ou une citation. Un « + » ne compte que
      // suivi d'une espace — ou SEUL sur sa ligne : un marqueur nu ouvre une liste vide.
      .replace(/^(\s*)([->]|\+(?=\s|$))/, "$1\\$2")
      .replace(/^(\s*)(#{1,6})(\s|$)/, "$1\\$2$3")
      // « 1. » comme « 1) », suivis d'une espace ou seuls sur leur ligne.
      .replace(/^(\s*\d+)([.)])(\s|$)/, "$1\\$2$3");
  }
  return sorti
    // Une entité tapée (« &amp; ») serait DÉCODÉE au rendu : on a écrit cinq caractères, pas un.
    .replace(/&(?=#?[0-9A-Za-z]+;)/g, "\\&")
    // « <adresse> » tapé serait un lien automatique, chevrons avalés.
    .replace(/<(?=[A-Za-z][A-Za-z0-9+.-]{1,31}:|[^\s<>@]+@[^\s<>]+>)/g, "\\<");
}

/**
 * Cette écriture redeviendrait-elle EXACTEMENT ce lien ? Jugé par le rendu du fil lui-même, pas
 * par une règle tenue à côté : une adresse où `*…*` ou `_…_` feraient une marque, une parenthèse
 * finale que `linkify` laisse dehors — tout ce qui la couperait se voit ici.
 */
function seRelit(source: string, adresse: string, texte: string): boolean {
  const { escapeHtml } = moteur.utils;
  return moteur.renderInline(source) === `<a href="${escapeHtml(moteur.normalizeLink(adresse))}">${escapeHtml(texte)}</a>`;
}

/**
 * Comment écrire ce lien.
 *
 * Un lien que le fil referait de lui-même s'écrit par son texte seul — l'adresse qu'on a tapée ou
 * collée, `www.…`, un courriel : c'est ce que tape tout le monde —, à condition que rien ne s'y
 * colle : devant ou derrière, un caractère accolé changerait ce que le fil y lit. Sinon, une
 * adresse s'écrit entre chevrons. Tout autre lien garde la forme `[texte](adresse)`.
 */
function formeDuLien(mark: Mark, parent: ProseNode, index: number): FormeDeLien {
  const adresse = String(mark.attrs.href ?? "");
  const contenu = parent.child(index);
  // Un texte qui porte une autre marque, ou un lien qui court sur plusieurs nœuds : la forme complète.
  if (!contenu.isText || contenu.marks.length !== 1) return "crochets";
  const suivant = index + 1 < parent.childCount ? parent.child(index + 1) : null;
  if (suivant && mark.isInSet(suivant.marks)) return "crochets";
  const texte = contenu.text ?? "";
  const precedent = index > 0 ? parent.child(index - 1) : null;
  const libreDevant = !precedent || precedent.type.name === "hardBreak" || (precedent.isText && /\s$/.test(precedent.text ?? ""));
  const libreDerriere = !suivant || suivant.type.name === "hardBreak" || (suivant.isText && /^\s/.test(suivant.text ?? ""));
  if (libreDevant && libreDerriere && seRelit(texte, adresse, texte)) return "nu";
  return texte === adresse && seRelit(`<${adresse}>`, adresse, texte) ? "chevrons" : "crochets";
}

/** Assez d'accents graves pour entourer un code qui en contient (repris de la bibliothèque, qui ne l'exporte pas). */
function accentsPour(node: ProseNode, cote: -1 | 1): string {
  let longueur = 0;
  if (node.isText) {
    for (const suite of (node.text ?? "").match(/`+/g) ?? []) longueur = Math.max(longueur, suite.length);
  }
  let resultat = longueur > 0 && cote > 0 ? " `" : "`";
  for (let i = 0; i < longueur; i++) resultat += "`";
  if (longueur > 0 && cote < 0) resultat += " ";
  return resultat;
}

const serialiseur = new MarkdownSerializer(
  {
    blockquote(state, node) {
      state.wrapBlock("> ", null, node, () => state.renderContent(node));
    },
    codeBlock(state, node) {
      // La clôture est plus longue que toute suite d'accents graves du contenu.
      const suites = node.textContent.match(/`{3,}/gm);
      const cloture = suites ? `${suites.sort().slice(-1)[0]}\`` : "```";
      state.write(`${cloture}${String(node.attrs.language ?? "")}\n`);
      state.text(node.textContent, false);
      state.write("\n");
      state.write(cloture);
      state.closeBlock(node);
    },
    horizontalRule(state, node) {
      state.write("---");
      state.closeBlock(node);
    },
    bulletList(state, node) {
      state.renderList(node, "  ", () => "- ");
    },
    orderedList(state, node) {
      const debut = Number(node.attrs.start ?? 1) || 1;
      const largeur = String(debut + node.childCount - 1).length;
      const retrait = state.repeat(" ", largeur + 2);
      state.renderList(node, retrait, i => {
        const numero = String(debut + i);
        return `${state.repeat(" ", largeur - numero.length)}${numero}. `;
      });
    },
    listItem(state, node) {
      state.renderContent(node);
    },
    paragraph(state, node) {
      state.renderInline(node);
      state.closeBlock(node);
    },
    hardBreak(state, node, parent, index) {
      // Un saut de ligne final ne s'écrit pas : il ne se lirait pas. Sinon c'est un simple
      // retour à la ligne — le fil est en `breaks` —, et ce qui suit commence une ligne.
      for (let i = index + 1; i < parent.childCount; i++) {
        if (parent.child(i).type !== node.type) {
          state.write("\n");
          etatDe(state).apresSaut = true;
          return;
        }
      }
    },
    text(state, node) {
      state.text(node.text ?? "", !etatDe(state).dansUnLienNu);
    },
    mention(state, node) {
      const slug = typeof node.attrs.slug === "string" ? node.attrs.slug : "";
      // Sans slug, le nœud n'est pas une mention qu'on sait renvoyer : son nom, en texte.
      if (slug) state.write(`@${slug}`);
      else state.text(`@${String(node.attrs.label ?? "")}`);
      etatDe(state).apresSaut = false;
    },
  },
  {
    italic: { open: "*", close: "*", mixable: true, expelEnclosingWhitespace: true },
    bold: { open: "**", close: "**", mixable: true, expelEnclosingWhitespace: true },
    strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
    link: {
      open(state, mark, parent, index) {
        const forme = formeDuLien(mark, parent, index);
        etatDe(state).lien = forme;
        etatDe(state).dansUnLienNu = forme !== "crochets";
        return forme === "nu" ? "" : forme === "chevrons" ? "<" : "[";
      },
      close(state, mark) {
        const forme = etatDe(state).lien;
        etatDe(state).lien = null;
        etatDe(state).dansUnLienNu = undefined;
        if (forme === "nu") return "";
        if (forme === "chevrons") return ">";
        // Une espace ou un chevron couperaient l'adresse : encodés, elle reste entière.
        return `](${String(mark.attrs.href ?? "").replace(/[\s<>]/g, encodeURIComponent).replace(/[()"]/g, "\\$&")})`;
      },
      mixable: true,
    },
    code: {
      open(_state, _mark, parent, index) { return accentsPour(parent.child(index), -1); },
      close(_state, _mark, parent, index) { return accentsPour(parent.child(index - 1), 1); },
      escape: false,
    },
  },
);

/**
 * Le constructeur de l'état, que la bibliothèque marque interne et ne déclare donc pas : on
 * l'instancie soi-même, parce que `MarkdownSerializer.serialize` construirait la classe de base.
 */
const NouvelEtat = EtatDuFil as unknown as new (
  nodes: MarkdownSerializer["nodes"],
  marks: MarkdownSerializer["marks"],
  options: { tightLists: boolean; hardBreakNodeName: string },
) => EtatDuFil;

/** Le document de l'éditeur → le texte à enregistrer. */
export function serializeMarkdown(doc: ProseNode): string {
  const etat = new NouvelEtat(serialiseur.nodes, serialiseur.marks, { tightLists: true, hardBreakNodeName: "hardBreak" });
  etat.renderContent(doc);
  return etat.sortie;
}

/**
 * Les personnes mentionnées dans le document : ses nœuds `mention`, une fois chacune.
 *
 * C'est le document qui fait foi, pas une liste tenue à côté : retirer une mention en éditant la
 * phrase ne doit pas notifier quelqu'un qui n'est plus cité.
 */
export function mentionsOf(doc: ProseNode): CommentMention[] {
  const vues = new Map<string, CommentMention>();
  doc.descendants(node => {
    if (node.type.name !== "mention") return;
    const attrs = node.attrs as MentionAttrs;
    if (!attrs.slug || vues.has(attrs.slug)) return;
    vues.set(attrs.slug, {
      id: attrs.id ?? "",
      name: attrs.label || attrs.slug,
      slug: attrs.slug,
      ...(attrs.kind ? { type: attrs.kind } : {}),
    });
  });
  return [...vues.values()];
}

/** Les nœuds et les marques que le sérialiseur sait écrire — pour vérifier qu'il couvre le schéma. */
export const SERIALIZED_NODES: readonly string[] = Object.keys(serialiseur.nodes);
export const SERIALIZED_MARKS: readonly string[] = Object.keys(serialiseur.marks);
