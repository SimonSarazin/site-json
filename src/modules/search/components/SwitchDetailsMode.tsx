import { SwitchDetailsModeProps } from "../schema";
import { lazy } from "vite-preload";

/**
 * Sélection du CONTENEUR de détail par `card.detailsMode` UNIQUEMENT (axe
 * conteneur). Le CONTENU est choisi par `preview.type` dans `Preview.tsx` (axe
 * contenu). Ne lit plus jamais `card.type` : conteneur, contenu et carte sont
 * trois axes orthogonaux. Variants en `lazy()` (un seul chunk chargé au runtime).
 */
const DetailsModeDialog = lazy(() => import("./detailsMode/DetailsModeDialog"));
const DetailsModeDrawer = lazy(() => import("./detailsMode/DetailsModeDrawer"));

export function SwitchDetailsMode({ openDetails, setOpenDetails, item, card, preview }: SwitchDetailsModeProps) {
  switch (card?.detailsMode) {
    case "dialog":
      return (
        <DetailsModeDialog openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} preview={preview} />
      );
    case "drawer":
    default:
      return (
        <DetailsModeDrawer openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} preview={preview} />
      );
  }
}
