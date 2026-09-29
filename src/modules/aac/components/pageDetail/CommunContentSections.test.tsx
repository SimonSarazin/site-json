// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * La galerie de la fiche d'un commun : ce qu'un clic sur une vignette ouvre.
 *
 * Trois choses, et rien du rendu interne de la visionneuse (`ImageViewer`, déjà
 * partagée par le blog, les profils et CoForm) :
 *  1. rien n'est ouvert au premier rendu — la visionneuse ne se monte que sur
 *     un clic ;
 *  2. le clic ouvre SUR L'IMAGE CLIQUÉE, pas sur la première : c'est l'`initialIndex`
 *     qui porte cette promesse, et une régression y serait invisible à l'œil ;
 *  3. la visionneuse reçoit la galerie ENTIÈRE, pas l'image cliquée seule —
 *     sans quoi ses flèches n'auraient rien à faire défiler.
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string, params?: Record<string, unknown>) =>
    (fallback ?? key).replace("{{index}}", String(params?.index ?? "")),
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

// Stub : on observe les PROPS de la visionneuse (est-elle ouverte, sur quel
// index, avec quelle liste) — son dialogue, son zoom et son pan sont testés
// avec elle, pas ici.
vi.mock("@/components/ui/image-viewer", () => ({
  ImageViewer: ({
    images,
    initialIndex,
    open,
  }: {
    images: { src: string; name?: string }[];
    initialIndex: number;
    open: boolean;
  }) =>
    open ? (
      <div
        data-testid="viewer"
        data-initial-index={String(initialIndex)}
        data-count={String(images.length)}
        data-src={images[initialIndex]?.src ?? ""}
      />
    ) : null,
}));

const { GallerySection } = await import("./CommunContentSections");

const IMAGES = [
  { src: "https://example.test/a.jpg", alt: "a.jpg" },
  { src: "https://example.test/b.jpg", alt: "b.jpg" },
  { src: "https://example.test/c.jpg", alt: "c.jpg" },
];

describe("GallerySection", () => {
  it("n'ouvre rien tant qu'aucune vignette n'est cliquée", () => {
    render(<GallerySection images={IMAGES} />);
    expect(screen.queryByTestId("viewer")).toBeNull();
  });

  it("ouvre la visionneuse sur l'image cliquée, avec la galerie entière", () => {
    render(<GallerySection images={IMAGES} />);

    fireEvent.click(screen.getByRole("button", { name: "Agrandir l'image 3" }));

    const viewer = screen.getByTestId("viewer");
    expect(viewer.getAttribute("data-initial-index")).toBe("2");
    expect(viewer.getAttribute("data-src")).toBe("https://example.test/c.jpg");
    // La liste entière, sinon les flèches de la visionneuse n'ont rien à parcourir.
    expect(viewer.getAttribute("data-count")).toBe("3");
  });

  it("expose une vignette cliquable par image", () => {
    render(<GallerySection images={IMAGES} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("rend le message de vacuité, et aucune vignette, sans image", () => {
    render(<GallerySection images={[]} />);
    expect(screen.getByText("detail.gallery.empty")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
