import React from "react";
import {
  MapPin,
  Briefcase,
  SlidersHorizontal,
  Expand,
} from "lucide-react";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import LazyImage from "../../../components/layout/LazyImage";
import { useT } from "@/hooks/useT";


/* -----------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------*/
interface Address {
  streetAddress?: string;
  postalCode?: string;
  addressLocality?: string;
}

export interface PreviewData {
  name: string;
  profilImageUrl?: string;
  shortDescription?: string;
  address?: Address;
  tags?: string[];
  type?: string;
}

export interface PreviewProps {
  data: PreviewData;
}

/* -----------------------------------------------------------------------
 * Component
 * ---------------------------------------------------------------------*/
const Preview: React.FC<PreviewProps> = ({ data }) => {
const t = useT("modules/search");  

  const {
    name,
    profilImageUrl,
    shortDescription,
    address,
    tags = [],
    type,
  } = data;

  // ------------------------------------------------------ Address
  const displayAddress = address
    ? `${address.streetAddress ?? ""}$
        {address.streetAddress ? ", " : ""}${address.postalCode ?? ""}$
        {address.postalCode ? ", " : ""}${address.addressLocality ?? ""}`.replace(/,\s*$/, "") ||
      t("Adresse non disponible")
    : t("Adresse non disponible");

  // ------------------------------------------------------ Tags
  const displayedTags = React.useMemo(() => {
    return Array.from(new Set(tags)).slice(0, 20);
  }, [tags]);

  const firstCoworkingTag = tags.find((tag) =>
    tag.toLowerCase().includes("coworking")
  );

  const surfaceTag = tags.find((tag) => /\d+\s?m²/i.test(tag));

  /* ------------------------------------------------------------------- */
  return (
    <Card className="h-[calc(100vh-130px)] overflow-y-auto bg-background text-foreground rounded-md shadow-md">
      {/* Image */}
      <CardHeader className="p-0">
        <AspectRatio ratio={16 / 9} className="w-full overflow-hidden rounded-t-md">
          <LazyImage
            src={profilImageUrl || "/images/defaultImage.png"}
            alt={name}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/images/defaultImage.png";
            }}
            className="object-cover w-full h-full"
          />
        </AspectRatio>
      </CardHeader>

      <Separator />

      <CardContent className="px-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <CardTitle className="text-2xl">{name}</CardTitle>
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            <MapPin className="mr-1 h-4 w-4 text-accent" />
            <span>{displayAddress}</span>
          </div>
        </div>

        <Separator />

        {/* Short description */}
        {shortDescription && (
          <div>
            <h3 className="text-lg font-semibold mb-1">{t("Description courte")}</h3>
            <p className="whitespace-pre-line">{shortDescription}</p>
          </div>
        )}

        <Separator />

        {/* Characteristics */}
        <div>
          <h3 className="text-lg font-semibold mb-2">{t("Caractéristiques")}</h3>
          <div className="space-y-4">
            {/* Typology */}
            <div className="flex items-start">
              <Briefcase className="h-5 w-5 text-accent mt-1" />
              <div className="ml-3">
                <p className="text-sm font-medium">{t("Typologie")}</p>
                <p>{firstCoworkingTag || t("Non précisé")}</p>
              </div>
            </div>
            {/* Management mode */}
            <div className="flex items-start">
              <SlidersHorizontal className="h-5 w-5 text-accent mt-1" />
              <div className="ml-3">
                <p className="text-sm font-medium">{t("Mode de gestion")}</p>
                <p>{type || t("Non précisé")}</p>
              </div>
            </div>
            {/* Size */}
            <div className="flex items-start">
              <Expand className="h-5 w-5 text-accent mt-1" />
              <div className="ml-3">
                <p className="text-sm font-medium">{t("Taille")}</p>
                <p>{surfaceTag || t("Non précisé")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tags */}
        {displayedTags.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="text-lg font-semibold mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {displayedTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-sm">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default Preview;
