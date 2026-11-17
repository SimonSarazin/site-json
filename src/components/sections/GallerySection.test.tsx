// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, renderWithProviders } from "../../../tests/test-utils-ui";
import GallerySection from "./GallerySection";
import type { GallerySectionProps } from "@/types/site-schema";

const images: GallerySectionProps["images"] = Array.from({ length: 4 }, (_, i) => ({
  src: `/images/gallery-${i + 1}.webp`,
  alt: { fr: `Photo ${i + 1}` },
}));

let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
    configurable: true,
    get() {
      const parent = this.parentElement;
      return parent ? Array.from(parent.children).indexOf(this) * 320 : 0;
    },
  });
  scrollTo = vi.fn(function (this: HTMLElement, options: ScrollToOptions) {
    if (typeof options.left === "number") this.scrollLeft = options.left;
  });
  Object.defineProperty(Element.prototype, "scrollTo", { configurable: true, value: scrollTo });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GallerySection", () => {
  it("affiche un carrousel horizontal avec navigation accessible", () => {
    renderWithProviders(
      <GallerySection
        props={{ images, layout: "carousel", columns: 3, lightbox: true }}
      />
    );

    expect(screen.getByRole("region", { name: "Galerie de photos" })).toBeTruthy();
    expect(screen.getAllByRole("group")).toHaveLength(images.length);
    expect(screen.getByRole("button", { name: "Afficher l’image 1" })).toBeTruthy();

    screen.getByRole("button", { name: "Image suivante" }).click();
    expect(scrollTo).toHaveBeenCalledWith({ left: 320, behavior: "smooth" });
  });

  it("conserve l’affichage en grille par défaut", () => {
    const { container } = renderWithProviders(
      <GallerySection props={{ images, columns: 3, lightbox: false }} />
    );

    expect(container.querySelector(".grid")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Galerie de photos" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Image suivante" })).toBeNull();
  });
});
