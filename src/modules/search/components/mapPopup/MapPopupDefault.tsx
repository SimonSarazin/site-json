import { useState } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import useItem from "../../hooks/useItem";
import { MapPopupProps } from "../../schema";
import { decorateItemTags } from "../../lib/colorBy";
import { getBaseUrl } from "@/lib/constant/common";

/**
 * Popup de marker — vrai composant React rendu dans le <Popup> react-map-gl
 * (plus de `renderToString` : état, effets et handlers fonctionnent). Le bouton
 * d'action appelle `onAction` (fourni par SearchMap selon `map.itemAction` :
 * détail modal ou navigation profil).
 */
export function MapPopupDefault({ item, t, actionKind, onAction, tagColors }: MapPopupProps) {
  const data = useItem(item);

  const { name, shortDescription, address, tags = [], image } = data;

  // Même décoration que les cartes de liste (masquage des tags techniques, couleur) : la popup ne
  // doit pas révéler un marqueur que la liste cache. Sans conf, identité.
  const chips = decorateItemTags(tags, item?.serverData as Record<string, unknown> | undefined, tagColors);
  const visibleTags = chips.slice(0, 4);
  const remaining = chips.length - visibleTags.length;
  const imgSrc = image ? (image.startsWith("http") ? image : `${getBaseUrl()}${image}`) : "";
  // On mémorise l'URL qui a échoué (et non un booléen) : `item` change sans
  // démontage quand l'utilisateur passe d'un marqueur à l'autre, et comparer à
  // `imgSrc` remet l'état à neuf sans effet de reset. Sans ce garde, une URL
  // morte — avatar supprimé, chemin obsolète — peint le cadre « image cassée »
  // du navigateur en tête de popup.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(imgSrc) && failedSrc !== imgSrc;
  const addressLine = [address?.streetAddress, address?.postalCode, address?.addressLocality]
    .filter(Boolean)
    .join(", ");

  return (
    <Card className="max-w-64 gap-0 overflow-hidden border-border bg-background py-0 shadow-xl sm:max-w-72">
      {showImage && (
        <img
          src={imgSrc}
          alt=""
          loading="lazy"
          onError={() => setFailedSrc(imgSrc)}
          className="h-24 w-full object-cover"
        />
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
            {visibleTags.map(({ tag, label, cssColor }) => (
              <Badge key={tag} variant="secondary" className="text-xs" title={tag}>
                {cssColor && (
                  <span aria-hidden className="mr-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cssColor }} />
                )}
                #{label}
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
