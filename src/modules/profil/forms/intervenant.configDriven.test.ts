/**
 * Costum « parent62-intervenant » — fiche d'une personne qui a marqué le réseau, 100 % config-driven,
 * compilée depuis `config.prod.parent62.json` par la voie UNIQUE du runtime (`registerCostumForm`).
 *
 * Ce que ce test verrouille, parce que chaque point a une conséquence invisible s'il saute :
 *  - `type: "intervenant"` injecté : c'est la clé déclarée dans `costum.typeObj` en base, et le filtre
 *    de l'onglet admin comme de la page publique — un autre type rendrait la fiche introuvable ;
 *  - la photo routée par le bloc `image` (`profil_avatar`) : c'est elle que la carte `portrait` affiche ;
 *  - nom, fonction et présentation obligatoires : la carte n'affiche que le nom et la fonction, la
 *    preview que la présentation — l'un des trois manquant, la fiche montre un trou.
 */
import { describe, it, expect } from "vitest";
import { buildZodSchema } from "@/modules/formEngine/engine/zodGen";
import { costumDoc, loadCostumForm } from "./costum/__fixtures__/configCostum";

const { descriptor } = loadCostumForm("parent62-intervenant");
const schema = buildZodSchema(descriptor);
const messages = (valeurs: Record<string, unknown>) => {
  const r = schema.safeParse(valeurs);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}:${i.message}`);
};

describe("costum parent62-intervenant — document de config", () => {
  const doc = costumDoc("parent62-intervenant") as {
    mutation?: { inject?: { extraFields?: Record<string, unknown> } };
    image?: { field?: string };
  };

  it("compile par la voie unique, en collection poi", () => {
    expect(descriptor.id).toBe("parent62-intervenant");
    expect(descriptor.collection).toBe("poi");
  });

  it("injecte le type `intervenant`, déclaré en base", () => {
    expect(doc.mutation?.inject?.extraFields).toEqual({ type: "intervenant" });
  });

  it("route la photo par le bloc image, et la présentation en markdown", () => {
    expect(doc.image?.field).toBe("profil_avatar");
    expect(descriptor.fields.profil_avatar.widget).toBe("image");
    expect(descriptor.fields.description.widget).toBe("markdown");
  });
});

describe("costum parent62-intervenant — validation", () => {
  const valide = { name: "Ivy Daure", shortDescription: "Psychologue clinicienne", description: "Intervenue en 2025." };

  it("accepte une fiche complète, photo facultative", () => {
    expect(messages(valide)).toEqual([]);
  });

  it("exige le nom, la fonction et la présentation", () => {
    expect(messages({ ...valide, name: "" })).toContain("name:validation.required");
    expect(messages({ ...valide, shortDescription: "" })).toContain("shortDescription:validation.required");
    expect(messages({ ...valide, description: "" })).toContain("description:validation.required");
  });
});
