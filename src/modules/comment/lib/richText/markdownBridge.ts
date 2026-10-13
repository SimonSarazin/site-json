import type MarkdownIt from "markdown-it";
import { MarkdownParser, MarkdownSerializer, MarkdownSerializerState } from "prosemirror-markdown";
import type { Mark, Node as ProseNode, Schema } from "@tiptap/pm/model";
import { linkifyMentions } from "../linkifyMentions";
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
 * Deux règles les tiennent ensemble, et les tests les rejouent cas par cas :
 *
 *   1. **ce que rend le texte sorti est ce que montrait l'éditeur** — l'analyseur est `markdown-it`
 *      réglé COMME le fil (`createCommentMarkdown`), et le sérialiseur échappe ce qui, relu,
 *      deviendrait autre chose que ce qu'on a tapé ;
 *   2. **le texte sort tel qu'il a été tapé chaque fois que c'est possible**. Un message se lit
 *      aussi là où le markdown n'est PAS rendu — l'écran legacy, une notification, la citation
 *      d'une réponse : une barre oblique inverse posée « par précaution » devant un crochet ou un
 *      tilde s'y verrait. Chaque bloc est donc écrit deux fois, avec et sans échappements, et le
 *      fil lui-même départage : même rendu, c'est la version nue qui sort (`serializeMarkdown`).
 *
 * Une exception assumée à la première : une ligne tapée après un Maj+Entrée et qui commence comme
 * une liste, une citation ou un filet (`- `, `1. `, `> `, `---`) part telle quelle. Le fil en fait
 * une liste, une citation, un filet — ce qu'il a toujours fait d'un texte tapé ainsi. En tête de
 * paragraphe, l'éditeur fait lui-même la liste : qui la défait veut le signe, et le signe est gardé.
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

/** Le numéro de départ d'une liste : celui qu'on a écrit, zéro compris ; 1 à défaut. */
function debutDeListe(valeur: unknown): number {
  const debut = Number(valeur ?? 1);
  return Number.isInteger(debut) && debut >= 0 ? debut : 1;
}

const analyseurs = new WeakMap<Schema, MarkdownParser>();

/** L'analyseur d'un schéma — construit une fois, il ne dépend que de lui. */
function analyseurPour(schema: Schema): MarkdownParser {
  const connu = analyseurs.get(schema);
  if (connu) return connu;
  // Pas de nœud de tableau dans l'éditeur : coupée ici, la règle laisse la source d'un tableau en
  // texte — des lignes à barres verticales, que le fil rend toujours en tableau une fois ressorties.
  const md = createCommentMarkdown().disable(["table"]);
  md.inline.ruler.after("text", "mention", regleMention);
  const analyseur = new MarkdownParser(schema, md, {
    blockquote: { block: "blockquote" },
    paragraph: { block: "paragraph" },
    list_item: { block: "listItem" },
    bullet_list: { block: "bulletList" },
    ordered_list: { block: "orderedList", getAttrs: jeton => ({ start: debutDeListe(jeton.attrGet("start")) }) },
    code_block: { block: "codeBlock", noCloseToken: true },
    fence: { block: "codeBlock", getAttrs: jeton => ({ language: jeton.info.trim().split(/\s+/)[0] || null }), noCloseToken: true },
    hr: { node: "horizontalRule" },
    hardbreak: { node: "hardBreak" },
    // Le fil est en `breaks` : un retour à la ligne simple EST un saut de ligne.
    softbreak: { node: "hardBreak" },
    em: { mark: "italic" },
    strong: { mark: "bold" },
    s: { mark: "strike" },
    // `explicit` : un lien ÉCRIT (`[texte](adresse)`), par opposition à une adresse que le fil a
    // liée de lui-même (`linkify`) ou qu'on a mise entre chevrons (`autolink`) — celle-ci est
    // `bounded` : son auteur a dit où elle s'arrête. Cf. `lireLeLien`.
    link: {
      mark: "link",
      getAttrs: jeton => ({
        href: jeton.attrGet("href"),
        explicit: jeton.markup !== "linkify" && jeton.markup !== "autolink",
        bounded: jeton.markup === "autolink",
      }),
    },
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

/** Un crochet ouvrant qui vient d'être écrit, et rien derrière : un lien encore vide. */
const CROCHET_OUVERT = /(^|[^\\])\[$/;

/**
 * L'état du sérialiseur, avec les échappements du dialecte du fil.
 *
 * `prosemirror-markdown` échappe pour CommonMark ; ici c'est le fil qui fait foi — ses adresses
 * liées d'office, ses titres coupés, ses sauts de ligne simples. `echappe`, plus bas, dit comment.
 */
class EtatDuFil extends MarkdownSerializerState {
  /**
   * Le texte sort TEL QU'IL A ÉTÉ TAPÉ, sans aucun échappement. `serializeMarkdown` écrit chaque
   * bloc dans les deux modes et ne garde celui-ci que si le fil le rend à l'identique.
   */
  nu = false;
  lien: FormeDeLien | null = null;
  /** La cible du lien en cours, telle qu'elle s'écrira. */
  cible = "";
  /** Le texte en cours est suivi, sans espace, d'autre chose : une marque qui s'ouvre, une mention. */
  colle = false;
  /** Les premiers caractères du texte suivant continuent l'adresse du lien qu'on vient d'écrire : ils sortent tels quels. */
  suite = 0;
  /**
   * Aucune adresse SANS protocole n'est laissée nue. `serializeMarkdown` y passe pour un bloc où,
   * écrites telles quelles, elles ne ressortent pas toutes liées entières (`nues`).
   */
  prudent = false;
  /**
   * Les adresses sans protocole laissées nues dans ce qu'on écrit — pour chacune, le lien que le fil
   * doit en faire. Le fil les lie APRÈS avoir lu les marques : chacune se relit seule, mais les
   * signes de deux d'entre elles peuvent se répondre, d'une adresse à l'autre.
   */
  nues: string[] = [];

  private get interne(): EtatInterne {
    return this as unknown as EtatInterne;
  }

  override esc(str: string, startOfLine = false): string {
    if (this.nu) return str;
    if (this.suite > 0) {
      // La fin d'une adresse commencée dans le lien d'avant : pas un signe n'y est touché.
      const longueur = this.suite;
      this.suite = 0;
      return str.slice(0, longueur) + this.esc(str.slice(longueur), false);
    }
    // Une adresse tapée sans être un lien (on envoie avant que l'éditeur l'ait liée) : le fil la
    // lie de lui-même, et une barre oblique inverse posée devant un `~` ou un `_` la couperait.
    // Elle sort donc telle quelle, et seul le texte qui l'entoure est échappé. Dans le texte d'un
    // lien `[…](…)`, en revanche, le fil ne refait pas de lien : une adresse y est un texte comme
    // un autre, et ses soulignés y feraient un gras.
    const adresses = this.lien === "crochets" ? [] : adressesDe(str).filter(adresse => adresse.protocole || !this.prudent);
    let sorti = "";
    let curseur = 0;
    adresses.forEach(({ debut, fin, protocole, lien }, rang) => {
      const adresse = str.slice(debut, fin);
      if (!protocole) this.nues.push(lien);
      const suite = echappe(str.slice(fin, adresses[rang + 1]?.debut ?? str.length), false);
      // Un chevron tapé juste devant en ferait un lien automatique, chevrons avalés.
      sorti += echappe(str.slice(curseur, debut), startOfLine && curseur === 0).replace(/<$/, "\\<");
      // Une adresse à protocole se lit dans la SOURCE, signe pour signe : ce qui la suit sans espace
      // — la barre oblique inverse d'un signe échappé, les étoiles d'un gras qui s'ouvre — y
      // entrerait. Entre chevrons, elle s'arrête où elle doit. Les autres adresses se lisent dans
      // le texte déjà découpé : rien ne s'y colle.
      const bornee = protocole && (suite.startsWith("\\") || (fin === str.length && this.colle));
      sorti += bornee && seRelit(`<${adresse}>`, adresse, adresse) ? `<${adresse}>` : adresse;
      curseur = fin;
    });
    return sorti + echappe(str.slice(curseur), startOfLine && curseur === 0);
  }

  override text(text: string, escape = true): void {
    // Quatre espaces en tête de bloc feraient un bloc de code à la relecture. Le fil ne les
    // affiche pas (le HTML les avale) : les retirer ne change rien à ce qu'on lit. Une ligne VIDE
    // au milieu d'un paragraphe (deux sauts de ligne de suite) ouvre elle aussi un bloc pour le
    // markdown : même traitement. Après un saut simple il n'y a rien à retirer — un bloc de code ne
    // coupe pas un paragraphe.
    const enTete = this.interne.atBlockStart || /\n[ \t>]*\n$/.test(this.interne.out);
    super.text(enTete ? text.replace(/^[ \t]+/, "") : text, escape);
  }

  /** `](cible)` : la fin d'un lien écrit. Une espace ou un chevron couperaient l'adresse — encodés, elle reste entière. */
  private fermeture(): string {
    return `](${this.cible.replace(/[\s<>]/g, encodeURIComponent).replace(/[()"\\]/g, "\\$&")})`;
  }

  /**
   * Ferme le lien `[…](…)` en cours — ou le retire s'il est encore vide (on vient de le rouvrir
   * derrière une mention, et rien n'a suivi).
   */
  fermerLeLien(): void {
    if (CROCHET_OUVERT.test(this.interne.out)) this.interne.out = this.interne.out.slice(0, -1);
    else this.interne.out += this.fermeture();
  }

  rouvrirLeLien(): void {
    this.interne.out += "[";
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

interface AdresseLue {
  readonly debut: number;
  readonly fin: number;
  /** Une adresse à protocole (`https://…`), que le fil lit dans la source ; sinon `www.…`, un domaine, un courriel. */
  readonly protocole: boolean;
  /** Le lien que le fil en fait (`lienRendu`). */
  readonly lien: string;
}

/** Une adresse que le fil lit dans la SOURCE, avant les marques : `protocole://…`. Les autres, il les lie après coup. */
const A_PROTOCOLE = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Les adresses d'un texte, cherchées COMME le fil les cherche.
 *
 * Celles à protocole (`https://…`) : à chaque `://`, le protocole qui le précède, puis ce que
 * `linkify` lit à partir de lui — sans l'étoile finale, que le fil laisse hors du lien.
 *
 * Les autres (`www.…`, un domaine nu, un courriel) : le fil les lie après coup, dans le texte déjà
 * découpé en marques. Elles ne comptent donc que si, laissées telles quelles, elles se relisent
 * ENTIÈRES — un `_…_` ou un `*…*` pris dans l'adresse y ferait une marque, et la couperait.
 */
function adressesDe(str: string): AdresseLue[] {
  const adresses: AdresseLue[] = [];
  let apres = 0;
  for (let position = str.indexOf("://"); position !== -1; position = str.indexOf("://", Math.max(apres, position + 3))) {
    const protocole = PROTOCOLE.exec(str.slice(apres, position))?.[1];
    if (!protocole) continue;
    const debut = position - protocole.length;
    const lue = moteur.linkify.matchAtStart(str.slice(debut));
    const adresse = lue?.url.replace(/\*+$/, "") ?? "";
    if (adresse.length <= protocole.length + 3 || !moteur.validateLink(moteur.normalizeLink(adresse))) continue;
    adresses.push({ debut, fin: debut + adresse.length, protocole: true, lien: lienRendu(adresse, adresse) });
    apres = debut + adresse.length;
  }
  for (const lue of moteur.linkify.match(str) ?? []) {
    if (adresses.some(connue => lue.index < connue.fin && lue.lastIndex > connue.debut)) continue;
    if (lue.raw.includes("://") || !seRelit(lue.raw, lue.url, lue.text)) continue;
    adresses.push({ debut: lue.index, fin: lue.lastIndex, protocole: false, lien: lienRendu(lue.url, lue.text) });
  }
  return adresses.sort((a, b) => a.debut - b.debut);
}

/**
 * Échappe un texte pour qu'il se relise comme du TEXTE.
 *
 * Réécrit en entier plutôt que repris de la bibliothèque : sa règle laisse passer des textes qui,
 * relus, deviennent autre chose (`__init__` en italique, « 1. » ou « + » seuls en liste vide).
 * Elle échappe large — `serializeMarkdown` retire ensuite ce qui ne servait à rien.
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
      // Ce qui, en tête de bloc, ouvrirait une liste ou une citation. Un « + » ne compte que
      // suivi d'une espace — ou SEUL sur sa ligne : un marqueur nu ouvre une liste vide. Pas le
      // croisillon : le fil n'a pas de titre, il n'y a rien à neutraliser.
      .replace(/^(\s*)([->]|\+(?=\s|$))/, "$1\\$2")
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
  return moteur.renderInline(source) === lienRendu(adresse, texte);
}

/** Le lien que le fil rend pour cette adresse, sous ce texte. */
function lienRendu(adresse: string, texte: string): string {
  const { escapeHtml } = moteur.utils;
  return `<a href="${escapeHtml(moteur.normalizeLink(adresse))}">${escapeHtml(texte)}</a>`;
}

/**
 * Chaque adresse laissée nue ressort-elle liée, entière, de ce rendu ? Autant de fois qu'elle y a
 * été écrite : la même adresse peut y être deux fois, et n'être coupée qu'une.
 */
function toutesLiees(html: string, nues: readonly string[]): boolean {
  const attendus = new Map<string, number>();
  for (const lien of nues) attendus.set(lien, (attendus.get(lien) ?? 0) + 1);
  return [...attendus].every(([lien, nombre]) => html.split(lien).length - 1 >= nombre);
}

/**
 * L'adresse que le fil lirait dans ce texte, s'il n'est QUE cela : `https://…`, `www.…`, un
 * courriel. `null` sinon. C'est la CIBLE qui est rendue (`http://www.…`, `mailto:…`).
 */
export function addressOf(text: string): string | null {
  const lues = moteur.linkify.match(text);
  if (!lues || lues[0].index !== 0 || lues[0].lastIndex !== text.length) return null;
  return lues[0].url;
}

/**
 * Comment écrire ce lien, et vers où.
 *
 * **Vers où.** Un lien dont le texte EST une adresse mène à cette adresse — sauf si quelqu'un l'a
 * écrit autrement, exprès (`explicit` : le bouton Lien, ou un `[texte](adresse)` relu). L'éditeur
 * lie de lui-même une adresse tapée ou collée, puis laisse corriger son texte sans toucher à sa
 * cible : on lirait une adresse, on irait à une autre. Ici c'est le texte qui fait foi.
 *
 * Et l'adresse est ce qu'on lit D'UN TRAIT : des caractères tapés tout contre elle la prolongent,
 * même quand l'éditeur les a laissés hors de son lien (selon le navigateur, la frappe en fin de
 * lien y entre ou non). `https://…/pag` suivi de `e` est l'adresse `https://…/page` — tant que
 * l'ensemble en est une : un point final, une parenthèse fermante n'en font pas partie. Une adresse
 * relue entre chevrons (`bounded`), elle, s'arrête où son auteur l'a dit.
 *
 * **Comment.** Un lien que le fil referait de lui-même s'écrit par son texte seul — l'adresse qu'on
 * a tapée ou collée, `www.…`, un courriel : c'est ce que tape tout le monde —, à condition que rien
 * ne s'y colle : devant ou derrière, un caractère accolé peut changer ce que le fil y lit. Sinon, une
 * adresse s'écrit entre chevrons. Tout autre lien garde la forme `[texte](adresse)`.
 *
 * En mode NU, une adresse sort par son texte seul quoi qu'il s'y colle : le plus souvent le fil
 * s'arrête de lui-même où il faut (`…/page.`, `(…/page)`), et c'est son rendu qui dira si ce texte
 * peut sortir (`serializeMarkdown`).
 *
 * En mode PRUDENT, une adresse sans protocole ne sort jamais nue : elle prend la forme complète
 * (`serializeMarkdown` dit quand).
 *
 * `suite` : le nombre de caractères du texte SUIVANT qui appartiennent à l'adresse.
 * `nue` : pour une adresse sans protocole laissée nue, le lien que le fil doit en faire.
 */
interface LienLu {
  readonly forme: FormeDeLien;
  readonly cible: string;
  readonly suite: number;
  readonly nue?: string;
}

function lireLeLien(mark: Mark, parent: ProseNode, index: number, nu: boolean, prudent: boolean): LienLu {
  // L'étendue du lien : les nœuds qui se suivent en portant CETTE marque.
  let fin = index;
  while (fin < parent.childCount && mark.isInSet(parent.child(fin).marks)) fin++;
  let texte: string | null = "";
  for (let i = index; i < fin && texte !== null; i++) {
    const noeud = parent.child(i);
    texte = noeud.isText ? texte + (noeud.text ?? "") : null;
  }
  const lue = texte !== null && mark.attrs.explicit !== true ? addressOf(texte) : null;
  const cible = lue ?? String(mark.attrs.href ?? "");
  const contenu = parent.child(index);
  // Une mention dans le lien, un texte qui porte une autre marque, ou un lien qui court sur
  // plusieurs nœuds : la forme complète.
  if (texte === null || fin !== index + 1 || contenu.marks.length !== 1) return { forme: "crochets", cible, suite: 0 };
  const precedent = index > 0 ? parent.child(index - 1) : null;
  const suivant = fin < parent.childCount ? parent.child(fin) : null;
  const libreDevant = !precedent || precedent.type.name === "hardBreak" || (precedent.isText && /\s$/.test(precedent.text ?? ""));
  const libreDerriere = !suivant || suivant.type.name === "hardBreak" || (suivant.isText && /^\s/.test(suivant.text ?? ""));
  // Sans protocole, le fil la lie APRÈS avoir lu les marques : nue, elle est à la merci des signes
  // de ses voisines. On dit donc le lien attendu — et, en mode prudent, on ne la laisse pas nue.
  const fragile = !A_PROTOCOLE.test(texte);
  const peutSortirNue = !(fragile && prudent);
  if (peutSortirNue && libreDevant && libreDerriere && seRelit(texte, cible, texte)) {
    return { forme: "nu", cible, suite: 0, ...(fragile ? { nue: lienRendu(cible, texte) } : {}) };
  }
  if (nu && lue !== null) return { forme: "nu", cible, suite: 0 };
  // Du texte nu tout contre une adresse que l'éditeur a liée : jusqu'à la première espace, il la prolonge.
  if (peutSortirNue && lue !== null && mark.attrs.bounded !== true && libreDevant && suivant?.isText && suivant.marks.length === 0) {
    const colle = /^\S+/.exec(suivant.text ?? "")?.[0] ?? "";
    const entiere = addressOf(texte + colle);
    if (colle !== "" && entiere !== null && seRelit(texte + colle, entiere, texte + colle)) {
      return { forme: "nu", cible, suite: colle.length, ...(fragile ? { nue: lienRendu(entiere, texte + colle) } : {}) };
    }
  }
  return { forme: texte === cible && seRelit(`<${cible}>`, cible, texte) ? "chevrons" : "crochets", cible, suite: 0 };
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

/**
 * Deux listes de même nature posées l'une contre l'autre : pour le markdown, des lignes vides ne
 * les séparent pas — il n'en ferait qu'une, espacée, et la seconde liste numérotée prendrait la
 * suite de la première. Ce qui ouvre une AUTRE liste, c'est un autre signe : « + » après « - »,
 * « 1) » après « 1. ». Une liste sur deux en change donc, parmi celles qui se suivent sans rien
 * entre elles. L'éditeur les laisse naître : la ligne vide supprimée entre deux listes, « 1. »
 * tapé juste derrière une liste numérotée.
 */
function changeDeSigne(parent: ProseNode, index: number): boolean {
  const nature = parent.child(index).type;
  let rang = 0;
  for (let i = index - 1; i >= 0 && parent.child(i).type === nature; i--) rang++;
  return rang % 2 === 1;
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
      // Le nom du langage ne porte que ce qu'un nom porte : un accent grave y casserait la clôture.
      state.write(`${cloture}${String(node.attrs.language ?? "").replace(/[^\w+#.-]/g, "")}\n`);
      state.text(node.textContent, false);
      state.write("\n");
      state.write(cloture);
      state.closeBlock(node);
    },
    horizontalRule(state, node) {
      state.write("---");
      state.closeBlock(node);
    },
    bulletList(state, node, parent, index) {
      const signe = changeDeSigne(parent, index) ? "+ " : "- ";
      state.renderList(node, "  ", () => signe);
    },
    orderedList(state, node, parent, index) {
      const debut = debutDeListe(node.attrs.start);
      const largeur = String(debut + node.childCount - 1).length;
      const retrait = state.repeat(" ", largeur + 2);
      const point = changeDeSigne(parent, index) ? ")" : ".";
      state.renderList(node, retrait, i => {
        const numero = String(debut + i);
        return `${state.repeat(" ", largeur - numero.length)}${numero}${point} `;
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
      // retour à la ligne — le fil est en `breaks`.
      for (let i = index + 1; i < parent.childCount; i++) {
        if (parent.child(i).type !== node.type) {
          state.write("\n");
          return;
        }
      }
    },
    text(state, node, parent, index) {
      const etat = etatDe(state);
      const suivant = index + 1 < parent.childCount ? parent.child(index + 1) : null;
      etat.colle = suivant !== null && suivant.type.name !== "hardBreak" && !(suivant.isText && /^\s/.test(suivant.text ?? ""));
      state.text(node.text ?? "", !etat.dansUnLienNu);
      etat.colle = false;
    },
    mention(state, node) {
      const etat = etatDe(state);
      const slug = typeof node.attrs.slug === "string" ? node.attrs.slug : "";
      // Une mention ne tient pas DANS un lien : le fil en fait elle-même un lien, et deux liens ne
      // s'emboîtent pas — on lirait les crochets. Le lien s'arrête devant elle, et reprend derrière.
      const dansUnLien = etat.lien === "crochets";
      if (dansUnLien) etat.fermerLeLien();
      // Sans slug, le nœud n'est pas une mention qu'on sait renvoyer : son nom, en texte.
      if (slug) state.write(`@${slug}`);
      else state.text(`@${String(node.attrs.label ?? "")}`);
      if (dansUnLien) etat.rouvrirLeLien();
    },
  },
  {
    italic: { open: "*", close: "*", mixable: true, expelEnclosingWhitespace: true },
    bold: { open: "**", close: "**", mixable: true, expelEnclosingWhitespace: true },
    strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
    link: {
      open(state, mark, parent, index) {
        const etat = etatDe(state);
        const { forme, cible, suite, nue } = lireLeLien(mark, parent, index, etat.nu, etat.prudent);
        if (nue !== undefined && !etat.nu) etat.nues.push(nue);
        etat.lien = forme;
        etat.cible = cible;
        etat.suite = suite;
        etat.dansUnLienNu = forme !== "crochets";
        return forme === "nu" ? "" : forme === "chevrons" ? "<" : "[";
      },
      close(state) {
        const etat = etatDe(state);
        const forme = etat.lien;
        if (forme === "crochets") etat.fermerLeLien();
        etat.lien = null;
        etat.cible = "";
        etat.dansUnLienNu = undefined;
        return forme === "chevrons" ? ">" : "";
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

/** Comment écrire chaque bloc de premier niveau : nu, prudent — ou ni l'un ni l'autre. */
interface Modes {
  readonly nus?: ReadonlySet<number>;
  readonly prudents?: ReadonlySet<number>;
  /** N'écrire que ce bloc. */
  readonly seul?: number;
}

function ecrire(doc: ProseNode, { nus = AUCUN, prudents = AUCUN, seul }: Modes): { texte: string; nues: readonly string[] } {
  const etat = new NouvelEtat(serialiseur.nodes, serialiseur.marks, { tightLists: true, hardBreakNodeName: "hardBreak" });
  doc.forEach((bloc, _position, index) => {
    if (seul !== undefined && index !== seul) return;
    etat.nu = nus.has(index);
    etat.prudent = prudents.has(index);
    etat.render(bloc, doc, index);
  });
  return { texte: etat.sortie, nues: etat.nues };
}

const AUCUN: ReadonlySet<number> = new Set();

/** Ce que le fil afficherait de ce texte : ses mentions liées, puis son markdown rendu. */
function rendu(texte: string, mentions: readonly CommentMention[]): string {
  return moteur.render(linkifyMentions(texte, mentions));
}

/**
 * Le document de l'éditeur → le texte à enregistrer.
 *
 * Chaque bloc de premier niveau est écrit deux fois — échappé, et NU, tel qu'on l'a tapé — et le fil
 * départage : s'il rend les deux à l'identique, c'est le nu qui sort. Les échappements qui restent
 * sont ceux qui changent ce qu'on lit. Par bloc, parce qu'un bloc ne déborde pas sur son voisin :
 * une ligne vide les sépare.
 *
 * Avant cela, le bloc échappé est lui-même vérifié : les adresses sans protocole qu'il laisse nues
 * doivent toutes en ressortir liées, entières. Sinon — les signes de deux d'entre elles se
 * répondent, et le fil lirait une marque de l'une à l'autre — il est réécrit PRUDENT, sans en
 * laisser aucune nue.
 */
export function serializeMarkdown(doc: ProseNode): string {
  const mentions = mentionsOf(doc);
  const nus = new Set<number>();
  const prudents = new Set<number>();
  doc.forEach((_bloc, _position, index) => {
    let complet = ecrire(doc, { seul: index });
    if (complet.nues.length > 0 && !toutesLiees(rendu(complet.texte, mentions), complet.nues)) {
      prudents.add(index);
      complet = ecrire(doc, { seul: index, prudents });
    }
    const nu = ecrire(doc, { seul: index, nus: new Set([index]) }).texte;
    if (nu !== complet.texte && rendu(nu, mentions) === rendu(complet.texte, mentions)) nus.add(index);
  });
  return ecrire(doc, { nus, prudents }).texte;
}

/**
 * Le document ne porte-t-il rien à envoyer ? Ni texte qui se lise, ni mention, ni filet : une liste,
 * une citation ou un bloc de code VIDES ne font pas un message.
 */
export function isBlank(doc: ProseNode): boolean {
  let plein = false;
  doc.descendants(node => {
    if (node.isText ? /\S/.test(node.text ?? "") : node.type.name === "mention" || node.type.name === "horizontalRule") plein = true;
    return !plein;
  });
  return !plein;
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
