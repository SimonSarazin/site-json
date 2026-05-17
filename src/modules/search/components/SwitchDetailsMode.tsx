import { SwitchDetailsModeProps } from "../schema";
import DetailsModeDialog from "./detailsMode/DetailsModeDialog";
import DetailsModeDrawer from "./detailsMode/DetailsModeDrawer";
import AnswerDetailModeDialog from "./detailsMode/AnswerDetailModeDialog";
import PoiDetailSSBE from "./detailsMode/PoiDetailSSBE";

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