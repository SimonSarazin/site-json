import { SearchCardProps, SearchEntity } from "../../schema";
import { cn } from "@/lib/utils";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

export default function CardEvent({
  item,
  onClick,
}: SearchCardProps) {
  
  const serverData = item?.serverData;
  
  // Extraction des données
  const image = serverData?.image || serverData?.profilImageUrl;
  const title = serverData?.name || serverData?.title || "";
  const eventTitle = getEventTitle(item);
  const date = getEventDate(item);
  const organizerName = getOrganizerName(item);
  const location = getLocation(item);
  const avatarIcon = getAvatarIcon(item);
  const avatarColor = getAvatarColor(item);
  
  const getAvatarColorClasses = (color?: string) => {
    const colorMap: Record<string, string> = {
      orange: 'bg-orange-50 text-orange-500',
      blue: 'bg-blue-50 text-blue-500',
      green: 'bg-green-50 text-green-500',
      purple: 'bg-purple-50 text-purple-500',
      red: 'bg-red-50 text-red-500',
      yellow: 'bg-yellow-50 text-yellow-500',
      teal: 'bg-teal-50 text-teal-500',
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
          alt={eventTitle || title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      )}

      {/* Date et titre de l'événement en haut */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
        {date && (
          <div className="bg-white w-auto px-3 py-1 rounded-md text-xs font-semibold shadow text-gray-900 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {date}
          </div>
        )}
        {eventTitle && (
          <div className="text-white font-semibold text-sm drop-shadow-lg">
            {eventTitle}
          </div>
        )}
      </div>

      {/* Card info en bas */}
      <div className="absolute bottom-3 left-3 right-3 bg-white bg-opacity-90 rounded-xl p-4 flex items-start gap-3 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
        {/* Avatar Icon */}
        {avatarIcon && (
          <div className={cn(
            "w-10 h-10 flex items-center justify-center rounded-full shadow-sm flex-shrink-0",
            getAvatarColorClasses(avatarColor)
          )}>
            <DynamicIcon name={avatarIcon as IconName} className="w-4 h-4" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">
            {organizerName || title}
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
function getEventTitle(item: SearchEntity): string | null {
  const serverData = item?.serverData;
  
  if (serverData?.eventTitle) return serverData.eventTitle;
  if (serverData?.name) return serverData.name;
  if (serverData?.title) return serverData.title;
  
  return null;
}

function getEventDate(item: SearchEntity): string | null {
  const serverData = item?.serverData;
  
  // Si on a déjà une date formatée, on la retourne directement
  if (serverData?.date && typeof serverData.date === 'string') {
    return serverData.date;
  }
  
  // Format de date depuis startDate
  if (serverData?.startDate) {
    try {
      // Convertir en string d'abord pour éviter les problèmes de Proxy
      const dateStr = String(serverData.startDate);
      const date = new Date(dateStr);
      
      // Vérifier que la date est valide
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('fr-FR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        }).replace(/\//g, '.');
      }
    } catch (error) {
      console.warn('Erreur lors du formatage de la date:', error);
    }
  }
  
  return null;
}

function getOrganizerName(item: SearchEntity): string | null {
  const serverData = item?.serverData;
  
  if (serverData?.organizerName) return serverData.organizerName;
  if (serverData?.organizer?.name) return serverData.organizer.name;
  
  return null;
}

function getLocation(item: SearchEntity): string | null {
  const serverData = item?.serverData;
  
  // Essayer différentes sources pour la localisation
  if (serverData?.address?.addressLocality) {
    const locality = serverData.address.addressLocality;
    const region = serverData.address?.addressRegion;
    return region ? `${locality}, ${region}` : locality;
  }
  
  if (serverData?.location) {
    return serverData.location;
  }
  
  return null;
}

function getAvatarIcon(item: SearchEntity): string | null {
  const serverData = item?.serverData;

  if (serverData?.avatarIcon) return serverData.avatarIcon;

  // Icône par défaut pour les événements
  if (serverData?.tags && Array.isArray(serverData.tags)) {
    // Mapper certains tags à des icônes (kebab-case pour lucide-react/dynamic)
    const tagIconMap: Record<string, string> = {
      'workshop': 'wrench',
      'conference': 'presentation',
      'hackathon': 'zap',
      'meetup': 'users',
      'formation': 'graduation-cap',
    };

    for (const tag of serverData.tags) {
      const icon = tagIconMap[tag.toLowerCase()];
      if (icon) return icon;
    }
  }

  return "calendar"; // Icône par défaut (kebab-case)
}

function getAvatarColor(item: SearchEntity): string {
  const serverData = item?.serverData;
  
  if (serverData?.avatarColor) return serverData.avatarColor;
  
  return "purple"; // Couleur par défaut pour les événements
}