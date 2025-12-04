import { SearchCardProps } from "../../schema";
import { cn } from "@/lib/utils";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import useItem from "../../hooks/useItem";

// Map des couleurs pour l'avatar
const AVATAR_COLOR_CLASSES: Record<string, string> = {
  orange: 'bg-orange-50 text-orange-500',
  blue: 'bg-blue-50 text-blue-500',
  green: 'bg-green-50 text-green-500',
  purple: 'bg-purple-50 text-purple-500',
  red: 'bg-red-50 text-red-500',
  yellow: 'bg-yellow-50 text-yellow-500',
  teal: 'bg-teal-50 text-teal-500',
};

// Map des tags vers des icônes
const TAG_ICON_MAP: Record<string, string> = {
  'workshop': 'wrench',
  'conference': 'presentation',
  'hackathon': 'zap',
  'meetup': 'users',
  'formation': 'graduation-cap',
};

function getAvatarColorClasses(color?: string): string {
  return AVATAR_COLOR_CLASSES[color || 'purple'] || AVATAR_COLOR_CLASSES.purple;
}

function getAvatarIcon(tags: string[]): string {
  for (const tag of tags) {
    const icon = TAG_ICON_MAP[tag.toLowerCase()];
    if (icon) return icon;
  }
  return "calendar";
}

export default function CardEvent({
  item,
  onClick,
}: SearchCardProps) {
  const data = useItem(item);

  const {
    name,
    image,
    eventDate,
    organizerName,
    address,
    tags = [],
  } = data;

  const location = address?.addressLocality || null;
  const avatarIcon = getAvatarIcon(tags);

  return (
    <div
      onClick={onClick}
      className="relative border border-border w-full h-72 rounded-xl overflow-hidden shadow-lg group cursor-pointer"
    >
      {/* Image de fond */}
      {image && (
        <img
          src={image}
          alt={name}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
        />
      )}

      {/* Date et titre de l'événement en haut */}
      <div className="
        absolute top-0 w-full px-2 pt-1 pb-2 z-10
        backdrop-blur-xl
        bg-black/30 dark:bg-white/10
        border-b border-white/40 dark:border-white/20
        flex flex-col items-center gap-2
      ">
        {eventDate && (
          <div className="bg-white w-auto px-3 py-1 rounded-md text-xs font-semibold shadow text-gray-900 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {eventDate}
          </div>
        )}
        {name && (
          <div className="text-foreground font-semibold text-sm drop-shadow-lg">
            {name}
          </div>
        )}
      </div>

      {/* Card info en bas */}
      <div
        className="
          absolute bottom-3 left-3 right-3
          bg-dark/30 dark:bg-white/10
          backdrop-blur-lg
          rounded-xl p-4
          flex items-start gap-3
          shadow-lg
          translate-y-2 group-hover:translate-y-0
          transition-all
        "
      >
        {/* Avatar Icon */}
        <div className={cn(
          "w-10 h-10 flex items-center justify-center rounded-full shadow-sm shrink-0",
          getAvatarColorClasses()
        )}>
          <DynamicIcon name={avatarIcon as IconName} className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-sm mb-1 truncate">
            {organizerName || name}
          </h3>
          {location && (
            <p className="text-foreground text-xs truncate">
              {location}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
