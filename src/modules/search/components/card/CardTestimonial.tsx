import type { SearchCardProps } from "../../schema";
import CardTestimonialBubble from "./testimonial/CardTestimonialBubble";

/**
 * Coque « testimonial » (card) — dispatch sur le DESIGN (`testimonial.design`). Un seul design
 * aujourd'hui (`bubble`) ; les autres looks s'ajoutent ici. Repli code "bubble" : la config n'est pas
 * parsée par Zod au runtime, donc le `.default()` du schéma n'agit pas.
 */
export default function CardTestimonial({ item, onClick, list }: SearchCardProps) {
  const testimonial = list?.testimonial;
  switch (testimonial?.design ?? "bubble") {
    case "bubble":
    default:
      return <CardTestimonialBubble item={item} onClick={onClick} list={list} />;
  }
}
