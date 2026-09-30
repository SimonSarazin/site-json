// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Feature } from "geojson";

import { renderWithProviders } from "../../../tests/test-utils-ui";
import type { GeoShapeLayer } from "@/lib/geoShapes";

import { ShapeLegend } from "./ShapeLegend";

/**
 * Ce que garantit ce fichier : la légende PARTAGÉE par la carte (`MapShapeLegend`) et la section
 * `map-shapes`. Une retouche ici change les deux vues à la fois — c'est le but, et c'est pourquoi
 * la pastille et le choix des couches sont épinglés ici plutôt que dans l'une des deux vues.
 */

function couche(id: string, extra: Partial<GeoShapeLayer> = {}, contours = 1): GeoShapeLayer {
  const features: Feature[] = Array.from({ length: contours }, (_, i) => ({
    type: "Feature",
    id: `${id}-${i}`,
    properties: {},
    geometry: { type: "Point", coordinates: [0, 0] },
  }));
  return { id, data: { type: "FeatureCollection", features }, isLoading: false, isError: false, ...extra };
}

function pastille(container: HTMLElement): HTMLElement {
  const span = container.querySelector<HTMLElement>("li > span[aria-hidden]");
  if (!span) throw new Error("pastille absente");
  return span;
}

describe("ShapeLegend — couches légendées", () => {
  it("n'y entrent que les couches libellées ET dessinées", () => {
    const { container } = renderWithProviders(
      <ShapeLegend
        layers={[
          couche("communes", { label: { fr: "Communes" } }),
          couche("decor"),
          couche("qpv", { label: { fr: "Quartiers prioritaires" } }, 0),
        ]}
      />,
    );

    expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Communes"]);
  });

  it("aucune couche légendée : rien n'est rendu, pas même le conteneur", () => {
    const { container } = renderWithProviders(
      <ShapeLegend layers={[couche("decor")]} className="absolute rounded-lg" />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("la disposition vient de l'appelant, sans écraser la base des entrées", () => {
    const { container } = renderWithProviders(
      <ShapeLegend
        layers={[couche("communes", { label: { fr: "Communes" } })]}
        className="flex flex-col"
        itemClassName="text-foreground"
      />,
    );

    expect(container.querySelector("ul")?.className).toBe("flex flex-col");
    const classes = container.querySelector("li")?.className ?? "";
    expect(classes).toContain("text-foreground");
    expect(classes).toContain("gap-2");
  });
});

describe("ShapeLegend — pastille", () => {
  it("peinte comme le contour, remplissage renforcé : 0,12 + 0,35 par défaut", () => {
    const { container } = renderWithProviders(
      <ShapeLegend layers={[couche("communes", { label: { fr: "Communes" }, style: { fill: "chart-2" } })]} />,
    );

    const style = pastille(container).getAttribute("style") ?? "";
    expect(style).toContain("background-color: var(--chart-2)");
    // Sans `stroke`, le contour de la pastille suit le remplissage.
    expect(style).toContain("border-color: var(--chart-2)");
    expect(pastille(container).style.opacity).toBe("0.47");
  });

  it("`fill: \"none\"` : pastille transparente mais pleinement opaque, bordure de repli", () => {
    const { container } = renderWithProviders(
      <ShapeLegend layers={[couche("contour", { label: { fr: "Contour" }, style: { fill: "none" } })]} />,
    );

    const style = pastille(container).getAttribute("style") ?? "";
    expect(style).toContain("background-color: transparent");
    expect(style).toContain("border-color: var(--border)");
    expect(pastille(container).style.opacity).toBe("1");
  });
});
