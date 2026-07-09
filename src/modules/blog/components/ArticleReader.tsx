import { useNavigate, useLocation } from "react-router";
import { ArrowLeft, Calendar, User } from "lucide-react";
import "../i18n";
import { useT } from "@/hooks/useT";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { renderMarkdown } from "@/helpers/renderMarkdown";
import { formatDateLong } from "@/helpers/formatDate";
import type { ArticleData } from "../hooks/useArticle";
import type { ArticleReaderProps } from "../variants/readers";

function articleDate(created: unknown): string | null {
  if (created == null || created === "") return null;
  const n = typeof created === "number" ? created : Number(created);
  const d = Number.isFinite(n) ? new Date(n < 2e10 ? n * 1000 : n) : new Date(String(created));
  return Number.isNaN(d.getTime()) ? null : formatDateLong(d);
}
function authorName(article: ArticleData): string | null {
  const p = article.parent && typeof article.parent === "object" ? Object.values(article.parent)[0] : undefined;
  return (p?.name as string) || null;
}

/**
 * Lecteur d'article : hero + titre + méta (date, auteur) + corps markdown sanitizé (prose) + tags.
 * Retour DYNAMIQUE : `navigate(-1)` si on vient d'une page de l'app (retour là d'où on vient — le fil peut
 * donc être à N endroits), sinon (deep-link / pas d'historique) repli sur `backTo` (défaut `/blog`).
 */
export function ArticleReader({ article, backTo = "/blog", hideBack = false, titleAs: Title = "h1" }: ArticleReaderProps) {
  const t = useT("modules/blog");
  const navigate = useNavigate();
  const location = useLocation();
  // `location.key === "default"` = 1re entrée d'historique (chargement direct/deep-link) → pas de retour in-app.
  const goBack = () => (location.key !== "default" ? navigate(-1) : navigate(backTo));
  const image = article.profilImageUrl || article.profilMediumImageUrl;
  const date = articleDate(article.created);
  const author = authorName(article);
  const tags = Array.isArray(article.tags) ? article.tags : [];
  const bodyHtml = typeof article.description === "string" ? renderMarkdown(article.description, { markdownEnabled: true }) : "";

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8">
      {!hideBack && (
        <button type="button" onClick={goBack} aria-label={t("article.backToList")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("article.backToList")}
        </button>
      )}
      <Title className="mb-3 text-3xl font-bold leading-tight text-foreground sm:text-4xl">{article.name}</Title>
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {date && <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" aria-hidden="true" />{date}</span>}
        {author && <span className="inline-flex items-center gap-1.5"><User className="h-4 w-4" aria-hidden="true" />{t("article.by")} {author}</span>}
      </div>
      {image && (
        <AspectRatio ratio={16 / 9} className="mb-8 overflow-hidden rounded-xl bg-muted">
          <OptimizedImage src={image} alt={article.name || ""} width={900} priority className="h-full w-full object-cover" />
        </AspectRatio>
      )}
      {bodyHtml && (
        <div
          className="prose prose-lg max-w-none dark:prose-invert prose-img:rounded-lg prose-a:text-primary"
          // renderMarkdown sanitize déjà (DOMPurify) → sûr
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      )}
      {tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2 border-t pt-6">
          {tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
        </div>
      )}
    </article>
  );
}
export default ArticleReader;
