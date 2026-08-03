
import { useClientModule } from "@/hooks/useClientModule";
import { useT } from "@/hooks/useT";
import { SearchMapWrapperProps } from "../schema";
import MapSkeleton from "./MapSkeleton";


export default function SearchMapWrapper({ results, card, preview, list, map, focusedItemId, onMarkerFocus, containerClass }: SearchMapWrapperProps) {
  const [mounted, MapModule] = useClientModule(() => import("./SearchMap"));
  const t = useT("modules/search");

  if (!mounted || !MapModule) {
    // MapSkeleton (min-h-screen) : sans hauteur propre, le temps de
    // chargement du chunk Leaflet serait un blanc total.
    return <MapSkeleton label={t("Chargement de la carte…")} />;
  }

  const SearchMap = MapModule.default;
  return (
    <SearchMap
      results={results}
      card={card}
      preview={preview}
      list={list}
      map={map}
      focusedItemId={focusedItemId}
      onMarkerFocus={onMarkerFocus}
      containerClass={containerClass}
    />
  );
}