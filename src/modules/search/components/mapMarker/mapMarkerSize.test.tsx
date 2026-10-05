// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";

import MapMarkerAvatar from "./MapMarkerAvatar";
import MapMarkerCircle from "./MapMarkerCircle";
import MapMarkerCircleIcon from "./MapMarkerCircleIcon";
import MapMarkerIcon from "./MapMarkerIcon";
import MapMarkerPin from "./MapMarkerPin";
import MapMarkerPinIcon from "./MapMarkerPinIcon";

/**
 * `resolveMarkerVisual` porte désormais `size` sur toutes les formes — encore
 * faut-il que chaque VUE l'applique. Ces tests ferment la boucle côté DOM :
 * sans eux, un variant pourrait ignorer la prop en silence (c'était le cas de
 * toutes les formes sauf `iconUrl`).
 *
 * Les vignettes et pastilles tiennent leurs dimensions d'une classe CSS
 * (`.search-map-avatar` 36 px, `.search-map-circle` 30 px) : on vérifie donc
 * que le style INLINE est bien posé, puisque c'est lui qui l'emporte.
 */
describe("taille des vues de marqueur", () => {
  it("vignette de l'item", () => {
    const { container } = render(<MapMarkerAvatar src="/i.jpg" size={64} />);
    const el = container.querySelector("img")!;
    expect(el.style.width).toBe("64px");
    expect(el.style.height).toBe("64px");
  });

  it("icône custom", () => {
    const { container } = render(<MapMarkerIcon src="/p.svg" size={45} />);
    const el = container.querySelector("img")!;
    expect(el.style.width).toBe("45px");
    expect(el.style.height).toBe("45px");
  });

  it("pastille ronde", () => {
    const { container } = render(<MapMarkerCircle cssColor="var(--primary)" size={50} />);
    const el = container.querySelector("span")!;
    expect(el.style.width).toBe("50px");
    expect(el.style.height).toBe("50px");
  });

  it("goutte (pin) — le SVG lui-même est dimensionné", () => {
    const { container } = render(<MapMarkerPin cssColor="var(--primary)" size={45} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("45");
    expect(svg.getAttribute("height")).toBe("45");
  });

  // `DynamicIcon` charge le pictogramme en import dynamique : il n'est pas dans
  // le DOM au premier rendu, d'où l'attente.
  it("goutte + pictogramme : la forme ET le glyphe grandissent", async () => {
    const { container } = render(
      <MapMarkerPinIcon icon="goal" cssColor="var(--primary)" size={68} />,
    );
    expect(container.querySelector("svg.search-map-pin")!.getAttribute("width")).toBe("68");
    expect((container.firstChild as HTMLElement).style.width).toBe("68px");
    // Ratio historique conservé : 13 px de glyphe pour 34 px de gabarit.
    await waitFor(() =>
      expect(container.querySelector("svg.search-map-glyph")?.getAttribute("width")).toBe(
        String(Math.round(68 * (13 / 34))),
      ),
    );
  });

  it("pastille + pictogramme : la forme ET le glyphe grandissent", async () => {
    const { container } = render(
      <MapMarkerCircleIcon icon="goal" cssColor="var(--primary)" size={60} />,
    );
    const box = container.querySelector("span.search-map-circle") as HTMLElement;
    expect(box.style.width).toBe("60px");
    // Ratio historique conservé : 15 px de glyphe pour 30 px de pastille.
    await waitFor(() => expect(box.querySelector("svg")?.getAttribute("width")).toBe("30"));
  });

  it("les tailles par défaut reproduisent le rendu historique", () => {
    const pin = render(<MapMarkerPin cssColor="var(--primary)" size={34} />);
    expect(pin.container.querySelector("svg")!.getAttribute("width")).toBe("34");
    const circle = render(<MapMarkerCircle cssColor="var(--primary)" size={30} />);
    expect((circle.container.querySelector("span") as HTMLElement).style.width).toBe("30px");
    const avatar = render(<MapMarkerAvatar src="/i.jpg" size={36} />);
    expect((avatar.container.querySelector("img") as HTMLElement).style.width).toBe("36px");
  });
});
