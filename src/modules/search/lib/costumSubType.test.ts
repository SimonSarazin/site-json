import { describe, it, expect } from "vitest";
import { expandCostumSubType, formsDeCollection, formDeSousType, cheminAnnotation } from "./costumSubType";

/**
 * L'expansion de `costumSubType` — le pivot du rattachement par sous-type. Ce qu'on verrouille :
 * la FORME du `$or` (objet à clauses mono-champ, la SEULE que le legacy accepte —
 * `SearchNew::searchFilters` construit `array($champ => $valeur)` par entrée, un tableau y
 * produirait un champ « 0 ») et l'inertie totale quand la clé est absente.
 */

const FORMS = {
  "institut-bleu-document": {
    id: "institut-bleu-document", entityType: "poi", costumSlug: "institutBleu",
    subType: "recoveryCenter", identity: { type: "recoveryCenter" },
  },
  "institut-bleu-financement": {
    id: "institut-bleu-financement", entityType: "poi", costumSlug: "institutBleu",
    subType: "financement", identity: { type: "financement" },
  },
  "institut-bleu-acteur": { id: "institut-bleu-acteur", entityType: "organizations", costumSlug: "institutBleu" },
  // Le cas sport-sante : un form « par défaut », SANS identity.
  "autre-generique": { id: "autre-generique", entityType: "organizations", costumSlug: "autre", subType: "generique" },
};

describe("expandCostumSubType", () => {
  it("expanse en $or OBJET { identity, annotation } et retire la clé sucre", () => {
    const sortie = expandCostumSubType(
      { costumSubType: "financement", indexStepList: 12 } as never,
      FORMS, "institutBleu",
    ) as unknown as Record<string, unknown>;
    expect(sortie.costumSubType).toBeUndefined();
    expect(sortie.indexStepList).toBe(12);
    expect(sortie.defaultFilters).toEqual({
      $or: {
        type: "financement",
        [cheminAnnotation("institutBleu")]: "financement",
      },
    });
  });

  it("sans costumSubType : la MÊME référence ressort (aucune queryKey existante ne bouge)", () => {
    const entree = { defaultFilters: { type: "x" } };
    expect(expandCostumSubType(entree as never, FORMS, "institutBleu")).toBe(entree);
  });

  it("préserve les autres defaultFilters et fusionne un $or objet existant", () => {
    const sortie = expandCostumSubType(
      { costumSubType: "recoveryCenter", defaultFilters: { displayAuth: "true", $or: { deja: "la" } } } as never,
      FORMS, "institutBleu",
    ) as unknown as { defaultFilters: Record<string, unknown> };
    expect(sortie.defaultFilters.displayAuth).toBe("true");
    expect(sortie.defaultFilters.$or).toEqual({
      deja: "la",
      type: "recoveryCenter",
      "reference.costumTypes.institutBleu": "recoveryCenter",
    });
  });

  it("form par défaut (identity absente) : branche annotation seule", () => {
    const sortie = expandCostumSubType(
      { costumSubType: "generique" } as never, FORMS, "autre",
    ) as unknown as { defaultFilters: { $or: Record<string, unknown> } };
    expect(sortie.defaultFilters.$or).toEqual({ "reference.costumTypes.autre": "generique" });
  });

  it("sans slug de porteur, inerte (site non costum)", () => {
    const entree = { costumSubType: "financement" };
    expect(expandCostumSubType(entree as never, FORMS, null)).toBe(entree);
  });
});

describe("résolution des forms", () => {
  it("formsDeCollection : les forms d'une collection, costum du site prioritaire", () => {
    expect(formsDeCollection(FORMS, "poi", "institutBleu").map((f) => f.subType))
      .toEqual(["recoveryCenter", "financement"]);
    expect(formsDeCollection(FORMS, "organizations", "institutBleu").map((f) => f.id))
      .toEqual(["institut-bleu-acteur"]);
  });

  it("formDeSousType : retrouve le form par sa clé, borné au site", () => {
    expect(formDeSousType(FORMS, "financement", "institutBleu")?.id).toBe("institut-bleu-financement");
    expect(formDeSousType(FORMS, "generique", "institutBleu")).toBeNull();
  });
});
