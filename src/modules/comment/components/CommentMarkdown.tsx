import { useMemo } from "react";
import MarkdownIt from "markdown-it";
import { sanitizeProse } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { linkifyMentions, markSelfMentions } from "../lib/linkifyMentions";
import type { CommentMention } from "../types";

/**
 * Rendu du texte d'un message.
 *
 * **Deux barrières, et non une.** La première est le parseur, restreint *à la source* :
 * `html: false` échappe tout HTML écrit par l'auteur, et les règles `heading`, `lheading`,
 * `image` sont désactivées — un `# titre` ou une image distante ne peuvent donc pas exister
 * dans la sortie, plutôt que d'être retirés après coup. La seconde est `sanitizeProse`, le
 * profil DOMPurify déjà en place dans le dépôt pour la prose saisie par n'importe qui.
 *
 * Ce choix conserve le moteur du dépôt (`markdown-it` + `@/lib/sanitize`, cf. `ProseContent`)
 * au lieu d'introduire un second chemin de rendu markdown : une seule implémentation, donc
 * une seule garantie de sécurité à maintenir. `react-markdown` + `rehype-raw` est
 * explicitement proscrit ici comme ailleurs — c'était une faille.
 *
 * `breaks: true` est propre au fil : dans une discussion, un retour à la ligne simple est
 * voulu par celui qui écrit, alors qu'en markdown standard il serait ignoré.
 */
const parser = new MarkdownIt({ html: false, linkify: true, breaks: true })
  .disable(["heading", "lheading", "image"]);

/**
 * Tout lien SORTANT est marqué `rel="noopener noreferrer nofollow ugc"`.
 *
 * `nofollow ugc` est le point important : un fil de commentaires est la cible naturelle d'un
 * spam de liens, et cette annotation retire tout bénéfice de référencement au spammeur.
 *
 * `target="_blank"` n'est délibérément PAS posé : mesuré, `sanitizeProse` (le profil DOMPurify
 * partagé) retire l'attribut `target`. Le poser ici donnerait l'illusion d'un comportement que
 * la sanitisation défait juste après. Les liens s'ouvrent donc dans l'onglet courant, comme
 * partout ailleurs dans le dépôt où `ProseContent` est employé.
 *
 * Les liens INTERNES (`/profil/…`, produits par les mentions) ne sont pas marqués : ils
 * pointent vers le site lui-même.
 */
const defaultLinkOpen = parser.renderer.rules.link_open
  ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

parser.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = token?.attrGet("href") ?? "";
  if (!href.startsWith("/")) {
    token?.attrSet("rel", "noopener noreferrer nofollow ugc");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

export interface CommentMarkdownProps {
  readonly text: string;
  readonly mentions?: readonly CommentMention[];
  /**
   * L'utilisateur courant : ses mentions — le `@moi` — sont marquées pour être rendues en
   * pastille. C'est ce qui dit « pour toi » dans le texte même, là où le fond de la ligne ne dure
   * que jusqu'à la lecture.
   */
  readonly meId?: string | null;
  readonly className?: string;
}

export function CommentMarkdown({ text, mentions, meId = null, className }: CommentMarkdownProps) {
  const html = useMemo(() => {
    const sain = sanitizeProse(parser.render(linkifyMentions(text ?? "", mentions)));
    const miens = meId === null
      ? []
      : (mentions ?? []).filter(m => m.id === meId && m.slug).map(m => parser.normalizeLink(`/profil/${m.slug}`));
    return markSelfMentions(sain, miens);
  }, [text, mentions, meId]);

  return (
    <div
      // Le conteneur `prose` porte toute la mise en forme : `sanitizeProse` retire `class`,
      // `style` et `id` du contenu, donc rien ne peut s'échapper de cette boîte.
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-foreground",
        "prose-p:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-blockquote:my-1",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:before:content-none prose-code:after:content-none",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
      suppressHydrationWarning
    />
  );
}
