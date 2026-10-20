// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CardTestimonialBubble from "./CardTestimonialBubble";

vi.mock("@/hooks/useT", () => ({ useT: () => (k: string) => k }));
vi.mock("../../../hooks/useTestimonialData", () => ({
  useTestimonialData: () => ({
    quote: "Une parole", title: "Anonyme", image: "/img/affiche.png", date: null, audio: null,
    badge: null, accent: null, subtitle: null,
  }),
}));

const item = {} as never;

describe("CardTestimonialBubble — cadrage de l'illustration", () => {
  it("par défaut (cover) : bannière 16/9 rognée, rendu historique", () => {
    const { container } = render(<CardTestimonialBubble item={item} list={{ testimonial: { quoteField: "description" } } as never} />);
    expect(container.querySelector(".aspect-\\[16\\/9\\]")).not.toBeNull();
    expect(container.querySelector("img.object-cover")).not.toBeNull();
    expect(container.querySelector("img.blur-lg")).toBeNull();
  });

  it("imageFit contain : image ENTIÈRE sans ratio forcé, sur un fond flou décoratif (alt vide)", () => {
    const { container } = render(
      <CardTestimonialBubble item={item} list={{ testimonial: { quoteField: "description", imageFit: "contain" } } as never} />,
    );
    expect(container.querySelector(".aspect-\\[16\\/9\\]")).toBeNull();
    const nette = container.querySelector("img.object-contain");
    expect(nette).not.toBeNull();
    expect(nette?.getAttribute("alt")).toBe("Anonyme");
    const flou = container.querySelector("img.blur-lg");
    expect(flou).not.toBeNull();
    expect(flou?.getAttribute("alt")).toBe("");
  });
});
