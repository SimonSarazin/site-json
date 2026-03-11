import { X, Pencil, User, Building2, Calendar, Briefcase, MapPin, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
 * Label traduit par type d'élément
 */
function getTypeLabel(type: FinderElementType): string {
  const labels: Record<FinderElementType, string> = {
    organizations: "Organisation",
    citoyens: "Citoyen",
    events: "Événement",
    projects: "Projet",
    news: "Actualité",
    cities: "Ville",
    things: "Objet",
    poi: "Point d'intérêt",
    classified: "Annonce",
    products: "Produit",
    services: "Service",
    surveys: "Enquête",
    bookmarks: "Favori",
    proposals: "Proposition",
    rooms: "Salle",
    actions: "Action",
    networks: "Réseau",
    urls: "Lien",
    circuits: "Circuit",
    risks: "Risque",
    badges: "Badge",
  };
  return labels[type] || type;
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
  const ElementIcon = elementIconMap[element.type] || Building2;
  const typeLabel = getTypeLabel(element.type);
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
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect?.(element)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
        </div>
      )}

      {/* Image ou icône */}
      <div className="shrink-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={element.name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <ElementIcon className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{element.name}</span>
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(element);
              }}
              className="text-red-500 hover:text-red-600 flex items-center gap-1 text-xs"
            >
              <Pencil className="w-3 h-3" />
              <span>Modifier</span>
            </button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{typeLabel}</div>
        {address && (
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-orange-500" />
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
          className="shrink-0 p-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
          aria-label="Supprimer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
