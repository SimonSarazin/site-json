import { describe, it, expect } from "vitest";
import { dimensionValue, filterValueMap, withFilterValueMaps, type FilterOptionLike } from "./dimensions";
import type { DimensionsConfig } from "./schema";

/** Libellé de test : la version française d'un libellé localisé. */
const label = (l: FilterOptionLike["label"]) => (typeof l === "string" ? l : l.fr);

/** Options du filtre « Code postal » de la page Équipements d'ESS974 (extrait). */
const COMMUNES: FilterOptionLike[] = [
  { label: { fr: "Saint-Paul (97411, 97434)" }, values: ["97411", "97434"] },
  { label: { fr: "Le Tampon (97418, 97430)" }, values: ["97418", "97430"] },
  { label: "Cilaos", value: "97413" },
];

describe("filterValueMap", () => {
  it("chaque valeur interrogée par une option → le libellé de l'option", () => {
    expect(filterValueMap(COMMUNES, label)).toEqual({
      "97411": "Saint-Paul (97411, 97434)",
      "97434": "Saint-Paul (97411, 97434)",
      "97418": "Le Tampon (97418, 97430)",
      "97430": "Le Tampon (97418, 97430)",
      "97413": "Cilaos",
    });
  });

  it("une valeur revendiquée deux fois garde la première option ; une option sans valeur ne compte pas", () => {
    const map = filterValueMap([{ label: "A", values: ["1"] }, { label: "B", values: ["1", "2"] }, { label: "C" }], label);
    expect(map).toEqual({ "1": "A", "2": "B" });
  });
});

describe("withFilterValueMaps", () => {
  const dims: DimensionsConfig = {
    commune: { paths: ["address.postalCode"], valueMapFrom: { filter: "poi-postalCode" }, valueMap: { "97413": "CILAOS" } },
    type: { paths: ["equip_type_name"] },
  };
  const optionsOf = (id: string) => (id === "poi-postalCode" ? COMMUNES : undefined);

  it("résout la valueMap depuis le filtre ; la valueMap déclarée prime", () => {
    const out = withFilterValueMaps(dims, optionsOf, label);
    expect(out.commune.valueMap).toMatchObject({ "97434": "Saint-Paul (97411, 97434)", "97413": "CILAOS" });
    expect(out.type).toBe(dims.type);
    // La dimension lit désormais la commune, plus le code postal.
    expect(dimensionValue({ address: { postalCode: "97434" } }, out.commune)).toBe("Saint-Paul (97411, 97434)");
    // Code absent du filtre : la valeur brute, sans erreur.
    expect(dimensionValue({ address: { postalCode: "97999" } }, out.commune)).toBe("97999");
  });

  it("filtre introuvable ou aucun valueMapFrom : les dimensions reçues, inchangées", () => {
    expect(withFilterValueMaps(dims, () => undefined, label)).toBe(dims);
    const sans: DimensionsConfig = { type: { paths: ["equip_type_name"] } };
    expect(withFilterValueMaps(sans, optionsOf, label)).toBe(sans);
  });
});
