import { SwitchDetailsModeProps } from "../schema";
import { lazy } from "vite-preload";

/**
 * Variants de détail (modal/dialog/drawer) en `lazy()`. Au runtime, un seul
 * variant est utilisé selon `card.detailsMode` (+ variant pour les cas
 * spécifiques `card-answer`, `poi-ssbe`). Les chunks non utilisés ne sont
 * pas téléchargés côté client.
 */
const DetailsModeDialog = lazy(() => import("./detailsMode/DetailsModeDialog"));
const DetailsModeDrawer = lazy(() => import("./detailsMode/DetailsModeDrawer"));
const AnswerDetailModeDialog = lazy(() => import("./detailsMode/AnswerDetailModeDialog"));
const PoiDetailSSBE = lazy(() => import("./detailsMode/PoiDetailSSBE"));

export function SwitchDetailsMode({ openDetails, setOpenDetails, item, card, preview }: SwitchDetailsModeProps) {
      const cardType = card?.variant || card?.type;

      switch (card?.detailsMode) {
        case "drawer":
          return <DetailsModeDrawer openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} preview={preview} />;
        case "dialog":
          if (cardType === "card-answer") {
            return <AnswerDetailModeDialog openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} preview={preview} />;
          }else if (cardType === "poi-ssbe") {
            return <PoiDetailSSBE openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} />;
          }
          return <DetailsModeDialog openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} preview={preview} />;
        default:
          return <DetailsModeDialog openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} preview={preview} />;
      }
};