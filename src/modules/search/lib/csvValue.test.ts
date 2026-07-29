import { describe, expect, it } from "vitest";
import { csvValue } from "./csvValue";

describe("csvValue — formes réelles du backend", () => {
  it("scalaires", () => {
    expect(csvValue("Institut Bleu")).toBe("Institut Bleu");
    expect(csvValue(42)).toBe("42");
    expect(csvValue(true)).toBe("true");
    expect(csvValue(null)).toBe("");
    expect(csvValue(undefined)).toBe("");
  });

  it("tableau de chaînes → valeurs jointes, vides écartés", () => {
    expect(csvValue(["Plongée", "Voile"])).toBe("Plongée, Voile");
    expect(csvValue(["Plongée", "", null, "Voile"])).toBe("Plongée, Voile");
    expect(csvValue([])).toBe("");
  });

  it("`otherSociaNetworks` : tableau d'objets → les liens (avant : « [object Object] »)", () => {
    const value = [
      { type: "Lien vers le profil LinkedIn", link: "https://linkedin.com/company/ib" },
      { type: "Lien vers le profil Facebook", link: "" },
      { type: "Instagram", link: "https://instagram.com/ib" },
    ];
    expect(csvValue(value)).toBe("https://linkedin.com/company/ib, https://instagram.com/ib");
  });

  it("`telephone` : objet composite → le numéro (avant : « mobile », la CLÉ)", () => {
    expect(csvValue({ mobile: ["0262420340"] })).toBe("0262420340");
    expect(csvValue({ fixe: ["0262111111"], mobile: ["0692222222"] })).toBe("0692222222");
  });

  it("objet-ensemble (toutes les valeurs à true) → ses clés", () => {
    expect(csvValue({ Plongée: true, Voile: true })).toBe("Plongée, Voile");
  });

  it("objet sans clé signifiante → ses valeurs, jamais ses clés", () => {
    expect(csvValue({ a: "un", b: "deux" })).toBe("un, deux");
  });

  it("adresse imbriquée : la clé signifiante l'emporte", () => {
    expect(csvValue({ "@type": "PostalAddress", name: "Port Ouest" })).toBe("Port Ouest");
  });

  it("structure profonde ou cyclique : borne de profondeur, pas de plantage", () => {
    const deep = { a: { b: { c: { d: { e: "trop loin" } } } } };
    expect(csvValue(deep)).toBe("");
    const cyclic: Record<string, unknown> = { x: "ok" };
    cyclic.self = cyclic;
    expect(() => csvValue(cyclic)).not.toThrow();
  });

  it("Date → ISO ; date invalide → vide", () => {
    expect(csvValue(new Date("2026-06-13T06:13:32Z"))).toBe("2026-06-13T06:13:32.000Z");
    expect(csvValue(new Date("nope"))).toBe("");
  });
});
