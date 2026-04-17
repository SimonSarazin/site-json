import { SearchCardProps } from "../schema";
import CardDefault from "./card/CardDefault";
import CardEvent from "./card/CardEvent";
import CardOverlay from "./card/CardOverlay";
import CardTiersLieux from "./card/CardTiersLieux";
import CardRezoLaMer from "./card/CardRezoLaMer";
import CardProfile from "./card/CardProfile";
import CardEventRezoLaMer from "./card/CardEventRezoLaMer";
import CardPoiRezoLaMer from "./card/CardPoiRezoLaMer";
import CardSsbe from "./card/CardSsbe";
import CardElts from "./card/CardElts";
import CardAnswer from "./card/CardAnswer";

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