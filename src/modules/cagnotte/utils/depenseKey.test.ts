import { describe, expect, it } from "vitest";
import { toArrayOrValues } from "./dataTransform";
import { listDepenseKeys, resolveDepenseKey, resolveSavedDepenseKey } from "./depenseKey";

describe("resolveDepenseKey", () => {
  it("rend la clé réelle sur un objet à clés creuses", () => {
    // Le cas qui motive le module : la dépense de clé "3" est en position 1.
    const depenses = { "0": { poste: "A" }, "3": { poste: "B" } };

    expect(resolveDepenseKey(depenses, 0)).toBe("0");
    expect(resolveDepenseKey(depenses, 1)).toBe("3");
  });

  it("reste aligné sur ce que `toArrayOrValues` produit", () => {
    // La garantie centrale : keys[i] décrit values[i]. Si cette invariance cassait,
    // tous les appels serveur viseraient la mauvaise dépense.
    const depenses = { "0": { poste: "A" }, "2": { poste: "B" }, "5": { poste: "C" } };
    const values = toArrayOrValues<{ poste: string }>(depenses);
    const keys = listDepenseKeys(depenses);

    values.forEach((value, index) => {
      expect((depenses as Record<string, { poste: string }>)[keys[index]]).toBe(value);
    });
  });

  it("rend la position sur un vrai tableau", () => {
    expect(resolveDepenseKey([{ poste: "A" }, { poste: "B" }], 1)).toBe("1");
  });

  it("rend null hors bornes plutôt qu'une clé inventée", () => {
    expect(resolveDepenseKey({ "0": {}, "3": {} }, 2)).toBeNull();
    expect(resolveDepenseKey([{ poste: "A" }], 5)).toBeNull();
  });

  it("rend null sur un index invalide", () => {
    expect(resolveDepenseKey([{ poste: "A" }], -1)).toBeNull();
    expect(resolveDepenseKey([{ poste: "A" }], 1.5)).toBeNull();
  });

  it("rend null sur une entrée absente ou scalaire", () => {
    expect(resolveDepenseKey(null, 0)).toBeNull();
    expect(resolveDepenseKey(undefined, 0)).toBeNull();
    expect(resolveDepenseKey("depense", 0)).toBeNull();
  });
});

describe("listDepenseKeys", () => {
  it("préserve l'ordre d'insertion des clés non numériques", () => {
    expect(listDepenseKeys({ b: {}, a: {} })).toEqual(["b", "a"]);
  });

  it("rend un tableau vide sur une entrée non exploitable", () => {
    expect(listDepenseKeys(null)).toEqual([]);
    expect(listDepenseKeys(42)).toEqual([]);
  });
});

/**
 * Le formulaire édite sa liste AVANT de l'enregistrer : la position d'une ligne à l'écran ne dit
 * pas sa clé au document. Se tromper, c'est désigner au serveur une autre dépense.
 */
describe("resolveSavedDepenseKey", () => {
  const a = { poste: "A", milestone: "m-a" };
  const b = { poste: "B", milestone: "m-b" };
  const c = { poste: "C", milestone: "m-c" };
  const orpheline = (poste: string) => ({ poste });

  it("retrouve une dépense par son identifiant de palier, liste inchangée", () => {
    expect(resolveSavedDepenseKey([a, b, c], [a, b, c], 0)).toBe("0");
    expect(resolveSavedDepenseKey([a, b, c], [a, b, c], 2)).toBe("2");
  });

  it("… même quand une ligne retirée du formulaire a décalé les suivantes", () => {
    // A est retirée à l'écran, pas encore au document : B est en position 0, sa clé reste « 1 ».
    expect(resolveSavedDepenseKey([a, b, c], [b, c], 0)).toBe("1");
    expect(resolveSavedDepenseKey([a, b, c], [b, c], 1)).toBe("2");
  });

  it("… et sur un document à clés creuses : c'est la CLÉ qui est rendue, pas le rang", () => {
    expect(resolveSavedDepenseKey({ "0": a, "3": b }, [a, b], 1)).toBe("3");
    expect(resolveSavedDepenseKey({ "0": a, "3": b }, [b], 0)).toBe("3");
  });

  it("une ligne ajoutée au formulaire n'a pas de clé : elle n'est pas encore au document", () => {
    const nouvelle = { poste: "N", milestone: "m-n" };
    expect(resolveSavedDepenseKey([a, b], [a, b, nouvelle], 2)).toBeNull();
    // … et elle ne trouble pas les autres.
    expect(resolveSavedDepenseKey([a, b], [a, b, nouvelle], 1)).toBe("1");
  });

  it("une ligne modifiée sur place garde sa clé : son identifiant n'a pas changé", () => {
    expect(resolveSavedDepenseKey([a, b], [a, { ...b, poste: "B bis", price: 12 }], 1)).toBe("1");
  });

  it("un identifiant porté par deux dépenses enregistrées ne désigne personne", () => {
    expect(resolveSavedDepenseKey([a, { ...b, milestone: "m-a" }], [a], 0)).toBeNull();
  });

  it("une dépense orpheline se retrouve par sa position, tant que la liste n'a pas changé de forme", () => {
    const x = orpheline("X");
    const y = orpheline("Y");
    expect(resolveSavedDepenseKey([x, a, y], [x, a, y], 0)).toBe("0");
    expect(resolveSavedDepenseKey([x, a, y], [x, a, { ...y, poste: "Y bis" }], 2)).toBe("2");
    expect(resolveSavedDepenseKey({ "0": x, "4": y }, [x, y], 1)).toBe("4");
  });

  it("… et plus du tout dès qu'elle en a changé : retirer une orpheline décale les autres en silence", () => {
    const x = orpheline("X");
    const y = orpheline("Y");
    // X retirée : Y est en position 0, où le document porte X.
    expect(resolveSavedDepenseKey([x, y], [y], 0)).toBeNull();
    // X retirée puis une ligne ajoutée : même longueur, mais plus les mêmes identifiants aux mêmes places.
    expect(resolveSavedDepenseKey([x, y], [y, { poste: "N", milestone: "m-n" }], 0)).toBeNull();
    // Une ligne ajoutée derrière : la longueur a changé.
    expect(resolveSavedDepenseKey([x, y], [x, y, orpheline("Z")], 0)).toBeNull();
    // Une dépense qui a un identifiant, elle, se retrouve toujours.
    expect(resolveSavedDepenseKey([x, a], [a], 0)).toBe("1");
  });

  // Le formulaire range ses lignes dans l'ordre NUMÉRIQUE des clés ; un objet s'énumère autrement dès
  // qu'une clé n'est pas un entier écrit sans zéro de tête. La position ne dit alors plus rien.
  it("une orpheline sous des clés que le document n'énumère pas dans l'ordre du formulaire : pas de clé", () => {
    const x = orpheline("X");
    const y = orpheline("Y");
    expect(resolveSavedDepenseKey({ "01": x, "2": y }, [x, y], 0)).toBeNull();
    expect(resolveSavedDepenseKey({ "2": x, a: y }, [x, y], 1)).toBeNull();
    // Par son identifiant, une dépense se retrouve quelles que soient les clés.
    expect(resolveSavedDepenseKey({ "01": a, "2": b }, [a, b], 0)).toBe("01");
    expect(resolveSavedDepenseKey({ "01": a, "2": b }, [b], 0)).toBe("2");
  });

  it("rend null hors bornes, sur un index invalide, sur un document absent", () => {
    expect(resolveSavedDepenseKey([a], [a], 1)).toBeNull();
    expect(resolveSavedDepenseKey([a], [a], -1)).toBeNull();
    expect(resolveSavedDepenseKey([a], [a], 0.5)).toBeNull();
    expect(resolveSavedDepenseKey(null, [a], 0)).toBeNull();
    expect(resolveSavedDepenseKey(undefined, [orpheline("X")], 0)).toBeNull();
    expect(resolveSavedDepenseKey("depense", [a], 0)).toBeNull();
  });

  it("un identifiant qui n'est pas une chaîne ne compte pas : la dépense est orpheline", () => {
    const etrange = { poste: "E", milestone: 12 };
    expect(resolveSavedDepenseKey([etrange], [etrange], 0)).toBe("0");
    expect(resolveSavedDepenseKey([etrange, a], [a], 0)).toBe("1");
    // … et, orpheline, elle ne se retrouve plus dès que la liste a changé de forme.
    expect(resolveSavedDepenseKey([a, etrange], [etrange], 0)).toBeNull();
  });
});
