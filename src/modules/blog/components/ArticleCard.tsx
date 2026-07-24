import { Link } from "react-router";
import { Calendar, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { formatDateLong } from "@/helpers/formatDate";
import { useT } from "@/hooks/useT";
import { estimateReadingTime } from "../lib/readingTime";
import type { ArticleData } from "../hooks/useArticle";

// Re-export (rétro-compat des imports existants : ArticleCardCompact, BlogArticleSeo).
export { stripMarkdown } from "../lib/markdown";
import { stripMarkdown } from "../lib/markdown";

/** Date de l'article (created unix s) → libellé long, tolérant (number s / ms / string / absent). */
function articleDate(created: unknown): string | null {
  if (created == null || created === "") return null;
  const n = typeof created === "number" ? created : Number(created);
  const d = Number.isFinite(n) ? new Date(n < 2e10 ? n * 1000 : n) : new Date(String(created));
  return Number.isNaN(d.getTime()) ? null : formatDateLong(d);
}

/** Props communes à TOUS les variants de carte (registre `CARD_VARIANTS`). */
export interface ArticleCardProps {
  article: ArticleData;
  href: string;
  lastRef?: (el: HTMLElement | null) => void;
  featured?: boolean;
}

/** Carte éditoriale d'article (image 16/9, date, titre, extrait, tags). `featured` = grand format. */
export function ArticleCard({ article, href, lastRef, featured = false }: ArticleCardProps) {
  const t = useT("modules/blog");
  const image = article.profilMediumImageUrl || article.profilImageUrl;
  const excerpt = article.shortDescription
    || (typeof article.description === "string" ? stripMarkdown(article.description).slice(0, 180) : "");
  const date = articleDate(article.created);
  const minutes = estimateReadingTime(article.description);
  const tags = Array.isArray(article.tags) ? article.tags.slice(0, 3) : [];

  return (
    <Card ref={lastRef as never} className="group overflow-hidden border-border/60 transition-shadow hover:shadow-md">
      <Link to={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <AspectRatio ratio={16 / 9} className="bg-muted">
          {image
            ? <OptimizedImage src={image} alt={article.name || ""} width={featured ? 900 : 480} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
            : <div className="flex h-full w-full items-center justify-center text-muted-foreground/70">—</div>}
        </AspectRatio>
        <CardContent className="space-y-2 p-4">
          {(date || minutes > 0) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {date && <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />{date}</span>}
              {minutes > 0 && <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{t("article.readingTime", undefined, { count: minutes })}</span>}
            </div>
          )}
          <h3 className={`font-semibold leading-snug text-foreground line-clamp-2 ${featured ? "text-2xl" : "text-base"}`}>
            {article.name}
          </h3>
          {excerpt && <p className="line-clamp-3 text-sm text-muted-foreground">{excerpt}</p>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {tags.map((t) => <Badge key={t} variant="secondary" className="text-[11px]">{t}</Badge>)}
            </div>
          )}
        </CardContent>
      </Link>
    </Card>
  );
}
export default ArticleCard;
