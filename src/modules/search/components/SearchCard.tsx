import { SearchCardProps } from "../schema";
import CardDefault from "./card/CardDefault";
import CardOverlay from "./card/CardOverlay";

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

  // faire un switch sur le type de carte
  switch (card.type) {
    case "overlay":
      return <CardOverlay item={item} onClick={onClick} card={card} />;
    case "default":
      return <CardDefault item={item} onClick={onClick} card={card} />;
    default:
      return <CardDefault item={item} onClick={onClick} card={card} />;
  }
}