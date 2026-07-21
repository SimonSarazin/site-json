import React from "react";
import { lazy } from "vite-preload";
import type { News } from "@communecter/cocolight-api-client";
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
const PreviewNews = lazy(() => import("./preview/PreviewNews"));
const PreviewParole = lazy(() => import("./preview/PreviewParole"));

const Preview: React.FC<PreviewProps> = ({ item, preview = { type: "default" }, onClose }) => {
  switch (preview?.type) {
    case "poi-amenities":
      return <PreviewPoiAmenities item={item} onClose={onClose} />;
    case "coform-answer":
      return <PreviewCoformAnswer item={item} onClose={onClose} />;
    case "event":
      return <PreviewEvent item={item} onClose={onClose} />;
    case "facets":
      return <PreviewFacets item={item} preview={preview} onClose={onClose} />;
    case "news":
      return <PreviewNews item={item as unknown as News} preview={preview} onClose={onClose} />;
    case "parole":
      return <PreviewParole item={item} onClose={onClose} />;
    case "default":
    default:
      return <PreviewDefault item={item} />;
  }
};

export default Preview;
