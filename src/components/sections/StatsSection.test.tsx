// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

vi.mock("@/components/layout/i18n", () => ({}));
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
