// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import MapMarkerAvatar from "./MapMarkerAvatar";

/**
 * Repli du marqueur-vignette quand l'URL d'avatar est MORTE.
 *
 * `resolveMarkerVisual` ne se replie sur le pin qu'en l'ABSENCE du champ image :
 * une URL présente mais qui renvoie 404 (avatar supprimé, chemin obsolète —
 * cas courant sur les profils Communecter) laissait le navigateur peindre son
 * icône « image cassée », faisant disparaître l'item de la carte sans signal.
 */
describe("MapMarkerAvatar — repli sur image morte", () => {
  it("rend l'image tant qu'elle charge", () => {
    const { container } = render(<MapMarkerAvatar src="/ok.jpg" size={36} />);
    expect(container.querySelector("img")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("bascule sur la silhouette quand l'image échoue", () => {
    const { container } = render(<MapMarkerAvatar src="/mort.jpg" size={36} />);
    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("conserve la taille demandée dans le repli", () => {
    const { container } = render(<MapMarkerAvatar src="/mort.jpg" size={64} />);
    fireEvent.error(container.querySelector("img")!);

    const el = container.querySelector("span") as HTMLElement;
    expect(el.style.width).toBe("64px");
    expect(el.style.height).toBe("64px");
  });

  it("retente une NOUVELLE url après un échec (pas d'échec collant)", () => {
    // Les marqueurs sont mémoïsés puis réconciliés : `src` peut changer sans
    // démontage. Un état d'échec booléen condamnerait l'url suivante.
    const { container, rerender } = render(<MapMarkerAvatar src="/mort.jpg" size={36} />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();

    rerender(<MapMarkerAvatar src="/autre.jpg" size={36} />);
    expect(container.querySelector("img")).toBeInTheDocument();
  });
});

