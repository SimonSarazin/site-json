// Squelette PLEINE HAUTEUR de la vue carte — affiché dès le clic sur
// « Carte » (avant la 1ʳᵉ page ET pendant le chargement du chunk Leaflet).
// min-h-screen : le conteneur de la vue carte n'a AUCUNE hauteur propre tant
// que SearchMap (qui porte min-h-screen) n'est pas monté — sans ce squelette
// dimensionné, l'instant entre le clic et la 1ʳᵉ page est un blanc total.
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function MapSkeleton({ label }: { label: string }) {
  return (
    <div className="relative min-h-screen h-full w-full">
      <Skeleton className="absolute inset-0 rounded" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
