import { describe, it, expect } from "vitest";

import { destinationSpa, type ClicDansHtml } from "./htmlSectionLinks";

/** Clic ordinaire sur un lien interne — chaque test ne surcharge que ce qu'il éprouve. */
const clic = (o: Partial<ClicDansHtml> = {}): ClicDansHtml => ({
  href: "/lieux",
  boutonPrincipal: true,
  avecModificateur: false,
  ...o,
});

describe("destinationSpa — clic sur un lien d'une section HTML", () => {
  it("navigue en SPA sur un lien interne", () => {
    expect(destinationSpa(clic())).toBe("/lieux");
    expect(destinationSpa(clic({ href: "/lieux?services=Salle de Réunion" }))).toBe("/lieux?services=Salle de Réunion");
    expect(destinationSpa(clic({ target: "_self" }))).toBe("/lieux");
  });

  it("ne fait rien quand le clic n'était pas sur un lien", () => {
    expect(destinationSpa(clic({ href: null }))).toBeNull();
    expect(destinationSpa(clic({ href: "" }))).toBeNull();
  });

  it("laisse le navigateur ouvrir un nouvel onglet (modificateur, bouton secondaire)", () => {
    expect(destinationSpa(clic({ avecModificateur: true }))).toBeNull();
    expect(destinationSpa(clic({ boutonPrincipal: false }))).toBeNull();
  });

  it("laisse passer ce qui demande explicitement autre chose", () => {
    expect(destinationSpa(clic({ target: "_blank" }))).toBeNull();
    expect(destinationSpa(clic({ download: true }))).toBeNull();
    expect(destinationSpa(clic({ dejaTraite: true }))).toBeNull();
  });

  it("garde le comportement natif des ancres, protocoles, externes et placeholders", () => {
    expect(destinationSpa(clic({ href: "#contact" }))).toBeNull();
    expect(destinationSpa(clic({ href: "#" }))).toBeNull();
    expect(destinationSpa(clic({ href: "mailto:contact@exemple.org" }))).toBeNull();
    expect(destinationSpa(clic({ href: "tel:+262692000000" }))).toBeNull();
    expect(destinationSpa(clic({ href: "https://www.cnil.fr" }))).toBeNull();
    expect(destinationSpa(clic({ href: "//cdn.exemple.org/x" }))).toBeNull();
  });
});
