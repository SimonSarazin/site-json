// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  collectAddToLinksFields,
  computeAddToLinksPatch,
  findFieldValue,
  finderElementsOf,
} from "./addToLinks";

/**
 * `addToLinks` : une question finder qui alimente un lien de la réponse — la question
 * « Référent du commun » d'un appel à communs alimente `links.canEdit`. Parité du finder legacy
 * (`finder.php`, `saveElementFinder<kunik>` et `finder.removeFromForm<kunik>`), mais en une fois,
 * par DIFFÉRENCE.
 */

const A = "5dfa41886908648d3b8b46f6";
const B = "57618d6640bb4ece776308aa";
const C = "64785065919b8815ad72cf94";
const REF = "finderaapStep1m0w402djpsq3i44017";
const FIELDS = [{ fieldName: REF, linkKey: "canEdit" }];

const el = (id: string, name = `nom-${id.slice(-4)}`) => ({ id, name, type: "citoyens" });
const referents = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, el(id)]));
const answers = (value: unknown) => ({ aapStep1: { titre: "Yeswiki", [REF]: value } });

describe("collectAddToLinksFields", () => {
  it("retient les finders qui déclarent un lien, et eux seuls", () => {
    const params = {
      [REF]: { type: "citoyens", addToLinks: { value: true, links: "canEdit" } },
      finderAutre: { type: "organizations", addToLinks: { value: false, links: "canEdit" } },
      finderSansLien: { addToLinks: { value: true, links: "" } },
      finderSansReglage: { type: "citoyens" },
      tags: { addToLinks: { value: true, links: "canEdit" } },
    };
    expect(collectAddToLinksFields(params)).toEqual([{ fieldName: REF, linkKey: "canEdit" }]);
  });

  it("accepte le drapeau en chaîne, comme les autres drapeaux du parc", () => {
    expect(collectAddToLinksFields({ [REF]: { addToLinks: { value: "true", links: "canEdit" } } }))
      .toEqual([{ fieldName: REF, linkKey: "canEdit" }]);
  });

  it("refuse un nom de lien qui ouvrirait un autre chemin Mongo", () => {
    for (const links of ["can.Edit", "$set", "canEdit.x", " "]) {
      expect(collectAddToLinksFields({ [REF]: { addToLinks: { value: true, links } } })).toEqual([]);
    }
  });

  /** `links.answered` est un TABLEAU tenu par le backend : une carte de finder l'écraserait. */
  it("refuse `answered`, la liste des contributeurs que tient le backend", () => {
    expect(collectAddToLinksFields({ [REF]: { addToLinks: { value: true, links: "answered" } } })).toEqual([]);
  });

  it("tolère des params absents ou dégénérés", () => {
    expect(collectAddToLinksFields(undefined)).toEqual([]);
    expect(collectAddToLinksFields([])).toEqual([]);
    expect(collectAddToLinksFields({ [REF]: null })).toEqual([]);
  });
});

describe("findFieldValue / finderElementsOf", () => {
  it("trouve la question quelle que soit son étape, et distingue absente de vidée", () => {
    expect(findFieldValue({ aapStep2: { [REF]: referents(A) } }, REF)).toEqual(referents(A));
    expect(findFieldValue({ aapStep1: { [REF]: null } }, REF)).toBeNull();
    expect(findFieldValue({ aapStep1: { titre: "x" } }, REF)).toBeUndefined();
  });

  it("réduit les éléments à { name, type } et écarte ce qui n'est pas un identifiant", () => {
    const elements = finderElementsOf({ ...referents(A), pasUnId: el("pasUnId") });
    expect([...elements.keys()]).toEqual([A]);
    expect(elements.get(A)).toEqual({ name: el(A).name, type: "citoyens" });
  });

  it("tolère null et la liste vide que PHP rend pour un objet vide", () => {
    expect(finderElementsOf(null).size).toBe(0);
    expect(finderElementsOf([]).size).toBe(0);
  });
});

describe("computeAddToLinksPatch", () => {
  it("un référent ajouté entre dans le lien, sans toucher aux entrées existantes", () => {
    const serverLinks = { canEdit: { [B]: { name: "B", type: "citoyens", profilThumbImageUrl: "/x.png" } } };
    const patch = computeAddToLinksPatch({
      fields: FIELDS,
      submitted: answers(referents(A)),
      server: answers(null),
      serverLinks,
    });
    expect(patch).toEqual({
      canEdit: {
        [B]: { name: "B", type: "citoyens", profilThumbImageUrl: "/x.png" },
        [A]: { name: el(A).name, type: "citoyens" },
      },
    });
  });

  /**
   * `serverLinks` vient d'une lecture SDK, qui rend les vignettes ABSOLUES. Conservées telles
   * quelles, elles partaient ainsi en base (constaté le 29/09) — et le legacy, qui préfixe
   * lui-même (`baseUrl + profilThumbImageUrl`), affichait une image cassée.
   */
  it("une entrée conservée garde sa vignette RELATIVE, même relue absolue par le SDK", () => {
    const serverLinks = { canEdit: { [B]: { name: "B", type: "citoyens", profilThumbImageUrl: "http://co.example/assets/b.png" } } };
    const patch = computeAddToLinksPatch({
      fields: FIELDS,
      submitted: answers(referents(A)),
      server: answers(null),
      serverLinks,
    });
    expect(patch.canEdit?.[B]).toEqual({ name: "B", type: "citoyens", profilThumbImageUrl: "/assets/b.png" });
  });

  /**
   * La règle qui justifie la différence plutôt que le remplacement : B a été ajouté depuis la
   * fiche (ou les deux listes divergeaient déjà). Retirer A de la question retire A — et seulement A.
   */
  it("un référent retiré sort du lien ; un contributeur absent de la question y reste", () => {
    const patch = computeAddToLinksPatch({
      fields: FIELDS,
      submitted: answers(referents(C)),
      server: answers(referents(A, C)),
      serverLinks: { canEdit: { [A]: { name: "A", type: "citoyens" }, [B]: { name: "B", type: "citoyens" }, [C]: { name: "C", type: "citoyens" } } },
    });
    expect(Object.keys(patch.canEdit).sort()).toEqual([B, C].sort());
  });

  it("une question vidée retire ses référents, pas les autres contributeurs", () => {
    const patch = computeAddToLinksPatch({
      fields: FIELDS,
      submitted: answers(null),
      server: answers(referents(A)),
      serverLinks: { canEdit: { [A]: { name: "A", type: "citoyens" }, [B]: { name: "B", type: "citoyens" } } },
    });
    expect(Object.keys(patch.canEdit)).toEqual([B]);
  });

  it("une question inchangée ne réécrit rien", () => {
    const patch = computeAddToLinksPatch({
      fields: FIELDS,
      submitted: answers(referents(A)),
      server: answers(referents(A)),
      serverLinks: { canEdit: { [B]: { name: "B", type: "citoyens" } } },
    });
    expect(patch).toEqual({});
  });

  it("une question absente de la soumission (étape masquée) ne déduit aucun retrait", () => {
    const patch = computeAddToLinksPatch({
      fields: FIELDS,
      submitted: { aapStep2: { choose: {} } },
      server: answers(referents(A)),
      serverLinks: { canEdit: { [A]: { name: "A", type: "citoyens" } } },
    });
    expect(patch).toEqual({});
  });

  it("à la création, tous les référents entrent dans le lien", () => {
    const patch = computeAddToLinksPatch({
      fields: FIELDS,
      submitted: answers(referents(A, B)),
      server: undefined,
      serverLinks: undefined,
    });
    expect(Object.keys(patch.canEdit).sort()).toEqual([A, B].sort());
  });

  it("un lien stocké en tableau vide (PHP) part d'une carte vide", () => {
    const patch = computeAddToLinksPatch({
      fields: FIELDS,
      submitted: answers(referents(A)),
      server: answers(null),
      serverLinks: { canEdit: [] },
    });
    expect(Object.keys(patch.canEdit)).toEqual([A]);
  });

  it("deux questions sur le même lien se composent", () => {
    const AUTRE = "finderaapStep2autre";
    const patch = computeAddToLinksPatch({
      fields: [...FIELDS, { fieldName: AUTRE, linkKey: "canEdit" }],
      submitted: { aapStep1: { [REF]: referents(A) }, aapStep2: { [AUTRE]: referents(B) } },
      server: {},
      serverLinks: {},
    });
    expect(Object.keys(patch.canEdit).sort()).toEqual([A, B].sort());
  });
});
