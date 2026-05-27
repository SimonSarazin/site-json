import { SearchCardProps } from "../../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { cn } from '@/lib/utils';
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { getEntityIconName } from "@/lib/entityIcons";
import { Badge } from "@/components/ui/badge";
import useItem from "../../hooks/useItem";
import { Calendar, MapPin, Star } from "lucide-react";
import { useState } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { Button } from "@/components/ui/button";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";

export default function CardEventRezoLaMer({
  item,
  onClick
}: SearchCardProps) {
  const data = useItem(item);
  const { entity } = useCocolight();

  const {
    name,
    eventDate,
    type,
    organizerName,
    isStarred
  } = data
    const serverData = item?.serverData;
    const entityType = item?.getEntityType?.() || "";
    const avatarIcon = getEntityIconName(entityType);
    const image = serverData?.profilImageUrl;
    const location = getLocation(item);

  const [localIsStarred, setLocalIsStarred] = useState(isStarred);

  const { mutate: toggleStar, isPending: isUpdating } = useMutationWithToast<boolean, boolean>({
    namespace: "modules/search",
    successKey: "toast.card.starSuccess",
    errorKey: "toast.card.starError",
    mutationFn: async (newStarredValue) => {
      if (!item?.id) throw new Error("Entité ou item manquant");
      await item.updateField("isStarred", newStarredValue);
      if ("reload" in item && typeof item.reload === "function") {
        await item.reload();
      }
      return newStarredValue;
    },
    onSuccessCallback: (newStarredValue) => {
      setLocalIsStarred(newStarredValue);
    },
  });

  const handleToggleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!entity || !item?.id || isUpdating || localIsStarred === undefined) return;
    toggleStar(!localIsStarred);
  };

  // Cacher la carte si isStarred est false
  if (localIsStarred === false) {
    return null;
  }
  
  return (
    <article
      onClick={onClick}
      className="group bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
    >
      <div className="relative aspect-16/10 overflow-hidden ">
        {image ? (
          <img
            src={image}
            alt={name || ""}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-secondary/30 flex items-center justify-center">
            <DynamicIcon name={avatarIcon as IconName} className="w-16 h-16 text-muted-foreground/50" />
          </div>
        )}
        <Badge
          className={cn(
            "absolute top-4 left-4"
          )}
        >
          {type}
        </Badge>
        
        {localIsStarred !== undefined && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleStar}
            disabled={isUpdating}
            className={cn(
              "absolute top-4 right-4 bg-white/90 hover:bg-white transition-all",
              isUpdating && "opacity-50 cursor-not-allowed"
            )}
            aria-label={localIsStarred ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <Star 
              className={cn(
                "w-5 h-5 transition-all",
                localIsStarred ? "fill-yellow-400 text-yellow-400" : "text-gray-600"
              )} 
            />
          </Button>
        )}
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-foreground mb-2">{name}</h3>

        {eventDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Calendar className="w-4 h-4" />
            <span>{eventDate}</span>
          </div>
        )}

        {location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <MapPin className="w-4 h-4" />  
            <span>{location}</span>
          </div>
        )} 
        <p className="text-muted-foreground leading-relaxed">
          {organizerName}
        </p> 
      </div>
    </article>
  );
}

function getLocation(item: SearchEntity): string | null {
  const serverData = item?.serverData;

  if (serverData?.address?.addressLocality) {
    return serverData.address.addressLocality;
  }

  return null;
}