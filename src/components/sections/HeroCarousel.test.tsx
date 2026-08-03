// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { screen, renderWithProviders } from "../../../tests/test-utils-ui";
import HeroCarousel from "./HeroCarousel";
import type { HeroCarouselProps } from "@/types/site-schema";

/**
 * Machine à états de la rotation du héro à diapositives.
 *
 * Pourquoi ce test EXISTE : ce chemin est invérifiable au navigateur piloté. Chrome
 * déclare `document.hidden = true` dès que sa fenêtre n'est pas au premier plan — ce que
 * le composant honore, à raison, en suspendant la rotation — et il suspend en outre les
 * défilements `behavior: "smooth"` dans un onglet en arrière-plan. Une session
 * d'automatisation ne peut donc PAS observer l'auto-avance, et l'absence de mouvement y
 * est indiscernable d'un bug. Constaté le 2026-07-30, d'où ce test.
 *
 * jsdom n'implémente ni `scrollTo` ni la mise en page : on stube le premier et on force
 * `clientWidth`, ce qui suffit — l'objet du test est la DÉCISION de faire tourner, pas
 * le rendu du défilement.
 */

const LARGEUR = 1000;

/** Diapositives minimales : le test porte sur la rotation, pas sur le contenu. */
function slides(n: number): HeroCarouselProps["slides"] {
  return Array.from({ length: n }, (_, i) => ({
    headline: { fr: `Diapo ${i + 1}` },
    backgroundImage: `/img/${i}.jpg`,
  }));
}

/** Piste courante + son historique d'appels à scrollTo. */
function piste() {
  const el = document.querySelector<HTMLElement>(".snap-x");
  if (!el) throw new Error("piste introuvable");
  return el;
}

let scrollTo: ReturnType<typeof vi.fn>;
let reduit = false;

beforeEach(() => {
  vi.useFakeTimers();
  reduit = false;

  // matchMedia n'existe pas dans jsdom.
  vi.stubGlobal(
    "matchMedia",
    vi.fn((q: string) => ({
      matches: q.includes("prefers-reduced-motion") ? reduit : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }))
  );

  scrollTo = vi.fn(function (this: HTMLElement, o: ScrollToOptions) {
    // Simule le défilement instantané : c'est `scrollLeft` que relit le composant.
    if (typeof o?.left === "number") this.scrollLeft = o.left;
  });
  Object.defineProperty(Element.prototype, "scrollTo", { configurable: true, value: scrollTo });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => LARGEUR });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function rendre(props: Partial<HeroCarouselProps> = {}) {
  return renderWithProviders(
    <HeroCarousel props={{ slides: slides(4), autoplay: true, autoplayIntervalMs: 5000, ...props }} />
  );
}

describe("HeroCarousel — rotation", () => {
  it("avance tout seul quand autoplay est actif", () => {
    rendre();
    expect(piste().scrollLeft).toBe(0);

    act(() => { vi.advanceTimersByTime(5000); });
    expect(piste().scrollLeft, "1er tour").toBe(LARGEUR);

    act(() => { vi.advanceTimersByTime(5000); });
    expect(piste().scrollLeft, "2e tour").toBe(LARGEUR * 2);
  });

  it("revient à la première diapositive après la dernière", () => {
    rendre({ slides: slides(2) });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(piste().scrollLeft).toBe(LARGEUR);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(piste().scrollLeft, "boucle sur 0").toBe(0);
  });

  it("n'avance PAS sans autoplay — c'est le défaut du composant", () => {
    rendre({ autoplay: undefined });
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /défilement/i }),
      "sans rotation, pas de bouton d'arrêt à afficher"
    ).toBeNull();
  });

  it("n'avance PAS sous prefers-reduced-motion, et masque le bouton d'arrêt", () => {
    reduit = true;
    rendre();
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(scrollTo, "le plancher CSS ne peut rien contre un setInterval — d'où la garde JS").not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /défilement/i })).toBeNull();
  });

  it("n'avance PAS avec une seule diapositive, et masque puces et flèches", () => {
    rendre({ slides: slides(1) });
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Diapositive suivante/i })).toBeNull();
  });

  it("le bouton d'arrêt suspend la rotation, et la reprend", () => {
    rendre();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(piste().scrollLeft).toBe(LARGEUR);

    const arret = screen.getByRole("button", { name: /Arrêter le défilement/i });
    act(() => { arret.click(); });
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(piste().scrollLeft, "à l'arrêt, plus rien ne bouge").toBe(LARGEUR);

    const reprise = screen.getByRole("button", { name: /Reprendre le défilement/i });
    act(() => { reprise.click(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(piste().scrollLeft, "la reprise doit vraiment repartir").toBe(LARGEUR * 2);
  });

  it("aria-live bascule off pendant la rotation, polite à l'arrêt", () => {
    const { container } = rendre();
    const live = () => container.querySelector("[aria-live]")?.getAttribute("aria-live");
    expect(live(), "en rotation, ne pas interrompre la lecture d'écran").toBe("off");

    act(() => { screen.getByRole("button", { name: /Arrêter le défilement/i }).click(); });
    expect(live(), "à l'arrêt, le changement vient de l'utilisateur : il doit être annoncé").toBe("polite");
  });

  it("le bouton d'arrêt est le PREMIER contrôle dans l'ordre de tabulation (APG)", () => {
    const { container } = rendre();
    const libelles = [...container.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
    expect(libelles[0]).toMatch(/Arrêter le défilement/);
  });

  it("chaque diapositive porte un nom INDEXÉ, pas un libellé constant", () => {
    const { container } = rendre();
    const noms = [...container.querySelectorAll('[aria-roledescription="slide"]')].map((s) =>
      s.getAttribute("aria-label")
    );
    expect(noms).toEqual([
      "Diapositive 1 sur 4",
      "Diapositive 2 sur 4",
      "Diapositive 3 sur 4",
      "Diapositive 4 sur 4",
    ]);
  });

  it("rend TOUTES les diapositives dans le DOM — le socle doit tenir sans JavaScript", () => {
    const { container } = rendre();
    expect(container.querySelectorAll('[aria-roledescription="slide"]')).toHaveLength(4);
    expect(container.querySelectorAll("img")).toHaveLength(4);
  });

  it("une seule image en chargement prioritaire, les suivantes dépriorisées", () => {
    const { container } = rendre();
    const imgs = [...container.querySelectorAll("img")];
    expect(imgs.map((i) => i.getAttribute("loading"))).toEqual(["eager", "lazy", "lazy", "lazy"]);
    expect(imgs.map((i) => i.getAttribute("fetchpriority"))).toEqual(["high", "low", "low", "low"]);
  });

  it("sans diapositive, la section ne rend rien plutôt qu'une coquille vide", () => {
    const { container } = rendre({ slides: [] });
    expect(container.innerHTML).toBe("");
  });
});
