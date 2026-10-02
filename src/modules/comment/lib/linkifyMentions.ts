import type { CommentMention } from "../types";

/**
 * Transforme les `@slug` d'un texte en liens markdown vers le profil mentionné.
 *
 * Reprend l'intention de `parseMentionsToMarkdown` (`news/components/NewsContent.tsx`) en
 * corrigeant trois défauts mesurés de cette implémentation :
 *
 * 1. **Le slug n'était pas échappé** : `new RegExp("@" + slug + "\\b")` traite les
 *    métacaractères comme de la syntaxe. Un slug contenant `.` ou `+` matchait n'importe quoi.
 * 2. **Aucun tri par longueur** : le slug `marie` était substitué à l'intérieur de
 *    `@marie-dupont` (la frontière `\b` tombe avant le tiret), produisant
 *    `[@Marie](/profil/marie)-dupont`. Ici les slugs les plus longs passent d'abord, et la
 *    frontière refuse explicitement un caractère de mot **ou un tiret**.
 * 3. **Substitution répétée, passe après passe** : un lien déjà produit pouvait être re-balayé
 *    par la mention suivante. Une seule passe, sur une alternative unique, l'exclut.
 *
 * S'y ajoute une règle que l'original n'avait pas : **on ne touche pas au code**. Un `@slug`
 * écrit dans un bloc ou un span de code est du texte, pas une mention.
 */

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Un nom peut contenir des crochets, qui casseraient la syntaxe du lien markdown. */
const escapeLinkText = (value: string) => value.replace(/[[\]]/g, "\\$&");

/**
 * Découpe le texte en segments alternés hors-code / code.
 * Les blocs clôturés (```) passent avant les spans (`) pour qu'un backtick isolé à
 * l'intérieur d'un bloc ne le coupe pas en deux.
 */
function splitOnCode(text: string): Array<{ readonly code: boolean; readonly text: string }> {
  const segments: Array<{ code: boolean; text: string }> = [];
  const pattern = /```[\s\S]*?```|`[^`\n]*`/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) segments.push({ code: false, text: text.slice(last, match.index) });
    segments.push({ code: true, text: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ code: false, text: text.slice(last) });
  return segments;
}

export function linkifyMentions(text: string, mentions: readonly CommentMention[] = []): string {
  const safeText = text ?? "";
  const usable = mentions.filter(m => m.slug);
  if (usable.length === 0) return safeText;

  // Le plus long d'abord : `marie-dupont` doit être essayé avant `marie`.
  const ordered = usable.slice().sort((a, b) => b.slug.length - a.slug.length);
  const bySlug = new Map(ordered.map(m => [m.slug, m]));
  const alternation = ordered.map(m => escapeRegExp(m.slug)).join("|");
  // Ni caractère de mot ni tiret derrière : `@marie` ne matche pas dans `@marie-dupont`.
  const pattern = new RegExp(`@(${alternation})(?![\\w-])`, "g");

  return splitOnCode(safeText)
    .map(segment => segment.code
      ? segment.text
      : segment.text.replace(pattern, (whole, slug: string) => {
        const mention = bySlug.get(slug);
        if (!mention) return whole;
        const label = escapeLinkText(mention.name || slug);
        return `[@${label}](/profil/${slug})`;
      }))
    .join("");
}

/**
 * Marque, dans le HTML DÉJÀ assaini d'un message, les liens de mention qui désignent
 * l'utilisateur courant : le `@moi`, que `styles.css` rend en pastille.
 *
 * **Après** l'assainissement, et non dans le parseur : le profil `sanitizeProse` refuse tout
 * attribut `data-*` (`ALLOW_DATA_ATTR: false`), si bien qu'une marque posée plus tôt serait
 * retirée en silence. Ce qu'on ajoute ici est un attribut FIXE, sans aucune valeur venue du
 * texte, sur une balise d'ouverture reconnue à l'identique : rien de ce qu'écrit l'auteur ne
 * peut s'y glisser.
 *
 * @param html  la sortie de `sanitizeProse`
 * @param hrefs les liens de profil de l'utilisateur, NORMALISÉS comme le parseur les écrit
 *              (`normalizeLink`), sans quoi un slug accentué ne se retrouverait pas
 */
export function markSelfMentions(html: string, hrefs: readonly string[]): string {
  const cibles = hrefs.filter(Boolean);
  if (cibles.length === 0) return html;
  // Le sérialiseur écrit `&` en `&amp;` dans un attribut : on cherche la forme sérialisée. Le
  // guillemet fermant rend la correspondance EXACTE — `/profil/raya` ne marque pas `/profil/raya-2`.
  const alternation = cibles.map(href => escapeRegExp(href.replace(/&/g, "&amp;"))).join("|");
  const pattern = new RegExp(`<a href="(?:${alternation})"`, "g");
  return html.replace(pattern, ouverture => `${ouverture} data-mention-me=""`);
}

/**
 * Forme attendue par `ADD_COMMENTS.mentions[]`.
 *
 * Le schéma exige les **six** champs et refuse tout le reste (`additionalProperties: false`) ;
 * `count` doit être un **nombre**, alors que le legacy stocke parfois la chaîne `"1"`. Envoyer
 * `{id, name}` — ce qu'on suppose naturellement — fait échouer la validation AJV côté client.
 */
export interface MentionPayload {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly type: string;
  readonly value: string;
  readonly count: number;
}

/** Complète des mentions d'interface en la charge utile que le backend accepte. */
export function toMentionPayload(mentions: readonly CommentMention[] = []): MentionPayload[] {
  return mentions
    .filter(m => m.id && m.slug)
    .map(m => ({
      id: m.id,
      name: m.name || m.slug,
      slug: m.slug,
      // Le type stocké est conservé. Une mention saisie ici est un citoyen : B3, `searchMembers`
      // est en `personOnly`.
      type: m.type || "citoyens",
      value: m.name || m.slug,
      count: 1,
    }));
}
