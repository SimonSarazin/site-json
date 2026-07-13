import { lazy } from "vite-preload";
import type { MapConf, MapPopupProps } from "../schema";

/**
 * Dispatcher des popups de la carte, sur le même modèle que `SearchCardDetailed` :
 * le variant est choisi via `map.popup.type`, et chaque variant est en `lazy()`
 * (un seul chunk téléchargé par page ; les autres ne le sont jamais).
 *
 * Pour ajouter une popup : créer `./mapPopup/MapPopup<X>.tsx` (signature
 * `MapPopupProps`, `export default`), l'importer en `lazy()` ci-dessous, puis
 * ajouter le `case`. Tant qu'un variant n'existe pas, le `default` retombe sur
 * `MapPopupDefault` (comportement actuel préservé).
 */
const MapPopupDefault = lazy(() => import("./mapPopup/MapPopupDefault"));

export default function SearchMapPopup({
  popup,
  ...props
}: MapPopupProps & { popup?: MapConf["popup"] }) {
  switch (popup?.type) {
    case "default":
    default:
      return <MapPopupDefault {...props} />;
  }
}
