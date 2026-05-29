import { useEffect, useMemo, useState } from "react";
import { useFiltersByPathQuery, type FiltersByPathOptions } from "../hooks/useFiltersByPath";
import { useT } from "@/hooks/useT";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

/** Source de l'appel coformFilterByPath (une entrée `filtersByPath`). */
export interface ThematicSource {
  id?: string;
  label: { [locale: string]: string };
  thematicPath: string;
  finderPath?: string;
  notSourceKey?: boolean;
}

interface ThematicValue {
  name: string;
  image: string;
  orgaNameArray: string[];
}

interface ThematicCardsProps {
  /** Clé de cache React Query (id de la section). */
  queryId: string;
  /** Config de l'appel coformFilterByPath. */
  source: ThematicSource;
  /** Clic sur une card → renvoie le `name` de la thématique. */
  onSelect: (name: string) => void;
  /** Remonte le nombre de thématiques au parent (pour le compteur du header). */
  onCountChange?: (count: number) => void;
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Une card thématique. Image via OptimizedImage (optimizer `/img` en prod) ;
 *  fallback initiale si pas d'URL ou si le chargement échoue. */
function ThematicCard({
  item,
  onSelect,
}: {
  item: ThematicValue;
  onSelect: (name: string) => void;
}) {
  const t = useT("modules/search");
  const [imgError, setImgError] = useState(false);
  const count = item.orgaNameArray?.length ?? 0;
  const showImage = !!item.image && !imgError;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item.name)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(item.name);
        }
      }}
      className="group hover:shadow-lg hover:border-primary transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <CardContent className="flex flex-col items-center text-center gap-3 p-4">
        <div className="w-16 h-16 rounded-lg bg-primary/10 overflow-hidden flex items-center justify-center">
          {showImage ? (
            <OptimizedImage
              src={item.image}
              alt={item.name}
              width={64}
              height={64}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-xl font-bold text-primary">{initialsOf(item.name)}</span>
          )}
        </div>

        <span className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {item.name}
        </span>

        {count > 0 && (
          <Badge variant="secondary" className="text-xs">
            {count} {count > 1 ? t("lieux") : t("lieu")}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Grille de cards (nom + image) des valeurs distinctes d'un filtre thématique
 * CoForm (`coformFilterByPath`). Pendant de `FranceRegionsMap` pour les réseaux
 * thématiques : au clic, on remonte le `name` (le parent navigue vers la page
 * cible avec le filtre en query — cf. `thematicsTarget`).
 */
export default function ThematicCards({ queryId, source, onSelect, onCountChange }: ThematicCardsProps) {
  const t = useT("modules/search");

  // useFiltersByPathQuery attend un record `{ key: options }` ; une seule entrée.
  const options: FiltersByPathOptions = useMemo(
    () => ({ thematic: source }),
    [source],
  );
  const { data, isLoading } = useFiltersByPathQuery(queryId, options);

  // Valeurs triées par nom (locale FR par défaut, insensible à la casse).
  const items = useMemo<ThematicValue[]>(() => {
    const values = data?.thematic?.values ?? {};
    return Object.values(values)
      .filter((v) => v.name?.trim())
      .sort((a, b) =>
        a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
      );
  }, [data]);

  // Remonte le nombre de thématiques au parent (compteur du header).
  useEffect(() => {
    onCountChange?.(items.length);
  }, [items.length, onCountChange]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center text-secondary-foreground py-8">
        {t("Aucun résultat trouvé.")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {items.map((item) => (
        <ThematicCard key={item.name} item={item} onSelect={onSelect} />
      ))}
    </div>
  );
}
