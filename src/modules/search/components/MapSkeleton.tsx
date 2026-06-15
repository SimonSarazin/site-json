// Squelette de la vue carte — affiché dès le clic sur « Carte » (avant la
// 1ʳᵉ page ET pendant le chargement du chunk Leaflet). Il occupe EXACTEMENT
// l'espace que prendra la carte (useMapContainerClass : absolute inset-0 en
// page plein écran sans footer, min-h-screen en section / avec footer) —
// sans dimension propre, l'instant entre le clic et la 1ʳᵉ page serait un
// blanc total (le conteneur de la vue carte n'a aucune hauteur tant que
// SearchMap n'est pas monté).
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMapContainerClass } from "../hooks/useMapContainerClass";

export default function MapSkeleton({ label }: { label: string }) {
  const containerClass = useMapContainerClass("w-full");
  return (
    <div className={containerClass}>
      <Skeleton className="absolute inset-0 rounded" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
