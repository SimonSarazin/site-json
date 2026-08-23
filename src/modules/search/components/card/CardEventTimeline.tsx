import { useState } from "react";
import { format } from "date-fns";
import { Clock, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { useT } from "@/hooks/useT";
import getDateFnsLocale from "@/dateFns";
import useItem from "../../hooks/useItem";
import { collectChipValues, decorateTags } from "../../lib/colorBy";
import { shortenTag } from "@/helpers/shortenTag";
import { SearchCardProps } from "../../schema";

/**
 * Carte compacte de la vue `list.layout: "timeline"` (rendue par `TimelineListView`,
 * jamais dispatchée par `SearchCard` — pas de `card.type` dédié) : titre couleur lien,
 * horloge + heure de début, chip catégorie (1er tag par défaut, `card.tagLimit` pour en
 * afficher plus, `card.tagColors` honoré), extrait sur 3 lignes, visuel (affiche) à
 * droite, bouton « En savoir plus ». Le clic — carte entière ou bouton — remonte le
 * MÊME `onClick` que les autres cartes (→ détail/drawer via `SearchListView`).
 */
export default function CardEventTimeline({ item, onClick, card = {} }: SearchCardProps) {
  const t = useT("modules/search");
  const data = useItem(item);
  const { name, startDate, shortDescription, image, tags = [] } = data;
  const [imageFailed, setImageFailed] = useState(false);
  const locale = getDateFnsLocale();
  const showImage = Boolean(image) && !imageFailed;

  const chips = decorateTags(
    collectChipValues(tags, item?.serverData as Record<string, unknown> | undefined, card.tagColors),
    card.tagColors,
  ).slice(0, card.tagLimit ?? 1);

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer py-4 shadow-md transition-shadow hover:shadow-lg"
    >
      <CardContent className="flex gap-4 px-4">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-semibold text-primary hover:underline">{name}</h3>

          {startDate && (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="tabular-nums">{format(startDate, "HH:mm", { locale })}</span>
            </div>
          )}

          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {chips.map(({ tag, label, cssColor }) => (
                <Badge key={tag} variant="secondary" className="text-xs" title={tag}>
                  {cssColor && (
                    <span
                      aria-hidden
                      className="mr-1 inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: cssColor }}
                    />
                  )}
                  {shortenTag(label)}
                </Badge>
              ))}
            </div>
          )}

          {shortDescription && (
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{shortDescription}</p>
          )}

          <Button
            variant="link"
            size="sm"
            className="mt-2 h-auto px-0"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            {t("En savoir plus")} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Affiche/flyer à droite ; la colonne disparaît sans image ou si elle casse
            (même bascule `imageFailed` que CardEvent). */}
        {showImage && (
          <div className="w-24 shrink-0 self-start overflow-hidden rounded-lg sm:w-28">
            <OptimizedImage
              src={image}
              alt={name}
              width={160}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
