import { Link } from "react-router";
import { Calendar, Clock, ImageOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { estimateReadingTime } from "../lib/readingTime";
import { stripMarkdown } from "../lib/markdown";
import { cardTaxonomyBadges } from "../lib/articleTaxonomy";
import type { ArticleCardProps } from "./ArticleCard";
import { articleDate } from "../lib/articleDate";

/**
 * Variant « poster » de la carte d'article : pour les flux d'affiches/flyers. L'image est montrée EN ENTIER
 * (object-contain) sur un fond flou tiré de la même image (letterbox élégant, même URL → un seul fetch),
 * cadre portrait 3/4 en grille ; en vedette, écran scindé affiche | texte. Recadrage 16/9 : voir `default`.
 *
 * `density: "compact"` (cf. `ArticleCard`) : cadre 16/9 (nettement moins haut que le 3/4 portrait
 * historique — `object-contain` évite juste de couper l'affiche, pas de l'agrandir à tout prix), la
 * place gagnée sur l'image revenant au texte : titre, extrait et pastilles de taxonomie restent tous
 * affichés, juste ramenés à une seule ligne chacun. Ignoré pour la carte `featured`, qui garde son
 * gabarit plein.
 */
export function ArticleCardPoster({ article, href, lastRef, featured = false, density }: ArticleCardProps) {
  const t = useT("modules/blog");
  const image = article.profilMediumImageUrl || article.profilImageUrl;
  const excerpt = article.shortDescription
    || (typeof article.description === "string" ? stripMarkdown(article.description).slice(0, 180) : "");
  const date = articleDate(article);
  const minutes = estimateReadingTime(article.description);
  const badges = cardTaxonomyBadges(article);
  const compact = density === "compact" && !featured;

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
        <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
          {date && <span className="inline-flex items-center gap-1.5"><Calendar className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />{date}</span>}
          {minutes > 0 && <span className="inline-flex items-center gap-1.5"><Clock className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />{t("article.readingTime", undefined, { count: minutes })}</span>}
        </div>
      )}
      <h3 className={cn(
        "font-semibold leading-snug text-foreground",
        featured ? "text-2xl line-clamp-3" : compact ? "text-sm line-clamp-1" : "text-base line-clamp-2",
      )}>
        {article.name}
      </h3>
      {/* `compact` : extrait et pastilles de taxonomie reviennent (demande explicite), ramenés à UNE
          ligne chacun — c'est la hauteur de l'image, pas la présence de ces informations, qui porte le
          resserrement. */}
      {excerpt && <p className={cn("text-muted-foreground", compact ? "text-xs line-clamp-1" : `text-sm ${featured ? "line-clamp-4" : "line-clamp-3"}`)}>{excerpt}</p>}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {badges.map((b) => <Badge key={b} variant="secondary" className="text-[11px]">{b}</Badge>)}
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
    // `compact` : `py-6`/`gap-6` du `Card` de base retirés — c'est du vide autour du SEUL enfant
    // (`Link`), pas un espacement entre plusieurs blocs ; 48px perdus en haut/bas de chaque carte pour
    // rien. Le cadre garde ses coins arrondis (`overflow-hidden` déjà sur `Card`) : l'image vient les
    // toucher directement, comme une carte « image plein cadre » classique.
    <Card ref={lastRef as never} className={cn("group overflow-hidden border-border/60 transition-shadow hover:shadow-md", compact && "gap-0 py-0")}>
      <Link to={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {/* `compact` : cadre 3/2 — le 3/4 historique, sur une colonne de grille, pèse à lui seul plus des
            deux tiers de la hauteur de la carte. Un peu remonté par rapport au 16/9 initial : le retrait
            de `py-6` ci-dessus a déjà libéré 48px, inutile de sacrifier autant l'image. Le fond flou
            comble le vide latéral que le recadrage plus large laisse à côté d'une affiche restée
            portrait (`object-contain`). */}
        <AspectRatio ratio={compact ? 3 / 2 : 3 / 4} className="relative overflow-hidden bg-muted">
          {poster(480, "h-full w-full object-contain")}
        </AspectRatio>
        <CardContent className={cn("space-y-1", compact ? "p-2.5" : "space-y-2 p-4")}>
          {meta}
        </CardContent>
      </Link>
    </Card>
  );
}
export default ArticleCardPoster;
