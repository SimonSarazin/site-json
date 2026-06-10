import { useMemo } from "react";
import { Monitor, Users, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { SearchCardProps } from "../../schema";
import type { Answer, FormId, SearchEntity } from "@communecter/cocolight-api-client";
import { cn } from "@/lib/utils";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { useT } from "@/hooks/useT";
import { getEntityIconName, getEntityColorClasses } from "@/lib/entityIcons";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import {
  buildTiersLieuxStats,
  extractTiersLieuxAnswers,
  tiersLieuxStatLabel,
  type TiersLieuxStatKind,
} from "../../helpers/tiersLieuxAnswers";

const STAT_ICONS: Record<TiersLieuxStatKind, LucideIcon> = {
  coworking: Monitor,
  meeting: Users,
  accommodation: UtensilsCrossed,
};

export default function CardTiersLieux({
  item,
  onClick,
}: SearchCardProps) {
  const t = useT("modules/search");
  const serverData = item?.serverData;
  const entityType = item?.getEntityType?.() || "";

  // Extraction des données
  const image = serverData?.profilImageUrl;
  const title = serverData?.name;
  const location = getLocation(item);
  const avatarIcon = getEntityIconName(entityType);
  const avatarColorClasses = getEntityColorClasses(entityType);
  const answers = item?.serverData?.answers as Record<FormId, Answer[]> | undefined;
  // Vue grille : la capacité seule suffit (`requirePrice: false`).
  const stats = useMemo(
    () => buildTiersLieuxStats(extractTiersLieuxAnswers(answers), { requirePrice: false }),
    [answers],
  );

  return (
    <div
      onClick={onClick}
      className="relative w-full h-96 rounded-xl overflow-hidden shadow-lg group cursor-pointer"
    >
      {/* Image de fond */}
      {image && (
        <OptimizedImage
          src={image}
          alt={title || ""}
          width={400}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      )}

      {/* Badges en haut à droite */}
      {stats.length > 0 && (
        <div className="absolute top-3 px-2 w-full flex items-center justify-end gap-2 z-10">
          {stats.map((stat) => {
            const Icon = STAT_ICONS[stat.kind];
            const { key, params } = tiersLieuxStatLabel(stat);
            const label = t(key, undefined, params);
            return (
              <div
                key={stat.kind}
                className="bg-background p-1 rounded-md shadow gap-1 flex items-center justify-center hover:bg-muted transition"
                aria-label={label}
              >
                <Icon className="w-3 h-3 text-primary" />
                <span className="text-xs text-primary">{label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Card info en bas */}
      <div className="absolute bottom-3 left-3 right-3 bg-card rounded-xl p-3 px-4 mb-2 flex items-start gap-3 shadow-lg border border-border">

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-sm mb-1 truncate">
            {title}
          </h3>
          {location && (
            <p className="text-muted-foreground text-xs truncate">
              {location}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Fonctions utilitaires pour extraire les données
function getLocation(item: SearchEntity): string | null {
  const serverData = item?.serverData;

  // Essayer différentes sources pour la localisation
  if (serverData?.address?.addressLocality) {
    return serverData.address.addressLocality;
  }

  return null;
}
