// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { MapPopupDefault } from "./MapPopupDefault";

/**
 * Depuis la migration MapLibre, la popup est un VRAI composant React rendu dans
 * le <Popup> react-map-gl (plus de `renderToString`). Ces tests verrouillent le
 * contrat : contenu rendu, tags plafonnés (+N), libellé selon `map.itemAction`,
 * et le bouton d'action qui appelle bien `onAction`.
 */

const t = (key: string) => key;

function fakeItem(over: Record<string, unknown> = {}): SearchEntity {
  return {
    serverData: {
      id: "x1",
      name: "Stade de l'Est",
      slug: "stade-est",
      address: { streetAddress: "12 rue du Sport", postalCode: "97400", addressLocality: "Saint-Denis" },
      tags: ["foot", "athlétisme", "natation", "judo", "tennis", "basket"],
      ...over,
    },
  } as unknown as SearchEntity;
}

describe("MapPopupDefault (composant React)", () => {
  it("rend nom, adresse, tags plafonnés (4 visibles + compteur) et le bouton", () => {
    render(<MapPopupDefault item={fakeItem()} t={t} />);
    expect(screen.getByText("Stade de l'Est")).toBeTruthy();
    expect(screen.getByText(/12 rue du Sport/)).toBeTruthy();
    expect(screen.getByText("#foot")).toBeTruthy();
    expect(screen.getByText("#natation")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.queryByText("#basket")).toBeNull();
  });

  it("libellé du bouton selon l'action : preview (défaut) vs profil", () => {
    const { rerender } = render(<MapPopupDefault item={fakeItem()} t={t} />);
    expect(screen.getByRole("button", { name: /En savoir plus/ })).toBeTruthy();
    rerender(<MapPopupDefault item={fakeItem()} t={t} actionKind="profil" />);
    expect(screen.getByRole("button", { name: /Voir le profil/ })).toBeTruthy();
  });

  it("clic sur le bouton → appelle onAction (handler React, plus de DOM event)", () => {
    const onAction = vi.fn();
    render(<MapPopupDefault item={fakeItem()} t={t} onAction={onAction} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("bandeau image quand l'item en a une, aucun sinon", () => {
    const { container } = render(
      <MapPopupDefault item={fakeItem({ profilMediumImageUrl: "/upload/stade.jpg" })} t={t} />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toContain("/upload/stade.jpg");

    const { container: bare } = render(<MapPopupDefault item={fakeItem()} t={t} />);
    expect(bare.querySelector("img")).toBeNull();
  });
});
