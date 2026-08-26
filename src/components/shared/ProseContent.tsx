import MarkdownIt from "markdown-it";
import { sanitize } from "@/lib/sanitize";

/**
 * Parseur markdown partagé. `html: true` autorise le HTML inline — d'où
 * l'obligation absolue de passer la sortie dans `sanitize()` avant injection.
 */
const markdownParser = new MarkdownIt({ html: true, linkify: true });

export interface ProseContentProps {
  text: string;
  className?: string;
  /**
   * Forcer l'interprétation markdown, sans auto-détection. À utiliser quand la
   * source est un champ markdown connu et que le texte peut légitimement
   * contenir des chevrons.
   */
  forceMarkdown?: boolean;
}

/**
 * Rend un contenu rédigé par un humain — description saisie dans un textarea
 * coform, info d'un champ, paragraphe d'une fiche : soit du HTML déjà rendu
 * (Parsedown côté PHP), soit du markdown. Dans les deux cas on produit du HTML
 * puis on le **sanitise** (DOMPurify via `@/lib/sanitize`) avant injection —
 * même pattern que `HTMLSection`, cf. `doc/bonnes-pratiques-code.md` §8.
 *
 * ⚠️ Sécurité (XSS) : ne jamais réintroduire `dangerouslySetInnerHTML` sans
 * `sanitize()`, ni `react-markdown` + `rehype-raw` (qui rendaient le HTML brut
 * NON sanitisé → faille). Les tests de non-régression vivent dans
 * `modules/coform/components/FormFields.test.tsx`.
 *
 * Vit ici, et non dans le module coform, parce que le rendu d'un texte saisi
 * n'est pas propre à un formulaire : les fiches AAC affichent les mêmes valeurs
 * en lecture. Une seule implémentation, donc une seule garantie de sécurité.
 */
export function ProseContent({ text, className, forceMarkdown = false }: ProseContentProps) {
  const isHtml = !forceMarkdown && /<[a-zA-Z][^>]*>/.test(text);
  const rawHtml = isHtml ? text : markdownParser.render(text);
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitize(rawHtml) }}
      suppressHydrationWarning
    />
  );
}
