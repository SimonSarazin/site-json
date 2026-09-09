import MarkdownIt from "markdown-it";
import { sanitize, sanitizeProse } from "@/lib/sanitize";

/**
 * Parseur markdown partagé. `html: true` autorise le HTML inline — d'où
 * l'obligation absolue de passer la sortie dans un `sanitize*()` avant injection.
 */
const markdownParser = new MarkdownIt({ html: true, linkify: true });

/**
 * D'où vient le texte — la seule question qui décide du profil DOMPurify.
 *
 * - `"userInput"` (défaut, le cas non sûr) : prose saisie par n'importe quel
 *   visiteur — réponse à un formulaire, description d'un commun, note libre
 *   d'une fiche. Profil **restreint** `sanitizeProse`.
 * - `"formDefinition"` : contenu de la DÉFINITION du formulaire — `field.info`,
 *   libellé et description d'une section, `info` d'une sous-étape — rédigé par
 *   l'administrateur de l'AAP dans le back-office, au même titre d'autorité que
 *   les champs HTML de la config du site. Profil **par défaut** `sanitize`.
 */
export type ProseSource = "userInput" | "formDefinition";

export interface ProseContentProps {
  text: string;
  className?: string;
  /**
   * Forcer l'interprétation markdown, sans auto-détection. À utiliser quand la
   * source est un champ markdown connu et que le texte peut légitimement
   * contenir des chevrons.
   */
  forceMarkdown?: boolean;
  /**
   * Provenance du texte → profil de sanitisation. Défaut `"userInput"` : un
   * appelant qui oublie la prop retombe sur le profil le plus strict.
   */
  source?: ProseSource;
}

/**
 * Rend un contenu rédigé par un humain — description saisie dans un textarea
 * coform, info d'un champ, paragraphe d'une fiche : soit du HTML déjà rendu
 * (Parsedown côté PHP), soit du markdown. Dans les deux cas on produit du HTML
 * puis on le **sanitise** (DOMPurify via `@/lib/sanitize`) avant injection —
 * même pattern que `HTMLSection`, cf. `doc/bonnes-pratiques-code.md` §8.
 *
 * ⚠️ Sécurité (XSS) : ne jamais réintroduire `dangerouslySetInnerHTML` sans
 * sanitisation, ni `react-markdown` + `rehype-raw` (qui rendaient le HTML brut
 * NON sanitisé → faille). Les tests de non-régression vivent dans
 * `ProseContent.test.tsx` (et `modules/coform/components/FormFields.test.tsx`).
 *
 * ⚠️ Deux profils DOMPurify, choisis par `source` — parce que ce qui décide du
 * niveau de confiance est l'AUTEUR du texte, pas le composant qui l'affiche
 * (les deux passent par ce même rendu markdown/HTML). Cf. `@/lib/sanitize` et
 * `doc/03-architecture.md` §"Bibliothèques internes" :
 *
 *  - `source="userInput"` (défaut) → `sanitizeProse`. L'auteur est un visiteur
 *    quelconque (la description d'un commun est un textarea ouvert à qui
 *    dépose) et le profil DOMPurify par défaut laisse passer `<form>`,
 *    `<input>`, `style`/`class` — de quoi dessiner un faux écran de connexion
 *    plein écran sur le domaine du site, sans le moindre script. Le profil
 *    restreint retire ces crochets ; la mise en forme vient du conteneur
 *    `prose` de l'appelant.
 *  - `source="formDefinition"` → `sanitize`. Le texte vient de la définition du
 *    formulaire, écrite par l'administrateur de l'AAP : un `field.info`, un
 *    titre ou une description de section. Le parc met ces libellés en forme
 *    (`style`, `class`, `id`, `<svg>`) et leur appliquer le profil restreint
 *    aplatissait la présentation de formulaires existants — sans rien gagner,
 *    puisque l'auteur a par ailleurs la main sur le formulaire entier.
 *
 * Un appelant qui n'a pas tranché n'a rien à faire : le défaut est le profil
 * strict. Ne JAMAIS poser `source="formDefinition"` sur une valeur de réponse.
 *
 * Vit ici, et non dans le module coform, parce que le rendu d'un texte saisi
 * n'est pas propre à un formulaire : les fiches AAC affichent les mêmes valeurs
 * en lecture. Une seule implémentation, donc une seule garantie de sécurité.
 */
/**
 * Une VRAIE balise HTML — ouvrante avec ses attributs, ou fermante — telle que
 * CommonMark la définit (§ Raw HTML), et rien d'autre. L'ancienne heuristique
 * `<[a-zA-Z][^>]*>` prenait pour une balise tout `<lettre…>` : l'autolien
 * markdown `<https://commun.fr>` ou l'e-mail `<contact@commun.fr>` faisaient
 * basculer TOUT le texte dans la branche HTML, où le markdown n'est plus
 * interprété et où DOMPurify supprime le pseudo-tag — l'URL disparaissait,
 * le reste s'affichait en texte brut. Ici, `https` est suivi de `:` et
 * `contact` de `@` : ni un nom de balise complet, ni un attribut → markdown.
 */
const HTML_TAG_RE =
  /<(?:[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?|\/[a-zA-Z][a-zA-Z0-9-]*\s*)>/;

export function ProseContent({
  text,
  className,
  forceMarkdown = false,
  source = "userInput",
}: ProseContentProps) {
  const isHtml = !forceMarkdown && HTML_TAG_RE.test(text);
  const rawHtml = isHtml ? text : markdownParser.render(text);
  const cleanHtml = source === "formDefinition" ? sanitize(rawHtml) : sanitizeProse(rawHtml);
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
      suppressHydrationWarning
    />
  );
}
