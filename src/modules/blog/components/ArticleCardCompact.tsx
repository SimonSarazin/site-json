import { Link } from "react-router";
import { Calendar } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { formatDateLong } from "@/helpers/formatDate";
import { stripMarkdown } from "./ArticleCard";
import type { ArticleCardProps } from "./ArticleCard";

/** Date de l'article (created unix s) → libellé long, tolérant. */
function articleDate(created: unknown): string | null {
  if (created == null || created === "") return null;
  const n = typeof created === "number" ? created : Number(created);
  const d = Number.isFinite(n) ? new Date(n < 2e10 ? n * 1000 : n) : new Date(String(created));
  return Number.isNaN(d.getTime()) ? null : formatDateLong(d);
}

/**
 * Variant COMPACT (registre `CARD_VARIANTS`, clé `compact`) : ligne horizontale (vignette carrée + titre +
 * date + extrait 2 lignes) — adaptée à un `feedLayout: "list"`. Mêmes props que la carte par défaut.
 */
export function ArticleCardCompact({ article, href, lastRef, featured = false }: ArticleCardProps) {
  const image = article.profilMediumImageUrl || article.profilImageUrl;
  const excerpt = article.shortDescription
    || (typeof article.description === "string" ? stripMarkdown(article.description).slice(0, 160) : "");
  const date = articleDate(article.created);

  return (
    <Link
      ref={lastRef as never}
      to={href}
      className="group flex gap-4 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/40"
    >
      <div className={`${featured ? "h-28 w-28" : "h-20 w-20"} shrink-0 overflow-hidden rounded-md bg-muted`}>
        {image
          ? <OptimizedImage src={image} alt={article.name || ""} width={featured ? 240 : 160} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          : <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">—</div>}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {date && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />{date}
          </div>
        )}
        <h3 className={`font-semibold leading-snug text-foreground line-clamp-2 ${featured ? "text-lg" : "text-base"}`}>
          {article.name}
        </h3>
        {excerpt && <p className="line-clamp-2 text-sm text-muted-foreground">{excerpt}</p>}
      </div>
    </Link>
  );
}
export default ArticleCardCompact;
