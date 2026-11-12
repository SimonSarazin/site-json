// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../tests/test-utils-ui";
import "../i18n";
import type { ChartDef, DimensionsConfig } from "../schema";

// Le graphe recharts ne se monte qu'après l'hydratation : on s'arrête au squelette, ce qui suffit à distinguer
// un graphe qui attend sa mesure (sablier, mention) d'un graphe ordinaire.
vi.mock("@/components/layout/ClientOnly", () => ({
  ClientOnly: ({ fallback }: { fallback?: ReactNode }) => <>{fallback}</>,
}));

import { ObservatoryCharts } from "./Charts";

/**
 * Graphes qui lisent la mesure d'usage (review de la MR 120) : pendant le calcul, le sablier des KPI ; sur un
 * échec, une mention — vides, ils se lisaient « aucune donnée ». Un graphe qui ne la lit pas ne change pas.
 */
const DIMS: DimensionsConfig = {
  commune: { paths: ["commune"] },
  type: { paths: ["type"] },
  taux: { paths: ["__usage.rate"], kind: "number" },
};
const TAUX_PAR_COMMUNE: ChartDef = {
  kind: "bars",
  dimension: "commune",
  value: { kind: "avg", dimension: "taux" },
  label: { fr: "Taux moyen par commune" },
};
const TYPES: ChartDef = { kind: "pie", dimension: "type", label: { fr: "Types" } };
const USAGE = new Set(["taux"]);

const carte = (titre: string) => screen.getByText(titre).parentElement!;

describe("ObservatoryCharts — mesure d'usage en calcul ou en échec", () => {
  it("en calcul : le graphe qui lit la mesure (par sa valeur) montre le sablier, l'autre reste un graphe", () => {
    renderWithProviders(
      <ObservatoryCharts charts={[TAUX_PAR_COMMUNE, TYPES]} data={[]} dimensions={DIMS} loadingDimensions={USAGE} />,
    );
    expect(carte("Taux moyen par commune")).toContainElement(screen.getByRole("status"));
    expect(screen.getByRole("status")).toHaveTextContent("Calcul en cours…");
    expect(carte("Types").querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(carte("Types").querySelector('[role="status"]')).toBeNull();
  });

  it("en échec : le graphe le dit au lieu de rester vide", () => {
    renderWithProviders(
      <ObservatoryCharts charts={[TAUX_PAR_COMMUNE, TYPES]} data={[]} dimensions={DIMS} unavailableDimensions={USAGE} />,
    );
    expect(carte("Taux moyen par commune")).toHaveTextContent("Mesure indisponible pour le moment.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(carte("Types")).not.toHaveTextContent("Mesure indisponible pour le moment.");
  });
});
