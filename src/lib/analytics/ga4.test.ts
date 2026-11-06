import { describe, it, expect } from "vitest";
import { isValidGa4MeasurementId } from "./ga4";

describe("isValidGa4MeasurementId", () => {
  it("accepte un identifiant de mesure G-… réel", () => {
    expect(isValidGa4MeasurementId("G-ABC123XYZ")).toBe(true);
    expect(isValidGa4MeasurementId(" G-1A2B3C ")).toBe(true);
  });

  it("refuse le placeholder livré dans config.prod.json, le vide, l'ancien UA- et un idSite Matomo", () => {
    expect(isValidGa4MeasurementId("G-XXXXXXX")).toBe(false);
    expect(isValidGa4MeasurementId("g-xxxx")).toBe(false);
    expect(isValidGa4MeasurementId("")).toBe(false);
    expect(isValidGa4MeasurementId("UA-12345-1")).toBe(false);
    expect(isValidGa4MeasurementId("7")).toBe(false);
    expect(isValidGa4MeasurementId(undefined)).toBe(false);
  });
});
