// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PreviewTestimonialBubble from "./PreviewTestimonialBubble";

vi.mock("@/hooks/useT", () => ({ useT: () => (k: string) => k }));
vi.mock("@/components/media/AudioPlayer", () => ({ AudioPlayer: () => null }));
vi.mock("../../ClickableFacet", () => ({ ClickableFacet: () => null }));
vi.mock("../../../hooks/useTestimonialData", () => ({
  useTestimonialData: () => ({
    quote: "Une parole", title: "Anonyme", image: "/img/affiche.png", date: null, audio: null,
    badge: null, accent: null, subtitle: null, facets: [],
  }),
}));

const item = {} as never;

describe("PreviewTestimonialBubble — cadrage de l'illustration", () => {
  it("par défaut (cover) : bannière 21/9 rognée, rendu historique", () => {
    const { container } = render(<PreviewTestimonialBubble item={item} list={{ testimonial: { quoteField: "description" } } as never} onClose={() => {}} />);
    expect(container.querySelector(".aspect-\\[21\\/9\\]")).not.toBeNull();
    expect(container.querySelector("img.blur-lg")).toBeNull();
  });

  it("imageFit contain : image entière centrée sur fond flou, sans ratio forcé", () => {
    const { container } = render(
      <PreviewTestimonialBubble item={item} list={{ testimonial: { quoteField: "description", imageFit: "contain" } } as never} onClose={() => {}} />,
    );
    expect(container.querySelector(".aspect-\\[21\\/9\\]")).toBeNull();
    expect(container.querySelector("img.object-contain")?.getAttribute("alt")).toBe("Anonyme");
    expect(container.querySelector("img.blur-lg")?.getAttribute("alt")).toBe("");
  });
});
