// @vitest-environment jsdom
import { describe, expect, it, beforeAll } from "vitest";
import "@/modules/ampli/i18n";
import i18n from "@/i18n";
import { renderWithProviders, screen } from "../../../../../../tests/test-utils-ui";
import { MeeteemMapPlaceholder } from "./MeeteemMapPlaceholder";

/**
 * Tests du placeholder vue Carte.
 * Composant purement présentationnel avec 2 variantes (large / compact).
 */
describe("MeeteemMapPlaceholder", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("rend le titre et sous-titre i18n par défaut (variant large)", () => {
    renderWithProviders(<MeeteemMapPlaceholder />);
    expect(screen.getByText("Carte interactive")).toBeInTheDocument();
    expect(screen.getByText("(nécessite Leaflet.js)")).toBeInTheDocument();
  });

  it("appliques les classes 'large' par défaut", () => {
    const { container } = renderWithProviders(<MeeteemMapPlaceholder />);
    const wrapper = container.querySelector(".rounded-xl");
    expect(wrapper?.className).toContain("w-full");
    expect(wrapper?.className).toContain("h-[600px]");
  });

  it("appliques les classes 'compact' quand variant='compact'", () => {
    const { container } = renderWithProviders(<MeeteemMapPlaceholder variant="compact" />);
    const wrapper = container.querySelector(".rounded-xl");
    expect(wrapper?.className).toContain("flex-1");
    expect(wrapper?.className).not.toContain("h-[600px]");
  });

  it("explicite variant='large' donne le même rendu que default", () => {
    const { container: a } = renderWithProviders(<MeeteemMapPlaceholder />);
    const { container: b } = renderWithProviders(<MeeteemMapPlaceholder variant="large" />);
    const wrapperA = a.querySelector(".rounded-xl")?.className;
    const wrapperB = b.querySelector(".rounded-xl")?.className;
    expect(wrapperA).toBe(wrapperB);
  });

  it("rend une icône Map (présence SVG Lucide)", () => {
    const { container } = renderWithProviders(<MeeteemMapPlaceholder />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
