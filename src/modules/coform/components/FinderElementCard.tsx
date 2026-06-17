import { X, Pencil, User, Building2, Calendar, Briefcase, MapPin, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { FinderElement, FinderElementType } from "../types";

interface FinderElementCardProps {
  element: FinderElement;
  /** Afficher le bouton de suppression */
  canRemove?: boolean;
  /** Afficher le bouton d'édition */
  canEdit?: boolean;
  /** Callback de suppression */
  onRemove?: (elementId: string) => void;
  /** Callback d'édition */
  onEdit?: (element: FinderElement) => void;
  /** Mode sélection (dans le modal) */
  selectionMode?: boolean;
  /** Élément sélectionné */
  isSelected?: boolean;
  /** Callback de sélection */
  onSelect?: (element: FinderElement) => void;
  /** URL de base pour les images */
  baseUrl?: string;
}

/**
 * Map des icônes par type d'élément
 */
const elementIconMap: Record<FinderElementType, LucideIcon> = {
  organizations: Building2,
  citoyens: User,
  events: Calendar,
  projects: Briefcase,
  news: Building2,
  cities: MapPin,
  things: Building2,
  poi: MapPin,
  classified: Building2,
  products: Building2,
  services: Building2,
  surveys: Building2,
  bookmarks: Building2,
  proposals: Building2,
  rooms: Building2,
  actions: Building2,
  networks: Building2,
  urls: Building2,
  circuits: Building2,
  risks: Building2,
  badges: Building2,
};

/**
 * Label traduit par type d'élément.
 * Toutes les clés vivent sous `coform.finder.types.<type>` dans le namespace `modules/coform`.
 */
function useTypeLabel(type: FinderElementType): string {
  const t = useT("modules/coform");
  const translated = t(`coform.finder.types.${type}`);
  // i18next retourne la clé brute si la traduction n'existe pas — fallback sur `type`.
  return translated === `coform.finder.types.${type}` ? type : translated;
}

/**
 * Formate une adresse en string lisible
 */
function formatAddress(address?: FinderElement["address"]): string | null {
  if (!address) return null;
  const parts: string[] = [];
  if (address.streetAddress) parts.push(address.streetAddress);
  if (address.postalCode) parts.push(address.postalCode);
  if (address.addressLocality) parts.push(address.addressLocality);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Carte d'un élément sélectionné ou trouvé par le Finder
 */
export function FinderElementCard({
  element,
  canRemove = true,
  canEdit = false,
  onRemove,
  onEdit,
  selectionMode = false,
  isSelected = false,
  onSelect,
  baseUrl = "",
}: FinderElementCardProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const ElementIcon = elementIconMap[element.type] || Building2;
  const typeLabel = useTypeLabel(element.type);
  const address = formatAddress(element.address);

  // Construire l'URL de l'image
  const imageUrl = element.img
    ? element.img.startsWith("http")
      ? element.img
      : `${baseUrl}${element.img}`
    : null;

  const handleClick = () => {
    if (selectionMode && onSelect) {
      onSelect(element);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-background",
        selectionMode && "cursor-pointer hover:bg-accent/50 transition-colors",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
      onClick={handleClick}
    >
      {/* Checkbox en mode sélection */}
      {selectionMode && (
        <div className="shrink-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect?.(element)}
            aria-label={`${isSelected ? "Désélectionner" : "Sélectionner"} ${element.name}`}
          />
        </div>
      )}

      {/* Avatar — rendu uniforme aligné sur la fiche élément : image pleine
          (résolue live) en `object-cover` sur fond `bg-card`. Radix bascule
          seul sur le fallback (icône du type) si l'image échoue ou est absente. */}
      <Avatar className="w-10 h-10 shrink-0 bg-card">
        {imageUrl && (
          <AvatarImage src={imageUrl} alt={element.name} className="object-cover" />
        )}
        <AvatarFallback className="bg-muted">
          <ElementIcon aria-hidden="true" className="w-5 h-5 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{element.name}</span>
          {canEdit && onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(element);
              }}
              className="h-auto py-0.5 px-1.5 gap-1 text-xs text-destructive hover:text-destructive/80"
            >
              <Pencil aria-hidden="true" className="w-3 h-3" />
              <span>{String(t("coform.finder.elementCard.edit"))}</span>
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{typeLabel}</div>
        {address && (
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-muted-foreground" />
            <span className="truncate">{address}</span>
          </div>
        )}
      </div>

      {/* Bouton de suppression */}
      {canRemove && onRemove && !selectionMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(element.id);
          }}
          className="shrink-0 p-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          aria-label={String(t("coform.finder.elementCard.removeAria"))}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
