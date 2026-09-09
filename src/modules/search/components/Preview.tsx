import React from "react";
import { lazy } from "vite-preload";
import type { News } from "@communecter/cocolight-api-client";
import { PreviewProps } from "@/modules/search/schema";
import PreviewDefault from "./preview/PreviewDefault";

/**
 * Contenu du détail — axe INDÉPENDANT du conteneur (`detailsMode`) et de la
 * carte (`card.type`). Dispatch sur `preview.type`. Les variantes riches sont
 * lazy() (chunk chargé seulement quand le type correspondant est demandé).
 *
 * `list` est transmis à TOUS les variants : ils y lisent leur tranche (`list.testimonial`,
 * `list.resource`, …) ; ceux qui n'en ont pas besoin l'ignorent. Sur une liste hétérogène
 * (`list.itemRules`), `list` est la conf RÉSOLUE de l'item ouvert — carte et détail partagent donc
 * la même tranche par construction.
 */
const PreviewPoiAmenities = lazy(() => import("./preview/PreviewPoiAmenities"));
const PreviewCoformAnswer = lazy(() => import("./preview/PreviewCoformAnswer"));
const PreviewEvent = lazy(() => import("./preview/PreviewEvent"));
const PreviewFacets = lazy(() => import("./preview/PreviewFacets"));
const PreviewNews = lazy(() => import("./preview/PreviewNews"));
const PreviewTestimonial = lazy(() => import("./preview/PreviewTestimonial"));
const PreviewResource = lazy(() => import("./preview/PreviewResource"));
const PreviewResourceDirectory = lazy(() => import("./preview/PreviewResourceDirectory"));
const PreviewStructure = lazy(() => import("./preview/PreviewStructure"));

const Preview: React.FC<PreviewProps> = ({ item, preview = { type: "default" }, list, onClose }) => {
  switch (preview?.type) {
    case "poi-amenities":
      // `preview` transporte les blocs config `reservations` /
      // `installationDashboard` (sections optionnelles du détail).
      return <PreviewPoiAmenities item={item} preview={preview} list={list} onClose={onClose} />;
    case "coform-answer":
      // `preview` transporte le mapping `fields` (surcharge des IDs de champs
      // CoForm) et le flag `editButton` — sans lui, les deux sont morts.
      return <PreviewCoformAnswer item={item} preview={preview} list={list} onClose={onClose} />;
    case "event":
      return <PreviewEvent item={item} list={list} onClose={onClose} />;
    case "facets":
      return <PreviewFacets item={item} preview={preview} list={list} onClose={onClose} />;
    case "news":
      return <PreviewNews item={item as unknown as News} preview={preview} list={list} onClose={onClose} />;
    case "testimonial":
      return <PreviewTestimonial item={item} preview={preview} list={list} onClose={onClose} />;
    case "resource":
      return <PreviewResource item={item} preview={preview} list={list} onClose={onClose} />;
    case "resource-directory":
      return <PreviewResourceDirectory item={item} preview={preview} list={list} onClose={onClose} />;
    case "structure":
      return <PreviewStructure item={item} preview={preview} list={list} onClose={onClose} />;
    case "default":
    default:
      return <PreviewDefault item={item} list={list} />;
  }
};

export default Preview;
