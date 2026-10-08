/**
 * Formulaire « Proposer un événement » de parent62 (décisions du réseau, 18/09/2026), lues sur la config
 * RÉELLE : un admin du site publie sans validation, et un événement récurrent peut porter la période sur
 * laquelle il se déroule. Deux câblages qu'un renommage casserait en silence.
 */
import { describe, it, expect } from "vitest";
import { loadCostumForm } from "./costum/__fixtures__/configCostum";

describe("parent62-event — modération a priori", () => {
  it("le drapeau de validation ne part QUE pour un non-admin du site", () => {
    const { spec } = loadCostumForm("parent62-event");
    const inject = spec.mutation.inject as Record<string, Record<string, unknown>> | undefined;
    // `extraFields` est posé pour TOUT LE MONDE : le type doit y rester.
    expect(inject?.extraFields).toEqual({ type: "others" });
    expect(inject?.extraFieldsUnlessCostumAdmin).toEqual({ preferences: { toBeValidated: true } });
  });
});

describe("parent62-event — période d'un événement récurrent", () => {
  it("les dates restent affichées en récurrent, et leur codec les conserve", () => {
    const { descriptor } = loadCostumForm("parent62-event");
    expect(descriptor.fields.eventDates?.widgetProps?.datesWhenRecurrent).toBe(true);
    // `eventDate:write` OMET la date en récurrent : ce formulaire a besoin de celui qui la garde.
    expect(descriptor.fields.startDate?.write).toBe("eventDatePeriod:write");
    expect(descriptor.fields.endDate?.write).toBe("eventDatePeriod:write");
  });

  it("la réunion du comité garde le comportement historique (dates masquées en récurrent)", () => {
    const { descriptor } = loadCostumForm("parent62-reunion");
    expect(descriptor.fields.eventDates?.widgetProps?.datesWhenRecurrent).toBeUndefined();
    expect(descriptor.fields.startDate?.write).toBe("eventDate:write");
  });
});
