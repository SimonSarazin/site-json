import { Calendar, Images, Link2, MapPin, Play } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { formatDateLong } from "@/helpers/formatDate";
import { newsExcerpt } from "@/modules/news/lib/newsExcerpt";
import { normalizeFilterValue } from "../../../lib/dropdownFilters";
import { bubbleTint, hostname } from "../../../lib/testimonial";
import { useResourceData } from "../../../hooks/useResourceData";
import { SearchCardProps } from "../../../schema";

/**
 * Design « card » de la card resource — HÉROS ADAPTATIF AU TYPE (« médiathèque à bulles ») :
 *  - avec image (photo/vidéo/jeu) → vignette + pastille-type ; overlay play (vidéo) / « N photos » (galerie) ;
 *  - sans image (lien/document/compte-rendu) → COUVERTURE TYPÉE (surface teintée + grande icône de type),
 *    + domaine pour un Lien. Aucune carte n'est jamais vide.
 * Puis titre, extrait, chips de repères, pied ville · N liens · date. Données via `useResourceData`.
 */
export default function CardResourceCard({ item, onClick, list }: SearchCardProps) {
  const resource = list?.resource;
  const data = useResourceData(item, resource);
  const badgeColor = data.badge?.color ?? "var(--primary)";
  const tint = bubbleTint(badgeColor);
  const excerpt = newsExcerpt(data.description, 180);
  const typeIcon = (data.badge?.icon ?? "file") as IconName;
  // Valeur STOCKÉE (`raw`), pas le libellé affiché : ce jeton indexe les styles par catégorie,
  // il ne doit pas changer avec la langue ni avec une retouche de libellé.
  const cat = normalizeFilterValue(data.badge?.raw ?? "");
  const isVideo = cat === "video";
  const isLink = cat === "lien";
  const domain = data.urls[0] ? hostname(data.urls[0]) : "";
  const galleryCount = data.gallery.length;

  return (
    <Card
      onClick={onClick}
      className="group flex h-full cursor-pointer flex-col overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      {/* HÉROS adaptatif au type */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {data.image ? (
          <>
            <OptimizedImage
              src={data.image}
              alt={data.title}
              width={480}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {isVideo && (
              <span aria-hidden className="absolute inset-0 grid place-items-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-[#1a1a2e] shadow-lg">
                  <Play className="h-5 w-5 translate-x-0.5" />
                </span>
              </span>
            )}
            {galleryCount > 1 && (
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white">
                <Images className="h-3.5 w-3.5" /> {galleryCount} photos
              </span>
            )}
            {data.badge && (
              <span
                className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow"
                style={{ backgroundColor: `color-mix(in oklab, ${badgeColor} 88%, black)` }}
              >
                <DynamicIcon name={typeIcon} className="h-3.5 w-3.5" />
                {data.badge.value}
              </span>
            )}
          </>
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ backgroundColor: `color-mix(in oklab, ${badgeColor} 14%, var(--card))` }}
          >
            <span
              className="grid h-14 w-14 place-items-center rounded-xl"
              style={{ backgroundColor: `color-mix(in oklab, ${badgeColor} 22%, var(--card))`, color: badgeColor }}
            >
              <DynamicIcon name={typeIcon} className="h-7 w-7" />
            </span>
            {isLink && domain && (
              <span
                className="font-mono text-xs font-semibold"
                style={{ color: `color-mix(in oklab, ${badgeColor} 55%, var(--foreground))` }}
              >
                {domain}
              </span>
            )}
            {data.badge && (
              <span
                className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-semibold shadow-sm"
                style={{ borderColor: tint.border, color: tint.text }}
              >
                <DynamicIcon name={typeIcon} className="h-3.5 w-3.5" />
                {data.badge.value}
              </span>
            )}
          </div>
        )}
      </div>

      {/* CORPS */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-foreground">{data.title}</h3>
        {excerpt && <p className="line-clamp-3 text-sm leading-relaxed text-foreground/80">{excerpt}</p>}

        {data.facets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.facets
              .flatMap((f) => f.tokens.slice(0, 1))
              .slice(0, 4)
              .map((tok, i) => (
                <Badge key={`${tok}-${i}`} variant="secondary" className="text-[11px] font-normal">
                  {tok}
                </Badge>
              ))}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
          {data.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {data.city}
            </span>
          )}
          {data.urls.length > 0 && (
            <span className="inline-flex items-center gap-1 text-primary">
              <Link2 className="h-3.5 w-3.5" />
              {data.urls.length} lien{data.urls.length > 1 ? "s" : ""}
            </span>
          )}
          {data.date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateLong(data.date)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
