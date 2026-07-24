import "@/modules/search/i18n"; // Required: registers i18n resources — le modal détail est monté HORS
// section search (palette, observatoire, membres profil, agenda) : sans ça, DetailsModeDialog/Drawer +
// les previews (resource/testimonial/…) affichent leurs clés STRUCTURÉES brutes faute de bundle enregistré.
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

export function SwitchDetailsMode({ openDetails, setOpenDetails, item, card: cardProp, preview: previewProp, list }: SwitchDetailsModeProps) {
  // card/preview : prop explicite (agenda/observatoire/profil… sans `list`) OU dérivée de `list`
  // (call-sites search, qui ne passent plus que `list`). Le dispatch conteneur se fait sur card.detailsMode.
  const card = cardProp ?? list?.card;
  const preview = previewProp ?? list?.preview;
  switch (card?.detailsMode) {
    case "dialog":
      return (
        <DetailsModeDialog openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} preview={preview} list={list} />
      );
    case "drawer":
    default:
      return (
        <DetailsModeDrawer openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} preview={preview} list={list} />
      );
  }
}
