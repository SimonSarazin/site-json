import { describe, it, expect } from "vitest";

import type { CostumFormDescriptor } from "@communecter/cocolight-api-client";

import { descriptorToConfig } from "./costumToConfig";
import { JsonFormConfigSchema } from "./schema";

/**
 * Voie B RUNTIME (RFC fil C / F5-C3) : la sortie de `scope.describeForm()` de la lib (CostumFormDescriptor)
 * se convertit directement en JsonFormConfig valide — c'est le chaînon exploité par `useCostumFormLive`
 * pour générer un form costum sans `config.costumForms` ni re-publication.
 */
describe("descriptorToConfig — voie B (describeForm live → JsonFormConfig)", () => {
  // Forme EXACTE de ce que renvoie describeForm() (cf. lib runtime.ts / digestion getcostumjson).
  const desc: CostumFormDescriptor = {
    slug: "monCostum",
    collection: "poi",
    costumId: "6a04155ed047177b92399685",
    costumType: "organizations",
    add: true,
    createLabel: "Ajouter un équipement",
    presets: { type: "recoveryCenter" },
    hidden: ["type"],
    fields: [
      { name: "equip_sol", path: "equip_sol", type: "string", multiple: false, enum: ["Bitume", "Gazon"], hidden: false },
      { name: "aps_name", path: "aps_name", type: "array", multiple: true, hidden: false },
      { name: "equip_surf", path: "equip_surf", type: "number", multiple: false, hidden: false },
      { name: "equip_date", path: "equip_date", type: "date", multiple: false, hidden: false },
    ],
  };

  const config = descriptorToConfig(desc);

  it("produit une JsonFormConfig VALIDE (schéma Zod)", () => {
    expect(config).not.toBeNull();
    expect(JsonFormConfigSchema.safeParse(config).success).toBe(true);
  });

  it("porte les champs costum avec widgets dérivés du type", () => {
    const fields = config!.fields as Record<string, { widget?: string; type?: string; multiple?: boolean; enum?: { value: string; label: string }[] }>;
    expect(fields.equip_sol.enum).toEqual([{ value: "Bitume", label: "Bitume" }, { value: "Gazon", label: "Gazon" }]);
    expect(fields.aps_name).toMatchObject({ type: "array", multiple: true });
    expect(fields.equip_surf).toMatchObject({ type: "number", widget: "number" });
    expect(fields.equip_date).toMatchObject({ type: "date", widget: "date" });
  });

  it("collection sans champ costum → config vide/nulle (l'appelant retombe sur le form standard)", () => {
    const empty: CostumFormDescriptor = { ...desc, fields: [] };
    const c = descriptorToConfig(empty);
    // pas de champ costum : config nulle OU sans field costum — dans les deux cas, pas de form dérivé utile.
    expect(c === null || Object.keys((c!.fields ?? {}) as object).length === 0).toBe(true);
  });
});
