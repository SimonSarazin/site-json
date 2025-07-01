import { MapPin, Share2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";

import LazyImage from "@/components/layout/LazyImage";
import { useT } from "@/hooks/useT";

interface SearchCardProps {
  name: string;
  type?: string;
  address?: string;
  description?: string;
  tags?: string[];
  image?: string;
  onClick?: () => void;
}

export default function SearchCard({
  name,
  type,
  address,
  description,
  tags = [],
  image,
  onClick,
}: SearchCardProps) {
  const t = useT("modules/search");
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className="relative aspect-[4/3] rounded-lg shadow overflow-hidden border group cursor-pointer"
      onClick={() => {
        onClick?.();
        setExpanded((e) => !e);
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Image de fond */}
      <CardContent className="p-0 bg-muted">
        {image ? (
          <LazyImage
            src={image}
            onError={(e) => (e.target.src = "/images/defaultImage.png")}
            alt={name}
            className="object-contain w-full h-full"
            placeholder={
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                {t("Chargement…")}
              </div>
            }
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            {t("Aucune image")}
          </div>
        )}
      </CardContent>

      {/* Infos de base */}
      <CardHeader className="absolute bottom-0 left-0 w-full bg-primary/90 p-3">
        <CardTitle className="text-base truncate text-primary-foreground">{name}</CardTitle>
        {address && (
          <div className="flex items-center text-sm text-secondary-foreground gap-1">
            <MapPin className="h-4 w-4 text-primary-foreground" />
            <span className="truncate">{address}</span>
          </div>
        )}
      </CardHeader>

      {/* Overlay au survol / clic */}
      <div
        className={`absolute inset-0 bg-primary/90 p-4 flex flex-col justify-between transition-all duration-300 ${
          expanded
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="overflow-y-auto pr-1 h-full space-y-2">
          <div>
            <h3 className="font-semibold text-lg leading-tight text-primary-foreground">{name}</h3>
            {type && <p className="text-sm text-secondary-foreground">{type}</p>}
            {address && (
              <div className="flex items-center text-sm text-secondary-foreground gap-1 mt-1">
                <MapPin className="h-4 w-4 text-primary-foreground" />
                <span>{address}</span>
              </div>
            )}
            {description && (
              <p className="text-sm text-primary-foreground mt-2">{description}</p>
            )}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {tags.slice(0, 5).map((tag, i) => (
                <Badge key={i} variant="secondary" className="truncate">
                  #{tag}
                </Badge>
              ))}
              {tags.length > 5 && (
                <Badge variant="outline">+{tags.length - 5}</Badge>
              )}
            </div>
          )}
        </div>

        {/* Partager */}
        <CardFooter className="pt-2">
          <Button variant="link" size="sm" className="flex items-center gap-1 text-primary-foreground">
            <Share2 className="h-4 w-4" />
            {t("Partager")}
          </Button>
        </CardFooter>
      </div>
    </Card>
  );
}