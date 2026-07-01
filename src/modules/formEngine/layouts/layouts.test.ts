import { describe, it, expect } from "vitest";
import { getLayout, registerLayout } from "./index";

describe("getLayout / registerLayout", () => {
  it("retourne un composant pour les layouts fournis", () => {
    expect(getLayout("flat")).toBeTruthy();
    expect(getLayout("wizard")).toBeTruthy();
    expect(getLayout("tabs")).toBeTruthy();
  });

  it("fallback sur flat pour un kind inconnu", () => {
    expect(getLayout("inconnu")).toBe(getLayout("flat"));
  });

  it("registerLayout ajoute/écrase un layout", () => {
    const comp = () => null;
    registerLayout("custom-x", comp);
    expect(getLayout("custom-x")).toBe(comp);
  });
});
