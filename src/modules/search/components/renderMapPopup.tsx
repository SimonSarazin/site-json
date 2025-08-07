import ReactDOMServer from "react-dom/server";
import { MapPopupProps } from "../schema";
import { MapPopupDefault } from "./mapPopup/MapPopupDefault";

export function renderMapPopup(props: MapPopupProps) {
  // faire un switch sur le type de popup
  switch (props?.popup?.type) {
    case "default":
      return ReactDOMServer.renderToString(<MapPopupDefault {...props} />);
    default:
      return ReactDOMServer.renderToString(<MapPopupDefault {...props} />);
  }
}