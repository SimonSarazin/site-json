import { ArrowRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import useItem from "../../hooks/useItem";
import { MapPopupProps } from "../../schema";
import { getBaseUrl } from "@/lib/constant/common";

/**
 * Popup de marker — vrai composant React rendu dans le <Popup> react-map-gl
 * (plus de `renderToString` : état, effets et handlers fonctionnent). Le bouton
 * d'action appelle `onAction` (fourni par SearchMap selon `map.itemAction` :
 * détail modal ou navigation profil).
 */
export function MapPopupDefault({ item, t, actionKind, onAction }: MapPopupProps) {
  const data = useItem(item);

  const { name, shortDescription, address, tags = [], image } = data;

  const visibleTags = tags.slice(0, 4);
  const remaining = tags.length - visibleTags.length;
  const imgSrc = image ? (image.startsWith("http") ? image : `${getBaseUrl()}${image}`) : "";
  const addressLine = [address?.streetAddress, address?.postalCode, address?.addressLocality]
    .filter(Boolean)
    .join(", ");

  return (
    <Card className="max-w-64 gap-0 overflow-hidden border-border bg-background py-0 shadow-xl sm:max-w-72">
      {imgSrc && (
        <img src={imgSrc} alt="" loading="lazy" className="h-24 w-full object-cover" />
      )}
      <CardContent className="space-y-2 p-3">
        <h3 className="text-sm font-bold leading-tight text-foreground">{name}</h3>

        <p className="flex items-start gap-1 text-xs text-muted-foreground">
          <MapPin size={14} className="mt-0.5 shrink-0" />
          {addressLine || t("Adresse inconnue")}
        </p>

        {shortDescription && (
          <p className="line-clamp-3 text-xs text-muted-foreground">{shortDescription}</p>
        )}

        {visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                #{tag}
              </Badge>
            ))}
            {remaining > 0 && (
              <Badge variant="outline" className="text-xs">
                +{remaining}
              </Badge>
            )}
          </div>
        )}

        <Button variant="default" size="sm" className="w-full" onClick={onAction}>
          {actionKind === "profil" ? t("Voir le profil") : t("En savoir plus")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

// export default requis pour le `lazy(() => import(...))` du dispatcher
// `SearchMapPopup` (l'export nommé reste pour les tests).
export default MapPopupDefault;
