import { MapPin, Phone, Mail, Calendar, Tag, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchCardProps } from "../schema";
import useItem from "../hooks/useItem";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMemo } from "react";
import { getBaseUrl } from "@/lib/constant/common";

function shortenTag(tag: string, maxLength = 20): string {
  if (tag.length <= maxLength) return tag;
  const sliceLen = Math.floor((maxLength - 1) / 2);
  return `${tag.slice(0, sliceLen)}…${tag.slice(-sliceLen)}`;
}

export default function SearchCardDetailed({
  item,
  onClick,
  card = {
    tagLimit: 10,
    showDescription: true,
    showAddress: true,
  },
}: SearchCardProps) {
  const data = useItem(item);

  const {
    name,
    address,
    shortDescription,
    description,
    tags = [],
    image,
    email,
    phone,
    startDate,
    endDate,
  } = data;

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

  const fullDescription = description || shortDescription;
  const displayTags = tags.slice(0, card.tagLimit || 10);
  const remainingTags = tags.length - (card.tagLimit || 10);

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Image section */}
          <div className="w-full sm:w-64 h-48 sm:h-auto flex-shrink-0 relative overflow-hidden">
            {image ? (
              <img
                src={image.startsWith('http') ? image : `${getBaseUrl()}${image}`}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Avatar className="h-24 w-24 bg-primary/10">
                  <AvatarImage src={image} alt={`${name} avatar`} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-3xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>

          {/* Content section */}
          <div className="flex-1 p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-primary group-hover:text-primary/80 transition-colors mb-2">
                  {name}
                </h3>

                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {address?.addressLocality && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {address.postalCode && `${address.postalCode} `}
                        {address.addressLocality}
                      </span>
                    </div>
                  )}

                  {phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${phone}`} className="hover:text-primary" onClick={(e) => e.stopPropagation()}>
                        {phone}
                      </a>
                    </div>
                  )}

                  {email && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${email}`} className="hover:text-primary" onClick={(e) => e.stopPropagation()}>
                        {email}
                      </a>
                    </div>
                  )}

                  {(startDate || endDate) && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {startDate && new Date(startDate).toLocaleDateString('fr-FR')}
                        {endDate && ` - ${new Date(endDate).toLocaleDateString('fr-FR')}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onClick) onClick();
                }}
              >
                Voir plus
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {fullDescription && (
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {fullDescription}
              </p>
            )}

            {displayTags.length > 0 && (
              <div className="flex items-start gap-2">
                <Tag className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {displayTags.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs"
                      title={tag}
                    >
                      {shortenTag(tag)}
                    </Badge>
                  ))}
                  {remainingTags > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      +{remainingTags}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
