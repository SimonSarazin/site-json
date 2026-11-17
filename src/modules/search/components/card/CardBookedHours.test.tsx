// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListConf } from "../../schema";

/** Les heures sont calculées par `useOrgaBookedHours` (testé à part) : simulé ici, on regarde le rendu. */
const etat = vi.hoisted(() => ({
  valeur: { hours: undefined as { weeklyMinutes: number; cumulativeMinutes: number } | undefined, loading: false, failed: false },
  appels: [] as unknown[][],
}));
vi.mock("../../hooks/useOrgaBookedHours", () => ({
  useOrgaBookedHours: (...args: unknown[]) => {
    etat.appels.push(args);
    return etat.valeur;
  },
}));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));

import CardBookedHours from "./CardBookedHours";

const LIST = {
  preview: {
    reservations: { form: "f", step: "s", fields: { finder: "fi", slots: "sl" } },
    bookedResources: { hours: true },
  },
} as unknown as ListConf;

beforeEach(() => {
  etat.valeur = { hours: undefined, loading: false, failed: false };
  etat.appels = [];
});

describe("CardBookedHours", () => {
  it("les deux indicateurs de la fiche, d'après les réservations et le périmètre de la fiche", () => {
    etat.valeur.hours = { weeklyMinutes: 750, cumulativeMinutes: 6000 };
    render(<CardBookedHours orgaId="o1" list={LIST} />);
    expect(etat.appels[etat.appels.length - 1]).toEqual(["o1", LIST.preview!.reservations, LIST.preview!.bookedResources]);
    expect(screen.getByText("PreviewReservations.kpiWeekly")).toBeInTheDocument();
    expect(screen.getByText("12,5")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("un sablier pendant la lecture ; « — » sur un échec, jamais un 0 trompeur", () => {
    etat.valeur = { hours: undefined, loading: true, failed: false };
    const { rerender } = render(<CardBookedHours orgaId="o1" list={LIST} />);
    expect(screen.getAllByRole("status")).toHaveLength(2);

    etat.valeur = { hours: undefined, loading: false, failed: true };
    rerender(<CardBookedHours orgaId="o1" list={LIST} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.queryByText("0")).toBeNull();
  });

  it("une organisation sans créneau : 0, comme sa fiche", () => {
    etat.valeur.hours = { weeklyMinutes: 0, cumulativeMinutes: 0 };
    render(<CardBookedHours orgaId="o1" list={LIST} />);
    expect(screen.getAllByText("0")).toHaveLength(2);
  });
});
