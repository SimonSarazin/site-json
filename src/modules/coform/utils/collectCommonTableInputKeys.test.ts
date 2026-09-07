import { describe, expect, it } from "vitest";
import { collectCommonTableInputKeys } from "./formParser";
import type { FormFieldMapping } from "../types";

/**
 * Fichier SÉPARÉ de `formParser.test.ts`, à dessein : ce correctif doit vivre à
 * l'identique sur `jdev` et sur `aac-dev`, et la liste d'imports de `formParser.test.ts`
 * diverge entre les deux branches. Y ajouter ces cas rendait le report manuel — un
 * fichier neuf, lui, ne peut pas entrer en conflit.
 */

const champ = (componentType: string, name: string) =>
  ({ componentType, name, label: "" }) as unknown as FormFieldMapping;

describe("collectCommonTableInputKeys — la clé attendue par getCatalogs", () => {
  it("rend la clé NUE, sans le préfixe de stockage `yesOrNo`", () => {
    // Un commonTable est stocké sous `yesOrNo{key}`, mais `getformcatalogs` est indexé
    // par la clé nue. Renvoyer `field.name` produirait des clés qui ne matchent AUCUN
    // catalogue — et un tableau de besoins vide, sans la moindre erreur.
    const keys = collectCommonTableInputKeys([
      { fields: [champ("commonTable", "yesOrNocommunsDeCaes1696958044_0lnkl9ef5p6ojvpub3j")] },
    ] as never);
    expect(keys).toEqual(["communsDeCaes1696958044_0lnkl9ef5p6ojvpub3j"]);
  });

  it("ignore tout ce qui n'est pas un commonTable", () => {
    const keys = collectCommonTableInputKeys([
      { fields: [champ("text", "titre"), champ("commonTable", "yesOrNoabc"), champ("finder", "lieu")] },
    ] as never);
    expect(keys).toEqual(["abc"]);
  });

  it("ratisse TOUTES les étapes, pas seulement la première", () => {
    // Le fetch est un batch au niveau du formulaire : rater une étape prive ses
    // tableaux de leur catalogue alors que les autres l'ont.
    const keys = collectCommonTableInputKeys([
      { fields: [champ("commonTable", "yesOrNoa")] },
      { fields: [champ("commonTable", "yesOrNob")] },
    ] as never);
    expect(keys).toEqual(["a", "b"]);
  });

  it("rend un tableau vide sur un formulaire sans commonTable — aucun appel réseau", () => {
    expect(collectCommonTableInputKeys([{ fields: [champ("text", "titre")] }] as never)).toEqual([]);
  });
});
