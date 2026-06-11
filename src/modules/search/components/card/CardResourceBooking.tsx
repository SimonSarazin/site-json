import { SearchCardProps } from "../../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { cn } from '@/lib/utils';
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { getEntityIconName } from "@/lib/entityIcons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import useItem from "../../hooks/useItem";
import { Calendar } from "lucide-react";

export default function CardResourceBooking({
  item,
  onClick
}: SearchCardProps) {
  const data = useItem(item);

  const {
    name,
    price,
    proprietaire,
    description,
    tags
  } = data
    const serverData = item?.serverData;
    const entityType = item?.getEntityType?.() || "";
    const avatarIcon = getEntityIconName(entityType);
    const location = getLocation(item);
    const status = serverData?.status || "Disponible";
  
  return ( 
    <article className="bg-[#0A1E3D] rounded-2xl overflow-hidden border border-[#1A3A5C] hover:border-[#2A4A6C] transition-all duration-300">
      {/* Header avec icône et badge statut */}
      <div className="p-6 pb-4 flex items-start justify-between">
        <div className="w-14 h-14 rounded-xl bg-[#1A3A5C]/50 border border-[#2A4A6C] flex items-center justify-center">
          <DynamicIcon 
            name={avatarIcon as IconName} 
            className="w-7 h-7 text-cyan-400" 
          />
        </div>
        <Badge 
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium border-0",
            status === "Disponible" && "bg-cyan-500/20 text-cyan-400",
            status === "Réservé" && "bg-blue-500/20 text-blue-400"
          )}
        >
          {String(status)}
        </Badge>
      </div>

      <div className="px-6 pb-3">
        <h3 className="text-xl font-bold text-white leading-tight">
          {name}
        </h3>
      </div>

      {/* Badge catégorie */}
      {tags && tags.length > 0 && (
        <div className="px-6 pb-4 flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <Badge 
              key={index}
              variant="outline" 
              className="rounded-full border-cyan-400/30 bg-cyan-500/10 text-cyan-300 text-xs font-medium px-3 py-1"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Description */}
      {description && (
        <div className="px-6 pb-5">
          <p className="text-[#A0B4CC] text-sm leading-relaxed">
            {description}
          </p>
        </div>
      )}

      {/* Informations en 2 colonnes */}
      <div className="px-6 pb-5 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[#708090]">Prix d'usage:</span>
          <span className="text-white font-semibold">{String(price || "N/A")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#708090]">Localisation:</span>
          <span className="text-white font-semibold">{location || "N/A"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#708090]">Propriétaire:</span>
          <span className="text-white font-semibold">{String(proprietaire || "N/A")}</span>
        </div>
      </div>

      {/* Statut de disponibilité avec icône calendrier */}
      <div className="px-6 pb-5 flex items-center gap-2 text-[#708090] text-sm">
        <Calendar className="w-4 h-4" />
        <span>Disponible</span>
      </div>

      {/* Bouton Réserver */}
      <div className="px-6 pb-6">
        <Button 
          onClick={onClick}
          className="w-full bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-[#0A1E3D] font-semibold rounded-xl h-12 text-base shadow-lg shadow-cyan-500/20 transition-all duration-300"
        >
          Réserver
        </Button>
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