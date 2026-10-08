// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";

/**
 * Boutons du héros `hero-quick-access` : une ANCRE (`#id`) doit faire défiler vers la section, comme
 * dans CTASection (contrat `classifyHref`). En <Link> React Router, l'URL changeait mais la page ne
 * bougeait pas — bouton « Déposer une demande » de /habilitation-mss (SSBE), review de la MR
 * `n-dev` → `main`. Les autres voies ne changent pas (alignement complet = lot dédié).
 */
vi.mock("@/hooks/useLocalization", () => ({
  useLocalization: () => ({ t: (v: unknown) => (typeof v === "string" ? v : (v as { fr?: string })?.fr ?? "") }),
}));

import HeroQuickAccess from "./HeroQuickAccess";

const hero = (path: string) => (
  <MemoryRouter initialEntries={["/habilitation-mss"]}>
    <HeroQuickAccess props={{ headline: { fr: "Habilitation" }, ctaButtons: [{ label: { fr: "Déposer une demande" }, path }] } as never} />
    <section id="habilitation-procedure-steps">Étapes</section>
  </MemoryRouter>
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("HeroQuickAccess — boutons", () => {
  it("ancre : fait défiler en douceur vers la section ciblée", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(hero("#habilitation-procedure-steps"));
    const bouton = screen.getByText("Déposer une demande");
    expect(bouton.getAttribute("href")).toBe("#habilitation-procedure-steps");
    fireEvent.click(bouton);
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth" });
    expect(scroll.mock.contexts[0]).toBe(document.getElementById("habilitation-procedure-steps"));
  });

  it("chemin interne : reste un lien de navigation SPA (inchangé)", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(hero("/mss"));
    const bouton = screen.getByText("Déposer une demande");
    expect(bouton.getAttribute("href")).toBe("/mss");
    fireEvent.click(bouton);
    expect(scroll).not.toHaveBeenCalled();
  });
});
