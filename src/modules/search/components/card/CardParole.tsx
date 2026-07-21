import { Calendar, Mic } from "lucide-react";
import type { Poi } from "@communecter/cocolight-api-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDateLong, toValidDate } from "@/helpers/formatDate";
import { toStringArray } from "@/helpers/toStringArray";
import { newsExcerpt } from "@/modules/news/lib/newsExcerpt";
import { PAROLE_CATEGORY_STYLE, paroleAudioUrl } from "../../lib/parole";
import { SearchCardProps } from "../../schema";

/**
 * Card « parole » (témoignage — POI `type=affiche` du costum parent62). TEXT-FIRST :
 * badge catégorie (Compliqué/Difficile/À changer, coloré) + titre + extrait de la transcription +
 * chips taxonomies (territoire/public/âge/thème) + indicateur audio. PAS de lecteur audio dans la
 * grille (décision : l'écoute se fait dans la preview). `serverData` = PoiItemNormalized ; les champs
 * costum (category/territoires/…/medias) passent par l'index signature.
 */
export default function CardParole({ item, onClick }: SearchCardProps) {
  const sd = (item as Poi).serverData;
  const name = sd.name ?? "";
  const category = (sd.category as string | undefined) ?? "";
  const excerpt = newsExcerpt(sd.description, 260);
  const chips = [
    ...toStringArray(sd.territoires).slice(0, 1),
    ...toStringArray(sd.publics).slice(0, 1),
    ...toStringArray(sd.ages).slice(0, 1),
    ...toStringArray(sd.themes).slice(0, 1),
  ].slice(0, 4);
  const hasAudio = !!paroleAudioUrl(sd.medias);
  const created = toValidDate(sd.created);

  return (
    <Card
      onClick={onClick}
      className="flex h-full cursor-pointer flex-col overflow-hidden border-l-4 transition-shadow hover:shadow-md"
      style={{ borderLeftColor: "var(--card-border-left)" }}
    >
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          {category ? (
            <Badge variant="outline" className={PAROLE_CATEGORY_STYLE[category] ?? ""}>
              {category}
            </Badge>
          ) : (
            <span />
          )}
          {hasAudio && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
              <Mic className="h-3.5 w-3.5" /> audio
            </span>
          )}
        </div>
        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-foreground">{name}</h3>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {excerpt && <p className="line-clamp-4 text-sm leading-relaxed text-foreground/85">{excerpt}</p>}
        <div className="mt-auto space-y-2">
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c, i) => (
                <Badge key={`${c}-${i}`} variant="secondary" className="text-[11px] font-normal">
                  {c}
                </Badge>
              ))}
            </div>
          )}
          {created && (
            <div className="flex items-center gap-1.5 border-t border-border pt-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateLong(created)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
