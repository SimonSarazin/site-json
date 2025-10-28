import { SearchCardProps } from "../schema";
import CardDefault from "./card/CardDefault";
import CardEvent from "./card/CardEvent";
import CardOverlay from "./card/CardOverlay";
import CardTiersLieux from "./card/CardTiersLieux";

export default function SearchCard({
  item,
  onClick,
  card = {
    tagLimit: 5,
    showDescription: false,
    showAddress: true,
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
    case "default":
      return <CardDefault item={item} onClick={onClick} card={card} />;
    default:
      return <CardDefault item={item} onClick={onClick} card={card} />;
  }
}