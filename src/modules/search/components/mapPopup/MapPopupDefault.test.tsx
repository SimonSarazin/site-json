// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import { MapPopupDefault } from "./MapPopupDefault";
import type { SearchEntity } from "@communecter/cocolight-api-client";

/**
 * Image d'en-tête de la popup : une URL morte (avatar supprimé, chemin
 * obsolète — courant sur les profils Communecter) peignait le cadre
 * « image cassée » du navigateur en haut de la carte.
 */
const t = (key: string) => key;

function makeItem(serverData: Record<string, unknown>): SearchEntity {
  return { id: "x", serverData } as unknown as SearchEntity;
}

describe("MapPopupDefault — image morte", () => {
  it("rend l'image tant qu'elle charge", () => {
    const { container } = render(
      <MapPopupDefault item={makeItem({ name: "A", profilMediumImageUrl: "http://x/ok.jpg" })} t={t} />,
    );
    expect(container.querySelector("img")).toBeInTheDocument();
  });

  it("retire l'image quand elle échoue", () => {
    const { container } = render(
      <MapPopupDefault item={makeItem({ name: "A", profilMediumImageUrl: "http://x/mort.jpg" })} t={t} />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    // Le reste de la popup survit : c'est bien l'image seule qui disparaît.
    expect(container.textContent).toContain("A");
  });

  it("retente une NOUVELLE image après un échec (pas d'échec collant)", () => {
    // `item` change sans démontage quand on passe d'un marqueur à l'autre.
    const { container, rerender } = render(
      <MapPopupDefault item={makeItem({ name: "A", profilMediumImageUrl: "http://x/mort.jpg" })} t={t} />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();

    rerender(<MapPopupDefault item={makeItem({ name: "B", profilMediumImageUrl: "http://x/autre.jpg" })} t={t} />);
    expect(container.querySelector("img")).toBeInTheDocument();
  });

  it("ne rend aucune image quand l'item n'en a pas", () => {
    const { container } = render(<MapPopupDefault item={makeItem({ name: "A" })} t={t} />);
    expect(container.querySelector("img")).toBeNull();
  });
});
