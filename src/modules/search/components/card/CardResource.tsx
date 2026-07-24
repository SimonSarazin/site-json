import { lazy, Suspense } from "react";
import { SearchCardProps } from "../../schema";

const CardResourceCard = lazy(() => import("./resource/CardResourceCard"));

/**
 * Coque « resource » (card) — dispatch sur le DESIGN (`resource.design`). Un seul design aujourd'hui
 * (`card`, image-first) ; les autres looks s'ajoutent ici. Données via `useResourceData` (config-driven).
 */
export default function CardResource({ item, onClick, list }: SearchCardProps) {
  const resource = list?.resource;
  switch (resource?.design ?? "card") {
    case "card":
    default:
      return (
        <Suspense fallback={null}>
          <CardResourceCard item={item} onClick={onClick} list={list} />
        </Suspense>
      );
  }
}
