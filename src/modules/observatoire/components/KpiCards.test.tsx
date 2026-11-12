// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../tests/test-utils-ui";
import "../i18n";
import { KpiCards } from "./KpiCards";
import { PLACEHOLDER } from "../dashboard";
import type { KpiDef } from "../schema";

/**
 * `KpiCards` en ligne (`layout: "inline"`) : un KPI `reservationHours` montre un sablier pendant le calcul, comme
 * la carte (`KpiCard`) — « — » s'y lisait comme une absence de données (review de la MR 114).
 */
const KPIS: KpiDef[] = [{ kind: "reservationHours", label: { fr: "Heures / semaine" }, unit: "h" }];

describe("KpiCards — disposition en ligne", () => {
  it("un sablier pendant le calcul des heures, puis la valeur", () => {
    const { rerender } = renderWithProviders(
      <KpiCards data={[]} dimensions={{}} kpis={KPIS} layout="inline" reservationHoursLoading />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Calcul en cours…");
    expect(screen.queryByText("—")).not.toBeInTheDocument();

    rerender(
      <KpiCards
        data={[]}
        dimensions={{}}
        kpis={KPIS}
        layout="inline"
        reservationHours={{ weeklyMinutes: 750, cumulativeMinutes: 0 }}
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("12,5 h")).toBeInTheDocument();
  });
});

describe("KpiCards — mesure d'usage en cours de calcul", () => {
  it("le KPI d'une dimension encore en calcul montre le sablier, les autres leur valeur", () => {
    const kpis: KpiDef[] = [
      { kind: "sum", dimension: "heuresClubs", unit: "h", label: { fr: "Heures clubs", en: "Club hours" } },
      { kind: "count", label: { fr: "Équipements", en: "Facilities" } },
    ];
    renderWithProviders(
      <KpiCards
        data={[{}, {}]}
        dimensions={{ heuresClubs: { paths: ["__usage.clubHours"], kind: "number" } }}
        kpis={kpis}
        layout="inline"
        loadingDimensions={new Set(["heuresClubs"])}
      />,
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("dimension indisponible (mesure en échec) → « — », ni sablier ni 0 % trompeur", () => {
    const kpis: KpiDef[] = [
      { kind: "percentTrue", dimension: "ouvert", label: { fr: "Part des ouverts", en: "Open share" } },
      { kind: "count", label: { fr: "Équipements", en: "Facilities" } },
    ];
    renderWithProviders(
      <KpiCards
        data={[{}, {}]}
        dimensions={{ ouvert: { paths: ["__usage.open"], kind: "anyTrue" } }}
        kpis={kpis}
        layout="inline"
        unavailableDimensions={new Set(["ouvert"])}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText(PLACEHOLDER)).toBeInTheDocument();
    expect(screen.queryByText("0%")).toBeNull();
  });
});
