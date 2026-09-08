import { describe, it, expect } from "vitest";
import { buildReservationPrefill, toTimeSlotDay } from "./reservationPrefill";

const CONF = {
  step: "step2026_0",
  fields: { finder: "fFinder", user: "fUser", activity: "fActivity", slots: "fSlots" },
};

describe("toTimeSlotDay", () => {
  it("capitalise la clé interne pour coller au format stocké", () => {
    expect(toTimeSlotDay("monday")).toBe("Monday");
    expect(toTimeSlotDay("sunday")).toBe("Sunday");
  });
});

describe("buildReservationPrefill", () => {
  it("pose l'équipement dans le finder et le verrouille", () => {
    const { defaultValues, lockedFields } = buildReservationPrefill(CONF, {
      resourceId: "poi1",
      resourceName: "Gymnase",
    });
    expect(defaultValues.step2026_0.fFinderNONE).toBeUndefined();
    expect(defaultValues.step2026_0["finderstep2026_0fFinder"]).toEqual({
      poi1: { id: "poi1", name: "Gymnase", type: "poi" },
    });
    expect(lockedFields).toEqual(["finderstep2026_0fFinder"]);
  });

  it("tolère un nom d'équipement absent", () => {
    const { defaultValues } = buildReservationPrefill(CONF, { resourceId: "poi1" });
    expect(defaultValues.step2026_0["finderstep2026_0fFinder"]).toEqual({
      poi1: { id: "poi1", name: "", type: "poi" },
    });
  });

  it("traduit le créneau au format de stockage legacy", () => {
    const { defaultValues } = buildReservationPrefill(CONF, {
      resourceId: "poi1",
      slot: { day: "thursday", startMinutes: 1020, endMinutes: 1140 },
    });
    expect(defaultValues.step2026_0["step2026_0fSlots"]).toEqual([
      { day: "Thursday", startHour: "17", startMinute: "00", endHour: "19", endMinute: "00" },
    ]);
  });

  it("zéro-padde les heures du matin et gère les demi-heures", () => {
    const { defaultValues } = buildReservationPrefill(CONF, {
      resourceId: "poi1",
      slot: { day: "monday", startMinutes: 510, endMinutes: 570 },
    });
    expect(defaultValues.step2026_0["step2026_0fSlots"]).toEqual([
      { day: "Monday", startHour: "08", startMinute: "30", endHour: "09", endMinute: "30" },
    ]);
  });

  it("n'écrit aucun créneau si aucun n'est choisi", () => {
    const { defaultValues } = buildReservationPrefill(CONF, { resourceId: "poi1" });
    expect(defaultValues.step2026_0["step2026_0fSlots"]).toBeUndefined();
  });
});
