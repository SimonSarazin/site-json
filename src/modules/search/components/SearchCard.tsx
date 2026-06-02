import { SearchCardProps } from "../schema";
import { lazy } from "vite-preload";

/**
 * Variants de Card en `lazy()`. À une page donnée, un seul type est utilisé
 * (cf. config `list.card.type`/`variant`). Les 10 autres chunks ne sont pas
 * téléchargés côté client.
 */
const CardDefault = lazy(() => import("./card/CardDefault"));
const CardEvent = lazy(() => import("./card/CardEvent"));
const CardOverlay = lazy(() => import("./card/CardOverlay"));
const CardTiersLieux = lazy(() => import("./card/CardTiersLieux"));
const CardRezoLaMer = lazy(() => import("./card/CardRezoLaMer"));
const CardProfile = lazy(() => import("./card/CardProfile"));
const CardEventRezoLaMer = lazy(() => import("./card/CardEventRezoLaMer"));
const CardPoiRezoLaMer = lazy(() => import("./card/CardPoiRezoLaMer"));
const CardPoiSSBE = lazy(() => import("./card/CardPoiSSBE"));
const CardSsbe = lazy(() => import("./card/CardSsbe"));
const CardElts = lazy(() => import("./card/CardElts"));
const CardAnswer = lazy(() => import("./card/CardAnswer"));

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

  // faire un switch sur le type de carte ou le variant
  const cardType = card.variant || card.type;

  switch (cardType) {
    case "overlay":
      return <CardOverlay item={item} onClick={onClick} card={card} />;
    case "tiers-lieux":
      return <CardTiersLieux item={item} onClick={onClick} card={card} />;
    case "event":
      return <CardEvent item={item} onClick={onClick} card={card} />;
    case "rezo-la-mer":
      return <CardRezoLaMer item={item} onClick={onClick} card={card} />;
    case "profile":
      return <CardProfile item={item as import("@communecter/cocolight-api-client").User | import("@communecter/cocolight-api-client").Organization} onClick={onClick} card={card} />;
    case "event-rezo-la-mer":
      return <CardEventRezoLaMer item={item} onClick={onClick} card={card} />;
    case "poi-rezo-la-mer":
      return <CardPoiRezoLaMer item={item} onClick={onClick} card={card} />;
    case "poi-ssbe":
      return <CardPoiSSBE item={item} onClick={onClick} card={card} />;
    case "ssbe":
      return <CardSsbe item={item} onClick={onClick} card={card} />;
    case "card-elts":
      return <CardElts item={item} onClick={onClick} card={card} />;
    case "card-answer":
      return <CardAnswer item={item} onClick={onClick} card={card} />;
    case "default":
      return <CardDefault item={item} onClick={onClick} card={card} />;
    default:
      return <CardDefault item={item} onClick={onClick} card={card} />;
  }
}
