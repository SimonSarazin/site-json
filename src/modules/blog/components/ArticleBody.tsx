import { ProseContent } from "@/components/shared/ProseContent";

/**
 * Corps d'un article — partagé par les lecteurs `ArticleReader` et `ArticleReaderPoster`.
 *
 * Markdown AVEC HTML brut : les articles repris de WordPress mêlent titres markdown et blocs `<table>`…,
 * qu'un `renderMarkdown` (markdown-it `html: false`) affichait en texte. `forceMarkdown` : sans lui,
 * `ProseContent` verrait une balise et traiterait TOUT le texte en HTML, titres `#` compris.
 * Profil de sanitisation strict par défaut (`sanitizeProse`) : un article peut être écrit par un auteur
 * qui n'est pas administrateur du site.
 */
export function ArticleBody({ text }: { text: unknown }) {
  if (typeof text !== "string" || !text.trim()) return null;
  return (
    <ProseContent
      text={text}
      forceMarkdown
      className="prose prose-lg max-w-none dark:prose-invert prose-img:rounded-lg prose-a:text-primary"
    />
  );
}
