// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { scrollToSection } from "./scrollToSection";

/**
 * Tests du défilement vers une section de la page ampli (boutons du hero).
 * jsdom n'implémente ni `scrollIntoView` ni `matchMedia` : les deux sont posés
 * ici, ce sont justement les appels qu'on veut observer.
 */

const scrollIntoView = vi.fn();
let reducedMotion = false;

beforeEach(() => {
  scrollIntoView.mockClear();
  reducedMotion = false;
  Element.prototype.scrollIntoView = scrollIntoView;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion") && reducedMotion,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

function mount(html: string) {
  document.body.innerHTML = html;
}

describe("scrollToSection", () => {
  it("amène la section ciblée à l'écran", () => {
    mount('<section id="cible"></section>');

    scrollToSection("cible");

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  // Un id renommé d'un côté et pas de l'autre ne doit pas jeter : le clic ne
  // fait simplement rien (cf. `AMPLI_SECTION_IDS`, qui évite ce cas).
  it("ne jette pas quand l'ancre n'existe pas", () => {
    expect(() => scrollToSection("absente")).not.toThrow();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("n'anime pas quand l'utilisateur demande moins de mouvement", () => {
    reducedMotion = true;
    mount('<section id="cible"></section>');

    scrollToSection("cible");

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  describe("focus", () => {
    it("pose le focus sur le premier élément interactif de la section", () => {
      mount('<section id="cible"><p>texte</p><input id="premier" /><input id="second" /></section>');

      scrollToSection("cible", { focus: true });

      expect(document.activeElement?.id).toBe("premier");
    });

    it("ne déplace pas le focus sans le demander", () => {
      mount('<section id="cible"><input id="premier" /></section>');

      scrollToSection("cible");

      expect(document.activeElement?.id).not.toBe("premier");
    });

    // Le formulaire est chargé en `lazy()` : au premier clic, la section peut
    // n'être qu'un squelette. Le défilement doit marcher quand même.
    it("défile quand même si la section n'a rien de focalisable", () => {
      mount('<section id="cible"><div>squelette</div></section>');

      expect(() => scrollToSection("cible", { focus: true })).not.toThrow();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });
  });
});
