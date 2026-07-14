import React from "react";
import { lazy } from "vite-preload";
import { PreviewProps } from "@/modules/search/schema";
import PreviewDefault from "./preview/PreviewDefault";

/**
 * Contenu du détail — axe INDÉPENDANT du conteneur (`detailsMode`) et de la
 * carte (`card.type`). Dispatch sur `preview.type`. Les variantes riches sont
 * lazy() (chunk chargé seulement quand le type correspondant est demandé).
 */
const PreviewPoiAmenities = lazy(() => import("./preview/PreviewPoiAmenities"));
const PreviewCoformAnswer = lazy(() => import("./preview/PreviewCoformAnswer"));
const PreviewEvent = lazy(() => import("./preview/PreviewEvent"));
const PreviewFacets = lazy(() => import("./preview/PreviewFacets"));

const Preview: React.FC<PreviewProps> = ({ item, preview = { type: "default" }, onClose }) => {
  switch (preview?.type) {
    case "poi-amenities":
      // `preview` transporte les blocs config `reservations` /
      // `installationDashboard` (sections optionnelles du détail).
      return <PreviewPoiAmenities item={item} preview={preview} onClose={onClose} />;
    case "coform-answer":
      return <PreviewCoformAnswer item={item} onClose={onClose} />;
    case "event":
      return <PreviewEvent item={item} onClose={onClose} />;
    case "facets":
      return <PreviewFacets item={item} preview={preview} onClose={onClose} />;
    case "default":
    default:
      return <PreviewDefault item={item} />;
  }
};

export default Preview;
