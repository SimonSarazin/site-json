import { SearchCardProps } from "../schema";
import { lazy } from "vite-preload";

/**
 * Dispatcher des cartes « détaillées » (vue liste, `isDetailedView`), sur le même
 * modèle que `SearchCard` pour la vue grille : on choisit le variant détaillé via
 * `card.variant || card.type`. Chaque variant est en `lazy()` — un seul chunk est
 * téléchargé par page.
 *
 * Pour ajouter un type d'affichage détaillé : créer `./card/CardDetailed<X>.tsx`
 * (même signature `SearchCardProps`), l'importer en `lazy()` ci-dessous, puis
 * ajouter le `case` correspondant. Tant qu'un variant détaillé n'existe pas, le
 * `default` retombe sur `CardDetailedDefault` (comportement actuel préservé).
 */
const CardDetailedDefault = lazy(() => import("./card/CardDetailedDefault"));
const CardDetailedServicePricing = lazy(() => import("./card/CardDetailedServicePricing"));

export default function SearchCardDetailed({
  item,
  onClick,
  card,
}: SearchCardProps) {
  // Switch sur le variant (prioritaire) ou le type de carte.
  const cardType = card?.detailedMode || card?.variant || card?.type;
  switch (cardType) {
    case "service-pricing":
      return <CardDetailedServicePricing item={item} onClick={onClick} card={card} />;
    default:
      return <CardDetailedDefault item={item} onClick={onClick} card={card} />;
  }
}
