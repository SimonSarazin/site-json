// @vitest-environment jsdom
/**
 * Champ composite des dates d'un événement. Un événement RÉCURRENT n'affichait que ses horaires : la
 * période sur laquelle il se déroule était donc impossible à saisir (décision du réseau parent62,
 * 18/09/2026). Les autres costums gardent le rendu historique — d'où l'opt-in `datesWhenRecurrent`.
 */
import { describe, it, expect, vi } from "vitest";

// Les libellés viennent du namespace i18n : la clé brute suffit à identifier le champ rendu.
vi.mock("@/hooks/useT", () => ({ useT: () => (k: string) => k }));
import { render, screen } from "@testing-library/react";
import { useForm, FormProvider, type FieldValues } from "react-hook-form";
import { EditEventDatesTab } from "./EditEventDatesTab";

function Harnais({ recurrency, datesWhenRecurrent }: { recurrency: boolean; datesWhenRecurrent?: boolean }) {
  const form = useForm<FieldValues>({ defaultValues: { recurrency, startDate: "", endDate: "", openingHours: [] } });
  return (
    <FormProvider {...form}>
      <EditEventDatesTab form={form} datesWhenRecurrent={datesWhenRecurrent} />
    </FormProvider>
  );
}

/** Les libellés passent par le namespace i18n ; en test, la clé brute suffit à identifier le champ. */
const libelles = () => screen.queryAllByText(/startDate|endDate|periodStart|periodEnd/).map((n) => n.textContent ?? "");

describe("EditEventDatesTab", () => {
  it("ponctuel : les deux dates sont proposées", () => {
    render(<Harnais recurrency={false} />);
    expect(libelles().join(" ")).toMatch(/startDate/);
    expect(libelles().join(" ")).toMatch(/endDate/);
  });

  it("récurrent SANS l'option : aucune date (rendu historique des autres costums)", () => {
    render(<Harnais recurrency={true} />);
    expect(libelles()).toHaveLength(0);
  });

  it("récurrent AVEC l'option : les dates reviennent, en libellés de PÉRIODE", () => {
    render(<Harnais recurrency={true} datesWhenRecurrent />);
    const txt = libelles().join(" ");
    expect(txt).toMatch(/periodStart/);
    expect(txt).toMatch(/periodEnd/);
    expect(txt).not.toMatch(/fields\.startDate/);
  });
});
