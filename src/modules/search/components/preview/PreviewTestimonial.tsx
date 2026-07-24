import type { PreviewProps } from "../../schema";
import PreviewTestimonialBubble from "./testimonial/PreviewTestimonialBubble";

/**
 * Coque « testimonial » (preview/détail) — dispatch sur le DESIGN (`testimonial.design`). Repli code
 * "bubble" (config non parsée par Zod au runtime). Le design partage le contrat de la card → card ↔ preview
 * cohérentes par construction.
 */
export default function PreviewTestimonial({ item, list, onClose }: PreviewProps) {
  const testimonial = list?.testimonial;
  switch (testimonial?.design ?? "bubble") {
    case "bubble":
    default:
      return <PreviewTestimonialBubble item={item} list={list} onClose={onClose} />;
  }
}
