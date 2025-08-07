import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import useItem from "../../hooks/useItem";
import { MapPopupProps } from "../../schema";
import { useState } from "react";

export function MapPopupDefault({ item, id, t }: MapPopupProps) {
  const data = useItem(item);

  const {
    name,
    shortDescription,
    address,
    tags = [],
  } = data;

  const [expandTags, setExpandTags] = useState(false);     // ← state, pas une variable mutée
  const visibleTags = expandTags ? tags : tags.slice(0, 5);
  const remaining = tags.length - visibleTags.length;

  return (
    <Card className="max-w-64 sm:max-w-2xl bg-background hover:shadow-xl" id={id}>
      <CardHeader className="bg-primary text-primary-foreground rounded-t-xl">
        <CardTitle className="text-xs sm:text-sm lg:text-lg">{name}</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        {/* Tags */}
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto mb-2">
          {visibleTags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              #{tag}
            </Badge>
          ))}
          {remaining > 0 && (
            <Badge
              variant="outline"
              className="text-xs cursor-pointer"
              onClick={() => setExpandTags(true)}
            >
              +{remaining}
            </Badge>
          )}
        </div>

        {/* Adresse */}
        <p className="flex items-center mb-1 text-xs text-muted-foreground">
          <MapPin size={16} className="mr-1" /> {address?.streetAddress || "Adresse inconnue"}
          {address?.postalCode && `, ${address.postalCode}`}
        </p>

        {/* Description */}
        {shortDescription && (
          <>
            <h2 className="font-semibold mb-1">{t("Description")}</h2>
            <div className="text-sm mb-2 max-h-20 overflow-y-auto">
              {shortDescription}
            </div>
          </>
        )}

        <Button
          variant="outline"
          className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          data-id={id}
        >
          <i className="fa-solid fa-hand-pointer mr-2" /> {t("En savoir plus")}
        </Button>
      </CardContent>
    </Card>
  );
}