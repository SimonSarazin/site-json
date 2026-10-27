// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../tests/test-utils-ui";
import "../i18n";
import { KpiCards } from "./KpiCards";
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
