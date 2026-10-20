/**
 * Costum « parent62-inforeso » — formulaire d'un numéro de la lettre INFORESO, 100 % config-driven,
 * compilé depuis `config.prod.parent62.json` par la voie UNIQUE du runtime (`registerCostumForm`).
 *
 * Ce que ce test verrouille, parce que chaque point a une conséquence invisible s'il saute :
 *  - `type: "doc"` injecté : c'est la CLÉ native du type « Documentation » (`Poi::$types` du backend),
 *    déclarée comme sous-type dans `costum.typeObj` en base ;
 *    un autre type ferait retomber la fiche hors de l'onglet admin et de la page publique ;
 *  - le PDF matérialisé dans `medias` (`mediaTarget`) : sans lui, l'URL du fichier téléversé reste
 *    dans la collection des documents et la page INFORESO n'a aucun lien à ouvrir ;
 *  - l'année en saisie libre BORNÉE : « 22 » ou « 20222 » rangeraient le numéro dans un bloc absurde ;
 *  - la règle « document OU lien » : une fiche sans l'un ni l'autre serait une ligne morte.
 */
import { describe, it, expect } from "vitest";
import { buildZodSchema } from "@/modules/formEngine/engine/zodGen";
import { costumDoc, loadCostumForm } from "./costum/__fixtures__/configCostum";
import "./validators"; // enregistre `validate:documentOuLien`

const { descriptor } = loadCostumForm("parent62-inforeso");
const schema = buildZodSchema(descriptor);
const sansFichier = { added: [], existing: [], removedDocIds: [], contentKey: "file" };
const messages = (valeurs: Record<string, unknown>) => {
  const r = schema.safeParse(valeurs);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}:${i.message}`);
};

describe("costum parent62-inforeso — document de config", () => {
  it("compile par la voie unique, en collection poi", () => {
    expect(descriptor.id).toBe("parent62-inforeso");
    expect(descriptor.collection).toBe("poi");
  });

  it("injecte le type natif `doc` (libellé « Documentation »), déclaré en base", () => {
    const doc = costumDoc("parent62-inforeso") as { mutation?: { inject?: { extraFields?: Record<string, unknown> } } };
    expect(doc.mutation?.inject?.extraFields).toEqual({ type: "doc" });
  });

  it("matérialise le PDF téléversé dans `medias`, en type `pdf`", () => {
    const props = descriptor.fields.documents.widgetProps as Record<string, unknown>;
    expect(props.mediaTarget).toEqual({ field: "medias", type: "pdf" });
    expect(props.accept).toBe("application/pdf");
    expect(props.maxItems).toBe(1);
  });

  it("présente l'année en saisie libre, pas en sélecteur", () => {
    expect(descriptor.fields.annee.widget).toBe("number");
  });
});

describe("costum parent62-inforeso — validation", () => {
  const valide = { name: "INFORESO n°74 – Octobre 2022", annee: 2022, documents: sansFichier, urls: ["https://x.org/74.pdf"] };

  it("accepte un numéro complet", () => {
    expect(messages(valide)).toEqual([]);
  });

  it("exige le titre et l'année", () => {
    expect(messages({ ...valide, name: "" })).toContain("name:validation.required");
    expect(messages({ ...valide, annee: undefined })).toContain("annee:validation.required");
  });

  it("refuse une année hors bornes, avec le message dédié", () => {
    expect(messages({ ...valide, annee: 22 })).toContain("annee:validation.annee.invalid");
    expect(messages({ ...valide, annee: 20222 })).toContain("annee:validation.annee.invalid");
  });

  it("refuse une fiche sans document NI lien", () => {
    expect(messages({ ...valide, urls: [] })).toContain("documents:validation.documentOuLien.required");
  });

  it("accepte un PDF seul, sans lien", () => {
    const pdf = { ...sansFichier, added: [new File(["x"], "inforeso-74.pdf")] };
    expect(messages({ ...valide, documents: pdf, urls: [] })).toEqual([]);
  });
});
