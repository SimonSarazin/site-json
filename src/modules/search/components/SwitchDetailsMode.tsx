import { SwitchDetailsModeProps } from "../schema";
import DetailsModeDialog from "./detailsMode/DetailsModeDialog";
import DetailsModeDrawer from "./detailsMode/DetailsModeDrawer";

export function SwitchDetailsMode({ openDetails, setOpenDetails, item, card, preview }: SwitchDetailsModeProps) {
      switch (card?.detailsMode) {
        case "drawer":
          return <DetailsModeDrawer openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} preview={preview} />;
        case "dialog":
          return <DetailsModeDialog openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} preview={preview} />;
        default:
          return <DetailsModeDialog openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} preview={preview} />;
      }
};