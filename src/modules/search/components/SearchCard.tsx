import type { News } from "@communecter/cocolight-api-client";
import { SearchCardProps } from "../schema";
import { lazy } from "vite-preload";

/**
 * Variants de Card en `lazy()`, nommées par DESIGN/FONCTIONNALITÉ (jamais par
 * site). À une page donnée, un seul type est utilisé (cf. config `list.card.type`
 * / `variant`) ; les autres chunks ne sont pas téléchargés côté client.
 */
const CardDefault = lazy(() => import("./card/CardDefault"));
const CardEvent = lazy(() => import("./card/CardEvent"));
const CardOverlay = lazy(() => import("./card/CardOverlay"));
const CardImageCover = lazy(() => import("./card/CardImageCover"));
const CardImagePanel = lazy(() => import("./card/CardImagePanel"));
const CardFunding = lazy(() => import("./card/CardFunding"));
const CardProfile = lazy(() => import("./card/CardProfile"));
const CardEventFeatured = lazy(() => import("./card/CardEventFeatured"));
const CardResourceBooking = lazy(() => import("./card/CardResourceBooking"));
const CardPoiAmenities = lazy(() => import("./card/CardPoiAmenities"));
const CardContact = lazy(() => import("./card/CardContact"));
const CardAnswer = lazy(() => import("./card/CardAnswer"));
const CardNews = lazy(() => import("./card/CardNews"));
const CardParole = lazy(() => import("./card/CardParole"));

export default function SearchCard({
  item,
  onClick,
  card = {
    tagLimit: 5,
    showDescription: false,
    showAddress: true,
    showStar: false,
    shareButton: false,
    type: "overlay"
  },
}: SearchCardProps) {

  // Switch sur le type/variant de carte (valeurs design/fonctionnalité).
  const cardType = card.variant || card.type;

  switch (cardType) {
    case "overlay":
      return <CardOverlay item={item} onClick={onClick} card={card} />;
    case "image-cover":
      return <CardImageCover item={item} onClick={onClick} card={card} />;
    case "event":
      return <CardEvent item={item} onClick={onClick} card={card} />;
    case "funding":
      return <CardFunding item={item} onClick={onClick} card={card} />;
    case "profile":
      return <CardProfile item={item as import("@communecter/cocolight-api-client").User | import("@communecter/cocolight-api-client").Organization} onClick={onClick} card={card} />;
    case "event-featured":
      return <CardEventFeatured item={item} onClick={onClick} card={card} />;
    case "resource-booking":
      return <CardResourceBooking item={item} onClick={onClick} card={card} />;
    case "poi-amenities":
      return <CardPoiAmenities item={item} onClick={onClick} card={card} />;
    case "contact-card":
      return <CardContact item={item} onClick={onClick} card={card} />;
    case "image-panel":
      return <CardImagePanel item={item} onClick={onClick} card={card} />;
    case "card-answer":
      return <CardAnswer item={item} onClick={onClick} card={card} />;
    case "news":
      // card.type "news" ⇒ l'item est une News (wrappée par _linkEntity via collection:"news"),
      // mais SearchEntity ne l'inclut pas (serverData hétérogène) → cast au point de dispatch.
      return <CardNews item={item as unknown as News} onClick={onClick} card={card} />;
    case "parole":
      return <CardParole item={item} onClick={onClick} card={card} />;
    case "default":
      return <CardDefault item={item} onClick={onClick} card={card} />;
    default:
      return <CardDefault item={item} onClick={onClick} card={card} />;
  }
}
