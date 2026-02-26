import React from "react";
import {
  MapPin,
} from "lucide-react";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import LazyImage from "@/components/layout/LazyImage";
import { useT } from "@/hooks/useT";
import { useSearchPropsOptional } from "@/modules/search/hooks/useSearchProps";
import { DynamicIcon, IconName } from "lucide-react/dynamic";
import useItem from "@/modules/search/hooks/useItem";
import { PreviewProps } from "@/modules/search/schema";
import type { LocalizedString } from "@/types/locale-schema";

/* -----------------------------------------------------------------------
 * Component
 * ---------------------------------------------------------------------*/
const PreviewDefault: React.FC<PreviewProps> = ({ item }) => {
  const t = useT("modules/search");
  const searchContext = useSearchPropsOptional();
  const props = searchContext?.props;
  const data = useItem(item);

  const {
    name,
    profilImageUrl,
    description,
    address,
    tags = [],
    type,
  } = data;

  // ------------------------------------------------------ Address
  const displayAddress = address
    ? `${address.streetAddress ?? ""}${address.streetAddress ? ", " : ""}${
        address.postalCode ?? ""
      }${address.postalCode ? ", " : ""}${address.addressLocality ?? ""}`.replace(
        /,\s*$/,
        ""
      ) || t("Adresse non disponible")
    : t("Adresse non disponible");

  // ------------------------------------------------------ Characteristics (dynamic)
  type Characteristic = {
    key: string;
    label: string;
    value: string;
    icon: string;
  };

  const characteristics: Characteristic[] = React.useMemo(() => {
    if (!props?.filters) return [];

    return Object.entries(props.filters)
      .filter(([, filter]) => filter.previewVisible !== false)
      .map(([key, filter]) => {
        const icon = filter.previewIcon ? filter.previewIcon : "tag";
        const label = t(filter.name as LocalizedString | string);

        let value: string | undefined;

        if (filter.type === "tags") {
          // Trouve un tag du jeu de données qui correspond à ce filtre
          const found = tags.find((tag) =>
            Object.keys(filter.list).some(
              (candidate) => candidate.toLowerCase() === tag.toLowerCase()
            )
          );
          if (found) {
            const record = (filter.list as Record<string, LocalizedString | string>)[found];
            value = typeof record === "object" ? t(record) : t(record ?? found);
          }
        } else if (filter.type === "type") {
          if (type) {
            const record = (filter.list as Record<string, LocalizedString | string>)[type];
            value = typeof record === "object" ? t(record) : t(record ?? type);
          }
        }

        return {
          key,
          label,
          value: value ?? t("Non précisé"),
          icon,
        } as Characteristic;
      });
  }, [props?.filters, tags, type, t]);

  // ------------------------------------------------------ Tags (affichage séparé)
  const displayedTags = React.useMemo(() => {
    return Array.from(new Set(tags)).slice(0, 20);
  }, [tags]);

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
            <MapPin className="mr-1 h-5 w-5 text-accent" />
            <span>{displayAddress}</span>
          </div>
        </div>

        <Separator />

        {/* Short description */}
        {description && (
          <div>
            <h3 className="text-lg font-semibold mb-1">{t("Description")}</h3>
            <p className="whitespace-pre-line">{description}</p>
          </div>
        )}

        {characteristics.length > 0 && (
          <>
            <Separator />
            {/* Characteristics (dynamic) */}
            <div>
              <h3 className="text-lg font-semibold mb-2">{t("Caractéristiques")}</h3>
              <div className="space-y-4">
                {characteristics.map(({ key, label, value, icon }) => (
                  <div key={key} className="flex items-start">
                    {icon && (
                      <DynamicIcon name={icon as IconName} className="h-5 w-5 text-accent mt-1" />
                    )}
                    <div className="ml-3">
                      <p className="text-sm font-medium">{label}</p>
                      <p>{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

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

export default PreviewDefault;
