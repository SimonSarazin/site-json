// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { preloadAll } from "vite-preload";
import type { StatsSectionProps } from "@/types/site-schema";

/**
 * Le design `tiles` : la tuile `highlight` sur l'aplat primaire, les autres sur `card` ; le chiffre
 * compté passe par `StatValue` (contrat d'attente / absence testé dans `StatValue.test.tsx`). Le
 * décompte AAC est doublé une couche sous son hook d'état.
 */

const state = vi.hoisted(() => ({
  aacCount: { count: null as number | null, isLoading: false, error: null as Error | null },
}));

vi.mock("./i18n/i18n", () => ({}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/hooks/useT", () => ({
  useT: () => (k: unknown) => (typeof k === "string" ? k : (k as { fr: string }).fr),
}));
vi.mock("lucide-react/dynamic", () => ({ DynamicIcon: () => <span /> }));
vi.mock("@/modules/aac/hooks/useAacDirectoryContext", () => ({
  useAacDirectoryContext: () => ({ formId: "form-1", resolved: {}, isFormLoading: false, configError: null }),
}));
vi.mock("@/modules/aac/hooks/useAacCommunsCount", () => ({
  useAacCommunsCount: () => state.aacCount,
}));

import { StatsSection } from "./StatsSection";

const tiles = (items: StatsSectionProps["items"]): StatsSectionProps => ({
  design: "tiles",
  layout: "horizontal",
  animated: true,
  items,
});

// La tuile AAC est un chunk `lazy()` : préchargé comme le fait `entry-server.tsx`.
beforeAll(async () => {
  await preloadAll();
});

beforeEach(() => {
  state.aacCount = { count: null, isLoading: false, error: null };
});

describe("StatsSection — design tiles", () => {
  it("chiffre compté sur la tuile `highlight` (aplat primaire), chiffre écrit sur `card`", () => {
    state.aacCount = { count: 144, isLoading: false, error: null };
    render(
      <StatsSection
        id="chiffres"
        props={tiles([
          { label: { fr: "projets publiés" }, source: { type: "aacCommuns" }, highlight: true },
          { label: { fr: "partenaires" }, value: "12" },
        ])}
      />,
    );
    expect(screen.getByText("144").closest(".rounded-2xl")?.className).toContain("bg-primary");
    expect(screen.getByText("12").closest(".rounded-2xl")?.className).toContain("bg-card");
    expect(screen.getByText("projets publiés")).toBeTruthy();
  });

  it("le squelette d'attente vit dans un bloc, pas dans un <span> (HTML valide)", () => {
    const { container } = render(
      <StatsSection props={tiles([{ label: { fr: "projets publiés" }, source: { type: "aacCommuns" } }])} />,
    );
    const skeleton = container.querySelector('[data-slot="skeleton"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton?.parentElement?.tagName).toBe("DIV");
  });

  it("le design par défaut accepte aussi un chiffre compté", () => {
    state.aacCount = { count: 37, isLoading: false, error: null };
    render(
      <StatsSection
        props={{ layout: "horizontal", animated: false, items: [{ label: { fr: "communs" }, source: { type: "aacCommuns" } }] }}
      />,
    );
    expect(screen.getByText("37")).toBeTruthy();
  });
});

/**
 * Design par défaut ANIMÉ : le chiffre monte de 0 à sa valeur à l'entrée à l'écran, une seule fois.
 * Piège d'origine : `AnimatedNumber` était déclaré DANS la section — un nouveau composant à chaque
 * rendu, donc remonté à « 0 » ; un compte arrivé après l'animation la relançait 0 → N.
 */
describe("StatsSection — design par défaut animé", () => {
  let entrerALEcran: () => void = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(private readonly callback: IntersectionObserverCallback) {
          entrerALEcran = () =>
            this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const animee = (items: StatsSectionProps["items"]): StatsSectionProps => ({ layout: "horizontal", animated: true, items });

  it("le rendu serveur porte le chiffre réel, pas « 0 »", () => {
    const html = renderToString(<StatsSection id="chiffres" props={animee([{ label: { fr: "bénévoles" }, value: "120" }])} />);
    expect(html).toContain("<span>120</span>");
    expect(html).not.toContain("<span>0</span>");
  });

  it("un compte arrivé APRÈS l'animation s'affiche tel quel, sans repartir de 0", () => {
    const items: StatsSectionProps["items"] = [{ label: { fr: "communs" }, value: "10", source: { type: "aacCommuns" } }];
    const { rerender } = render(<StatsSection id="chiffres" props={animee(items)} />);

    act(() => entrerALEcran());
    act(() => vi.advanceTimersByTime(2100));
    expect(screen.getByText("10")).toBeTruthy();

    state.aacCount = { count: 144, isLoading: false, error: null };
    rerender(<StatsSection id="chiffres" props={animee(items)} />);

    expect(screen.getByText("144")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("un compte qui arrive quand la section est DÉJÀ à l'écran s'affiche tel quel (pas N → 0 → N)", () => {
    const items: StatsSectionProps["items"] = [{ label: { fr: "communs" }, source: { type: "aacCommuns" } }];
    const { rerender } = render(<StatsSection id="chiffres" props={animee(items)} />);
    act(() => entrerALEcran());

    state.aacCount = { count: 144, isLoading: false, error: null };
    rerender(<StatsSection id="chiffres" props={animee(items)} />);
    expect(screen.getByText("144")).toBeTruthy();
    act(() => vi.advanceTimersByTime(40));
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByText("144")).toBeTruthy();
  });

  it("animation interrompue par un compte : la valeur s'affiche, aucune image intermédiaire ne reste figée", () => {
    const items: StatsSectionProps["items"] = [{ label: { fr: "communs" }, value: "1000", source: { type: "aacCommuns" } }];
    const { rerender } = render(<StatsSection id="chiffres" props={animee(items)} />);

    act(() => entrerALEcran());
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByText("1000")).toBeNull(); // en pleine montée

    state.aacCount = { count: 144, isLoading: false, error: null };
    rerender(<StatsSection id="chiffres" props={animee(items)} />);
    act(() => vi.advanceTimersByTime(3000));

    expect(screen.getByText("144")).toBeTruthy();
  });
});
