import { SearchCardProps } from "../../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { cn } from "@/lib/utils";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

export default function CardTiersLieux({
  item,
  onClick,
}: SearchCardProps) {
  
  const serverData = item?.serverData;

  // Extraction des données
  const image = serverData?.profilImageUrl;
  const title = serverData?.name;
  const location = getLocation(item);
  const avatarIcon = getAvatarIcon(item);
  const avatarColor = getAvatarColor(item);
  const badges = getBadges(item);
  
  const getAvatarColorClasses = (color?: string) => {
    const colorMap: Record<string, string> = {
      orange: 'bg-orange-50 text-orange-500',
      blue: 'bg-blue-50 text-blue-500',
      green: 'bg-green-50 text-green-500',
      purple: 'bg-purple-50 text-purple-500',
      red: 'bg-red-50 text-red-500',
      yellow: 'bg-yellow-50 text-yellow-500',
      teal: 'bg-primary/10 text-primary',
    };
    return colorMap[color || 'teal'] || colorMap.teal;
  };

  return (
    <div 
      onClick={onClick}
      className="relative w-full h-96 rounded-xl overflow-hidden shadow-lg group cursor-pointer"
    >
      {/* Image de fond */}
      {image && (
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      )}

      {/* Badges en haut à droite */}
      {badges && badges.length > 0 && (
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          {badges.map((badge, idx) => (
            <button
              key={idx}
              className="w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-100 transition"
              aria-label={badge.label}
              onClick={(e) => e.stopPropagation()}
            >
              <DynamicIcon name={badge.icon as IconName} className="w-4 h-4 text-gray-700" />
            </button>
          ))}
        </div>
      )}

      {/* Card info en bas */}
      <div className="absolute bottom-3 left-3 right-3 bg-white rounded-xl p-3 px-4 mb-2 flex items-start gap-3 shadow-lg">
        {/* Avatar Icon */}
        {avatarIcon && (
          <div className={cn(
            "w-8 h-8 flex items-center justify-center rounded-full shadow-sm flex-shrink-0",
            getAvatarColorClasses(avatarColor)
          )}>
            <DynamicIcon name={avatarIcon as IconName} className="w-4 h-4" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">
            {title}
          </h3>
          {location && (
            <p className="text-gray-500 text-xs truncate">
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

function getAvatarIcon(item: SearchEntity): string | null {
  // Icône par défaut selon le type (kebab-case pour lucide-react/dynamic)
  const type = item?.getEntityType?.();
  if (type === "organizations") return "building-2";
  if (type === "projects") return "lightbulb";
  if (type === "events") return "calendar";
  if (type === "poi") return "map-pin";

  return "lightbulb"; // Icône par défaut (kebab-case)
}

function getAvatarColor(item: SearchEntity): string {
  // Couleur par défaut selon le type
  const type = item?.getEntityType?.();
  if (type === "organizations") return "blue";
  if (type === "projects") return "orange";
  if (type === "events") return "purple";
  if (type === "poi") return "green";

  return "teal";
}

function getBadges(item: SearchEntity): Array<{ icon: string; label?: string }> {
  const serverData = item?.serverData;

  if (serverData?.badges && Array.isArray(serverData.badges)) {
    return serverData.badges;
  }

  // Générer des badges automatiques selon les tags ou catégories
  const badges: Array<{ icon: string; label?: string }> = [];

  if (serverData?.tags && Array.isArray(serverData.tags)) {
    // Mapper certains tags à des icônes (kebab-case pour lucide-react/dynamic)
    const tagIconMap: Record<string, string> = {
      'coworking': 'laptop',
      'fablab': 'factory',
      'makerspace': 'wrench',
      'café': 'coffee',
      'restaurant': 'utensils-crossed',
    };

    serverData.tags.slice(0, 2).forEach((tag: string) => {
      const icon = tagIconMap[tag.toLowerCase()] || 'tag';
      badges.push({ icon, label: tag });
    });
  }

  return badges;
}