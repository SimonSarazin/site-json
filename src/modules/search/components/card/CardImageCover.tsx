import { SearchCardProps } from "../../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { cn } from "@/lib/utils";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { getEntityIconName, getEntityColorClasses } from "@/lib/entityIcons";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

export default function CardImageCover({
  item,
  onClick,
}: SearchCardProps) {
  
  const serverData = item?.serverData;
  const entityType = item?.getEntityType?.() || "";

  // Extraction des données
  const image = serverData?.profilImageUrl;
  const title = serverData?.name;
  const location = getLocation(item);
  const avatarIcon = getEntityIconName(entityType);
  const avatarColorClasses = getEntityColorClasses(entityType);
  const badges = getBadges(item);

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
      {badges && badges.length > 0 && (
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          {badges.map((badge, idx) => (
            <button
              key={idx}
              className="w-8 h-8 bg-background rounded-full shadow flex items-center justify-center hover:bg-muted transition"
              aria-label={badge.label}
              onClick={(e) => e.stopPropagation()}
            >
              <DynamicIcon name={badge.icon as IconName} className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {/* Card info en bas */}
      <div className="absolute bottom-3 left-3 right-3 bg-card rounded-xl p-3 px-4 mb-2 flex items-start gap-3 shadow-lg border border-border">
        {/* Avatar Icon */}
        {avatarIcon && (
          <div className={cn(
            "w-8 h-8 flex items-center justify-center rounded-full shadow-sm shrink-0",
            avatarColorClasses
          )}>
            <DynamicIcon name={avatarIcon as IconName} className="w-4 h-4" />
          </div>
        )}

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

// Mapping des mots-clés vers des icônes (recherche partielle case-insensitive)
const TAG_ICON_KEYWORDS: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ['coworking', 'bureaux partagés'], icon: 'laptop' },
  { keywords: ['fablab', 'makerspace', 'hackerspace'], icon: 'factory' },
  { keywords: ['café', 'coffee'], icon: 'coffee' },
  { keywords: ['restaurant', 'food'], icon: 'utensils-crossed' },
  { keywords: ['réunion', 'meeting', 'salle'], icon: 'users' },
];

function findTagIcon(tag: string): string | null {
  const tagLower = tag.toLowerCase();
  for (const { keywords, icon } of TAG_ICON_KEYWORDS) {
    if (keywords.some(keyword => tagLower.includes(keyword))) {
      return icon;
    }
  }
  return null;
}

function getBadges(item: SearchEntity): Array<{ icon: string; label?: string }> {
  const serverData = item?.serverData;

  if (serverData?.badges && Array.isArray(serverData.badges)) {
    return serverData.badges;
  }

  // Générer des badges automatiques selon les tags ou catégories
  const badges: Array<{ icon: string; label?: string }> = [];

  if (serverData?.tags && Array.isArray(serverData.tags)) {
    // Dédoublonner les tags (case-insensitive)
    const seenTags = new Set<string>();
    const uniqueTags = serverData.tags.filter((tag: string) => {
      const tagLower = tag.toLowerCase();
      if (seenTags.has(tagLower)) return false;
      seenTags.add(tagLower);
      return true;
    });

    // Mapper les tags vers des icônes (max 2)
    uniqueTags.slice(0, 2).forEach((tag: string) => {
      const icon = findTagIcon(tag) || 'tag';
      badges.push({ icon, label: tag });
    });
  }

  return badges;
}