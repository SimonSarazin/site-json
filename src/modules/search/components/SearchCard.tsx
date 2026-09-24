import type { News } from "@communecter/cocolight-api-client";
import { SearchCardProps } from "../schema";
import { lazy } from "vite-preload";

/**
 * Variants de Card en `lazy()`, nommées par DESIGN/FONCTIONNALITÉ (jamais par site).
 *
 * Une page mono-type (`list.card.type` seul) ne télécharge qu'un chunk. Une liste HÉTÉROGÈNE
 * (`list.itemRules` — recherche globale) en charge un par famille présente ; `SearchListView`
 * enveloppe chaque carte dans son propre `<Suspense>` pour que le chargement d'un chunk ne fasse
 * pas retomber toute la section dans son fallback.
 *
 * `list` est transmis à TOUS les variants : ils y lisent leur tranche (`list.testimonial`,
 * `list.resource`, …) ; ceux qui n'en ont pas besoin l'ignorent.
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
const CardTestimonial = lazy(() => import("./card/CardTestimonial"));
const CardResource = lazy(() => import("./card/CardResource"));
const CardResourceDirectory = lazy(() => import("./card/CardResourceDirectory"));

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
  list,
}: SearchCardProps) {

  // Switch sur le type/variant de carte (valeurs design/fonctionnalité).
  const cardType = card.variant || card.type;

  switch (cardType) {
    case "overlay":
      return <CardOverlay item={item} onClick={onClick} card={card} list={list} />;
    case "image-cover":
      return <CardImageCover item={item} onClick={onClick} card={card} list={list} />;
    case "event":
      return <CardEvent item={item} onClick={onClick} card={card} list={list} />;
    case "funding":
      return <CardFunding item={item} onClick={onClick} card={card} list={list} />;
    case "profile":
      return <CardProfile item={item as import("@communecter/cocolight-api-client").User | import("@communecter/cocolight-api-client").Organization} onClick={onClick} card={card} list={list} />;
    case "event-featured":
      return <CardEventFeatured item={item} onClick={onClick} card={card} list={list} />;
    case "resource-booking":
      return <CardResourceBooking item={item} onClick={onClick} card={card} list={list} />;
    case "poi-amenities":
      return <CardPoiAmenities item={item} onClick={onClick} card={card} list={list} />;
    case "contact-card":
      return <CardContact item={item} onClick={onClick} card={card} list={list} />;
    case "image-panel":
      return <CardImagePanel item={item} onClick={onClick} card={card} list={list} />;
    case "card-answer":
      return <CardAnswer item={item} onClick={onClick} card={card} list={list} />;
    case "news":
      // card.type "news" ⇒ l'item est une News (wrappée par _linkEntity via collection:"news"),
      // mais SearchEntity ne l'inclut pas (serverData hétérogène) → cast au point de dispatch.
      return <CardNews item={item as unknown as News} onClick={onClick} card={card} list={list} />;
    case "testimonial":
      return <CardTestimonial item={item} onClick={onClick} card={card} list={list} />;
    case "resource":
      return <CardResource item={item} onClick={onClick} card={card} list={list} />;
    case "resource-directory":
      return <CardResourceDirectory item={item} onClick={onClick} card={card} list={list} />;
    case "default":
    default:
      return <CardDefault item={item} onClick={onClick} card={card} list={list} />;
  }
}
