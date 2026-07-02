import React from "react";
import { MapPin } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import LazyImage from "@/components/layout/LazyImage";
import { useT } from "@/hooks/useT";
import useItem from "@/modules/search/hooks/useItem";
import { ClickableFacet } from "@/modules/search/components/ClickableFacet";
import { resolveServerDataPath, toFacetTokens } from "@/modules/search/lib/dropdownFilters";
import type { PreviewProps } from "@/modules/search/schema";

/**
 * Preview **générique piloté par la config** (`preview.type: "facets"`) : rend
 * l'en-tête (image / nom / adresse) puis les facettes déclarées dans
 * `preview.facets` (`{ field, label?, icon? }`). Chaque valeur passe par
 * `<ClickableFacet>` : cliquable si un dropdownFilter indexe `field`, sinon
 * texte simple. Aucun code par site — la même primitive que les previews
 * sur-mesure (l'axe « bespoke » reste dispo via un `preview.type` dédié).
 */
const PreviewFacets: React.FC<PreviewProps> = ({ item, preview, onClose }) => {
  const t = useT("modules/search");
  const data = useItem(item);
  const facets = preview?.facets ?? [];
  const serverData = (item?.serverData ?? {}) as Record<string, unknown>;

  const address = data.address;
  const displayAddress =
    [address?.streetAddress, address?.postalCode, address?.addressLocality]
      .filter(Boolean)
      .join(", ") || t("Adresse non disponible");

  const rows = facets
    .map((facet) => ({
      facet,
      tokens: toFacetTokens(resolveServerDataPath(serverData, facet.field)),
    }))
    .filter((r) => r.tokens.length > 0);

  return (
    <Card className="h-[calc(100vh-130px)] overflow-y-auto bg-background text-foreground rounded-md shadow-md">
      <CardHeader className="p-0">
        <AspectRatio ratio={16 / 9} className="w-full overflow-hidden rounded-t-md">
          <LazyImage
            src={data.profilImageUrl || "/images/defaultImage.png"}
            alt={data.name}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/images/defaultImage.png";
            }}
            className="object-cover w-full h-full"
          />
        </AspectRatio>
      </CardHeader>

      <Separator />

      <CardContent className="px-4 space-y-6">
        <div className="text-center space-y-1">
          <CardTitle className="text-2xl">{data.name}</CardTitle>
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            <MapPin className="mr-1 h-5 w-5 text-accent" />
            <span>{displayAddress}</span>
          </div>
        </div>

        {rows.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="text-lg font-semibold mb-2">{t("Caractéristiques")}</h3>
              <div className="space-y-4">
                {rows.map(({ facet, tokens }) => (
                  <div key={facet.field} className="flex items-start">
                    <DynamicIcon
                      name={(facet.icon ?? "tag") as IconName}
                      className="h-5 w-5 text-accent mt-1 shrink-0"
                    />
                    <div className="ml-3">
                      <p className="text-sm font-medium">
                        {facet.label ? t(facet.label) : facet.field}
                      </p>
                      <p className="text-sm">
                        {tokens.map((token, index) => (
                          <span key={`${token}-${index}`}>
                            {index > 0 && ", "}
                            <ClickableFacet
                              field={facet.field}
                              token={token}
                              onClose={onClose}
                              className="cursor-pointer font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary hover:text-primary/80"
                            />
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PreviewFacets;
