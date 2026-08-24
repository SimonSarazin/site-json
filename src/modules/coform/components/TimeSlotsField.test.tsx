// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

// useT sort du LocalizationProvider (absent en test) → mock clé/fallback,
// même convention que SmartCoForm.test.tsx.
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, _fallback?: string) => key,
}));

import { TimeSlotsField } from "./TimeSlotsField";
import { DynamicFieldsField } from "./DynamicFieldsField";
import type { DynamicFieldsRow, FormFieldMapping, TimeSlotValue } from "../types";

/**
 * Rendu + interactions des deux répéteurs (`timeSlots` / `dynamicFields`) :
 * le contrat testé est le FORMAT DE DONNÉES émis par onChange — celui des
 * answers legacy réelles (cf. utils/timeSlots.test.ts pour la logique pure).
 */

function makeField(overrides: Partial<FormFieldMapping>): FormFieldMapping {
  return {
    name: "field1",
    label: "Champ",
    type: "tpls.forms.cplx.timeSlots",
    componentType: "timeSlots",
    isRequired: false,
    ...overrides,
  };
}

const REAL_SLOT: TimeSlotValue = { day: "Monday", startHour: "08", startMinute: "00", endHour: "09", endMinute: "00" };

describe("TimeSlotsField", () => {
  it("rend un slot existant (format answers SSBE) dans les inputs time", () => {
    const { container } = render(
      <TimeSlotsField field={makeField({})} errors={{}} value={[REAL_SLOT]} />,
    );
    const times = container.querySelectorAll('input[type="time"]');
    expect(times).toHaveLength(2);
    expect((times[0] as HTMLInputElement).value).toBe("08:00");
    expect((times[1] as HTMLInputElement).value).toBe("09:00");
  });

  it("ajoute un slot pré-rempli des défauts config au format legacy", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <TimeSlotsField
        field={makeField({ timeSlotsConfig: { defaultStartTime: "09:00", defaultEndTime: "17:00" } })}
        errors={{}}
        value={[]}
        onChange={onChange}
      />,
    );
    fireEvent.click(getByRole("button", { name: /addSlot/ }));
    expect(onChange).toHaveBeenCalledWith([
      { day: "", startHour: "09", startMinute: "00", endHour: "17", endMinute: "00" },
    ]);
  });

  it("émet le patch au format legacy quand une heure change", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TimeSlotsField field={makeField({})} errors={{}} value={[REAL_SLOT]} onChange={onChange} />,
    );
    const end = container.querySelectorAll('input[type="time"]')[1] as HTMLInputElement;
    fireEvent.change(end, { target: { value: "10:30" } });
    expect(onChange).toHaveBeenCalledWith([{ ...REAL_SLOT, endHour: "10", endMinute: "30" }]);
  });

  it("signale inline un slot désordonné (fin <= début)", () => {
    const { container } = render(
      <TimeSlotsField
        field={makeField({})}
        errors={{}}
        value={[{ ...REAL_SLOT, endHour: "07" }]}
      />,
    );
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("masque le bouton d'ajout quand enableMultipleSlots=false et 1 slot existe", () => {
    const { queryByRole } = render(
      <TimeSlotsField
        field={makeField({ timeSlotsConfig: { enableMultipleSlots: false } })}
        errors={{}}
        value={[REAL_SLOT]}
      />,
    );
    expect(queryByRole("button", { name: /addSlot/ })).toBeNull();
  });
});

const DYN_FIELD = makeField({
  type: "tpls.forms.cplx.dynamicFields",
  componentType: "dynamicFields",
  dynamicFieldsConfig: {
    enableMultipleRows: true,
    minRows: 1,
    maxRows: 2,
    fieldsConfig: [
      { key: "partnerName", label: "Nom du partenaire", type: "text", required: true },
      { key: "postalCode", label: "Code postal", type: "select", options: { "97430": "97430 - LE TAMPON" } },
    ],
  },
});

describe("DynamicFieldsField", () => {
  it("seed minRows lignes vides au montage (parité legacy)", () => {
    const onChange = vi.fn();
    render(<DynamicFieldsField field={DYN_FIELD} errors={{}} value={[]} onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith([{ partnerName: "", postalCode: "" }]);
  });

  it("rend les sous-champs configurés avec leurs labels et valeurs", () => {
    const rows: DynamicFieldsRow[] = [{ partnerName: "ADAPTETONSPORT", postalCode: "97430" }];
    const { container, getByText } = render(
      <DynamicFieldsField field={DYN_FIELD} errors={{}} value={rows} />,
    );
    getByText("Nom du partenaire");
    expect((container.querySelector('input[type="text"]') as HTMLInputElement).value).toBe("ADAPTETONSPORT");
  });

  it("émet la ligne éditée au format legacy {clé: valeur}", () => {
    const onChange = vi.fn();
    const rows: DynamicFieldsRow[] = [{ partnerName: "", postalCode: "" }];
    const { container } = render(
      <DynamicFieldsField field={DYN_FIELD} errors={{}} value={rows} onChange={onChange} />,
    );
    fireEvent.change(container.querySelector('input[type="text"]') as HTMLInputElement, {
      target: { value: "ADAPTE" },
    });
    expect(onChange).toHaveBeenCalledWith([{ partnerName: "ADAPTE", postalCode: "" }]);
  });

  it("bloque l'ajout au-delà de maxRows", () => {
    const rows: DynamicFieldsRow[] = [
      { partnerName: "A", postalCode: "" },
      { partnerName: "B", postalCode: "" },
    ];
    const { queryByRole } = render(<DynamicFieldsField field={DYN_FIELD} errors={{}} value={rows} />);
    expect(queryByRole("button", { name: /addRow/ })).toBeNull();
  });

  it("ne rend rien sans fieldsConfig (champ inconfiguré côté admin)", () => {
    const empty = makeField({ componentType: "dynamicFields" });
    const { container } = render(<DynamicFieldsField field={empty} errors={{}} value={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
