import { Link } from "react-router";
import { Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { formatDateLong } from "@/helpers/formatDate";
import type { ArticleData } from "../hooks/useArticle";

/** Retire la syntaxe markdown pour un APERÇU en texte brut (carte) : liens/images/titres/emphase/code. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")      // images ![alt](url) → rien
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")    // liens [texte](url) → texte
    .replace(/^#{1,6}\s+/gm, "")                // titres
    .replace(/[*_`~>#]/g, "")                    // emphase/code/citation/reliquat
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Date de l'article (created unix s) → libellé long, tolérant (number s / ms / string / absent). */
function articleDate(created: unknown): string | null {
  if (created == null || created === "") return null;
  const n = typeof created === "number" ? created : Number(created);
  const d = Number.isFinite(n) ? new Date(n < 2e10 ? n * 1000 : n) : new Date(String(created));
  return Number.isNaN(d.getTime()) ? null : formatDateLong(d);
}

/** Carte éditoriale d'article (image 16/9, date, titre, extrait, tags). `featured` = grand format. */
export function ArticleCard({ article, href, lastRef, featured = false }: {
  article: ArticleData;
  href: string;
  lastRef?: (el: HTMLElement | null) => void;
  featured?: boolean;
}) {
  const image = article.profilMediumImageUrl || article.profilImageUrl;
  const excerpt = article.shortDescription
    || (typeof article.description === "string" ? stripMarkdown(article.description).slice(0, 180) : "");
  const date = articleDate(article.created);
  const tags = Array.isArray(article.tags) ? article.tags.slice(0, 3) : [];

  return (
    <Card ref={lastRef as never} className="group overflow-hidden border-border/60 transition-shadow hover:shadow-md">
      <Link to={href} className="block">
        <AspectRatio ratio={16 / 9} className="bg-muted">
          {image
            ? <OptimizedImage src={image} alt={article.name || ""} width={featured ? 900 : 480} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
            : <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">—</div>}
        </AspectRatio>
        <CardContent className="space-y-2 p-4">
          {date && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />{date}
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
