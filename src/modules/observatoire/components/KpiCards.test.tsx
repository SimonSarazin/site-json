// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
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

describe("KpiCards — KPI cliquables (`kpi.filter`)", () => {
  const kpis: KpiDef[] = [
    { kind: "percentTrue", dimension: "pmr", label: { fr: "Accessible PMR", en: "PMR" }, filter: { dimension: "pmr" } },
    { kind: "count", label: { fr: "Équipements", en: "Facilities" } },
    { kind: "sum", dimension: "heures", unit: "h", label: { fr: "Heures clubs", en: "Club hours" }, filter: { dimension: "statut", where: "planifie" } },
  ];
  const dimensions = {
    pmr: { paths: ["pmr"], kind: "anyTrue" as const },
    heures: { paths: ["__usage.clubHours"], kind: "number" as const },
  };

  it("une carte à filtre est un bouton nommé par son libellé ET son chiffre, l'action en description ; clic → onFilter(index), état en place annoncé ; les autres restent inertes", () => {
    const onFilter = vi.fn();
    renderWithProviders(
      <KpiCards
        data={[{ pmr: true }, {}]}
        dimensions={dimensions}
        kpis={kpis}
        filterStates={[{ active: true }, null, { active: false }]}
        onFilter={onFilter}
      />,
    );
    // Un lecteur d'écran annonce le chiffre de la carte, pas seulement l'action.
    const pmr = screen.getByRole("button", { name: /^Accessible PMR\s*50\s*%$/ });
    expect(pmr).toHaveAccessibleDescription("Retirer le filtre : Accessible PMR");
    expect(pmr).toHaveAttribute("aria-pressed", "true");
    const heures = screen.getByRole("button", { name: /^Heures clubs/ });
    expect(heures).toHaveAccessibleDescription("Filtrer la liste et les graphiques : Heures clubs");
    expect(heures).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("button")).toHaveLength(2);

    fireEvent.click(heures);
    fireEvent.keyDown(pmr, { key: "Enter" });
    expect(onFilter.mock.calls).toEqual([[2], [0]]);
  });

  it("pendant le calcul de sa mesure, la carte n'est pas cliquable", () => {
    renderWithProviders(
      <KpiCards
        data={[{}]}
        dimensions={dimensions}
        kpis={kpis}
        filterStates={[null, null, { active: false }]}
        onFilter={vi.fn()}
        loadingDimensions={new Set(["heures"])}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
