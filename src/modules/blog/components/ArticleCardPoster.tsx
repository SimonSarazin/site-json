import { Link } from "react-router";
import { Calendar, Clock, ImageOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { useT } from "@/hooks/useT";
import { estimateReadingTime } from "../lib/readingTime";
import { stripMarkdown } from "../lib/markdown";
import type { ArticleCardProps } from "./ArticleCard";
import { articleDate } from "../lib/articleDate";

/**
 * Variant « poster » de la carte d'article : pour les flux d'affiches/flyers. L'image est montrée EN ENTIER
 * (object-contain) sur un fond flou tiré de la même image (letterbox élégant, même URL → un seul fetch),
 * cadre portrait 3/4 en grille ; en vedette, écran scindé affiche | texte. Recadrage 16/9 : voir `default`.
 */
export function ArticleCardPoster({ article, href, lastRef, featured = false }: ArticleCardProps) {
  const t = useT("modules/blog");
  const image = article.profilMediumImageUrl || article.profilImageUrl;
  const excerpt = article.shortDescription
    || (typeof article.description === "string" ? stripMarkdown(article.description).slice(0, 180) : "");
  const date = articleDate(article);
  const minutes = estimateReadingTime(article.description);
  const tags = Array.isArray(article.tags) ? article.tags.slice(0, 3) : [];

  const poster = (width: number, containClass: string) => image ? (
    <>
      {/* Fond flou : même URL que l'image nette → un seul téléchargement (cache). */}
      <OptimizedImage aria-hidden src={image} alt="" width={width}
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-lg" />
      <OptimizedImage src={image} alt={article.name || ""} width={width}
        className={`relative ${containClass}`} />
    </>
  ) : (
    <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
      <ImageOff className="h-8 w-8" aria-hidden="true" />
    </div>
  );

  const meta = (
    <>
      {(date || minutes > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {date && <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />{date}</span>}
          {minutes > 0 && <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{t("article.readingTime", undefined, { count: minutes })}</span>}
        </div>
      )}
      <h3 className={`font-semibold leading-snug text-foreground ${featured ? "text-2xl line-clamp-3" : "text-base line-clamp-2"}`}>
        {article.name}
      </h3>
      {excerpt && <p className={`text-sm text-muted-foreground ${featured ? "line-clamp-4" : "line-clamp-3"}`}>{excerpt}</p>}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {tags.map((tag) => <Badge key={tag} variant="secondary" className="text-[11px]">{tag}</Badge>)}
        </div>
      )}
    </>
  );

  if (featured) {
    return (
      <Card ref={lastRef as never} className="group overflow-hidden border-border/60 transition-shadow hover:shadow-md">
        <Link to={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:flex">
          <div className="relative flex min-h-40 justify-center overflow-hidden bg-muted md:w-3/5">
            {poster(900, "h-auto max-h-[480px] w-auto max-w-full object-contain")}
          </div>
          <CardContent className="space-y-3 p-6 md:flex md:w-2/5 md:flex-col md:justify-center">
            {meta}
          </CardContent>
        </Link>
      </Card>
    );
  }

  return (
    <Card ref={lastRef as never} className="group overflow-hidden border-border/60 transition-shadow hover:shadow-md">
      <Link to={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <AspectRatio ratio={3 / 4} className="relative overflow-hidden bg-muted">
          {poster(480, "h-full w-full object-contain")}
        </AspectRatio>
        <CardContent className="space-y-2 p-4">
          {meta}
        </CardContent>
      </Link>
    </Card>
  );
}
export default ArticleCardPoster;
