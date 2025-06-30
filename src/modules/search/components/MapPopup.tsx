import { MapPin } from "lucide-react";
import ReactDOMServer from "react-dom/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface MapPopupProps {
  name: string;
  tags?: string[];
  address?: {
    streetAddress?: string;
    postalCode?: string;
  };
  shortDescription?: string;
  id: string;
  t: (key: string) => string;
}

export function renderMapPopup({ name, tags = [], address, shortDescription, id, t}: MapPopupProps) {
  let expandTags = false;

  const visibleTags = expandTags ? tags : tags.slice(0, 5);
  const remaining = tags.length - visibleTags.length;

  const tagsJsx = (
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
          onClick={() => { expandTags = true; /* re-renderer */ }}
        >
          +{remaining}
        </Badge>
      )}
    </div>
  );

  // idem pour la description : line-clamp + scroll
  const descJsx = (
    shortDescription && (
      <>
        <h2 className="font-semibold mb-1">{t("Description")}</h2>
        <div className="text-sm mb-2 max-h-20 overflow-y-auto">
          {shortDescription || "—"}
        </div>
      </>
    )
  );
  
  const jsx = (
    <Card className="w-64 bg-background hover:shadow-xl" id={id}>
      <CardHeader className="bg-primary text-primary-foreground rounded-t-xl">
        <CardTitle className="text-lg">{name}</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        {tagsJsx}
        <p className="flex items-center mb-1 text-xs text-muted-foreground">
          <MapPin size={16} className="mr-1" /> {address?.streetAddress || "Adresse inconnue"}
          {address?.postalCode && `, ${address.postalCode}`}
        </p>
        {descJsx}
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
  return ReactDOMServer.renderToString(jsx);
}
