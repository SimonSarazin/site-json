import { Lightbulb, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { useT } from "@/hooks/useT";
import { SearchCardProps } from "../../schema";
import useItem from "../../hooks/useItem";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMemo } from "react";

/**
 * Raccourcit un tag très long: conserve le début et la fin pour lisibilité.
 * Exemple: «super-long-hyper-tag» → «super‑lo…tag»
 */
function shortenTag(tag: string, maxLength = 18): string {
  if (tag.length <= maxLength) return tag;
  const sliceLen = Math.floor((maxLength - 1) / 2);
  return `${tag.slice(0, sliceLen)}…${tag.slice(-sliceLen)}`;
}

export default function CardDefault({
  item,
  onClick,
  card = {
    tagLimit: 5,
    showDescription: false,
    showAddress: true,
  },
}: SearchCardProps) {
  const t = useT("modules/search");
  const data = useItem(item);

  const {
    name,
    address,
    shortDescription,
    tags = [],
    image,
    countProjects = 0,
  } = data;

  // Initiales du nom (max 3 caractères)
  const initials = useMemo(
    () =>
      name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 3),
    [name]
  );

  return (
    <Card
      className="group hover:shadow-lg transition-all duration-300 cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <Avatar className="h-12 w-12 bg-primary/10">
            <AvatarImage src={image} alt={`${name} avatar`} />
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-primary group-hover:text-primary/80 transition-colors w-full break-words">
              {name}
            </h3>

            {card.showAddress && address?.addressLocality && (
              <div className="flex items-center text-sm text-muted-foreground mb-2 truncate">
                <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                {address.addressLocality}
              </div>
            )}

            {card.showDescription && shortDescription && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {shortDescription}
              </p>
            )}

            <div className="flex items-center space-x-1 mb-3">
              <Lightbulb className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">
                {countProjects} {t("projets")}
              </span>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, card.tagLimit).map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="text-xs max-w-[8rem] overflow-hidden"
                    title={tag}
                  >
                    {shortenTag(tag)}
                  </Badge>
                ))}

                {tags.length > (card?.tagLimit ?? 5) && (
                  <Badge variant="secondary" className="text-xs">
                    +{tags.length - (card?.tagLimit ?? 5)}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
