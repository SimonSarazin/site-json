import { describe, it, expect } from "vitest";
import { collectUploaderDocIds, extractDeletedDocIds } from "./file";

/**
 * Non-régression de la réconciliation de fichiers au save (suppression
 * différée). `collectUploaderDocIds` walk la structure d'une réponse et
 * collecte les docId des feuilles uploader `{updateDate, files:{docId:docPath}}`.
 * Le diff `snapshot − soumis` pilote un effet DESTRUCTIF (answer.deleteFiles) :
 * un faux négatif ressuscite le bug du fichier fantôme jamais purgé, un faux
 * positif supprime un fichier conservé. Ces tests figent l'invariant.
 */
describe("collectUploaderDocIds", () => {
  it("collecte les docId d'une feuille uploader canonique imbriquée", () => {
    const answers = {
      sf1: {
        input1: { updateDate: ["2026-06-25"], files: { d1: "/p1", d2: "/p2" } },
      },
    };
    expect(collectUploaderDocIds(answers)).toEqual(new Set(["d1", "d2"]));
  });

  it("collecte à travers plusieurs sous-formulaires / inputs", () => {
    const answers = {
      sf1: { a: { updateDate: ["x"], files: { d1: "/p1" } } },
      sf2: { b: { updateDate: ["y"], files: { d2: "/p2", d3: "/p3" } } },
    };
    expect(collectUploaderDocIds(answers)).toEqual(new Set(["d1", "d2", "d3"]));
  });

  it("ignore `files: []` (tableau vide de pollution Mongo) sans crash", () => {
    const answers = { sf1: { input1: { updateDate: ["x"], files: [] } } };
    expect(collectUploaderDocIds(answers)).toEqual(new Set());
  });

  it("ignore `files: {}` (objet vide) sans crash", () => {
    const answers = { sf1: { input1: { updateDate: ["x"], files: {} } } };
    expect(collectUploaderDocIds(answers)).toEqual(new Set());
  });

  it("renvoie un Set vide pour answers undefined/null (nouvelle réponse)", () => {
    expect(collectUploaderDocIds(undefined)).toEqual(new Set());
    expect(collectUploaderDocIds(null)).toEqual(new Set());
  });

  it("ignore un nœud {updateDate} sans `files` (legacy sans fichiers inline)", () => {
    const answers = { sf1: { input1: { updateDate: ["x"] } } };
    expect(collectUploaderDocIds(answers)).toEqual(new Set());
  });

  it("ne confond pas une réponse classique (string/array/number) avec un fichier", () => {
    const answers = {
      sf1: {
        text: "réponse libre",
        choix: ["a", "b"],
        note: 5,
        upload: { updateDate: ["x"], files: { d1: "/p1" } },
      },
    };
    expect(collectUploaderDocIds(answers)).toEqual(new Set(["d1"]));
  });

  it("diff snapshot − soumis = fichiers retirés (scénario exact du bug)", () => {
    const atLoad = collectUploaderDocIds({
      sf1: { up: { updateDate: ["x"], files: { d1: "/p1", d2: "/p2" } } },
    });
    // L'utilisateur a retiré d2 du formulaire → le payload soumis ne porte plus que d1.
    const submitted = collectUploaderDocIds({
      sf1: { up: { updateDate: ["x"], files: { d1: "/p1" } } },
    });
    const removed = [...atLoad].filter((id) => !submitted.has(id));
    expect(removed).toEqual(["d2"]);
  });

  it("collecte les docId d'une feuille uploader en forme Array [{docId, docPath}]", () => {
    const answers = {
      sf1: {
        up: {
          updateDate: ["x"],
          files: [
            { docId: "d1", docPath: "/p1" },
            { docId: "d2", docPath: "/p2" },
          ],
        },
      },
    };
    expect(collectUploaderDocIds(answers)).toEqual(new Set(["d1", "d2"]));
  });

  it("SUR-SUPPRESSION : map au load vs Array au submit → ne retire QUE le fichier réellement supprimé", () => {
    // Régression réelle : ajout d'une image (champ normalisé en map au save),
    // réouverture (serverData = map), suppression d'UNE image (l'UI réécrit le
    // reste en Array), save (le champ sans nouvel upload reste en Array).
    // Avant le fix, l'Array soumis était vu VIDE → les 2 docs étaient supprimés.
    const atLoad = collectUploaderDocIds({
      sf1: { up: { updateDate: ["x"], files: { d1: "/p1", d2: "/p2" } } },
    });
    const submitted = collectUploaderDocIds({
      sf1: { up: { updateDate: ["x"], files: [{ docId: "d1", docPath: "/p1" }] } },
    });
    const removed = [...atLoad].filter((id) => !submitted.has(id));
    expect(removed).toEqual(["d2"]); // et SURTOUT pas ["d1", "d2"]
  });

  it("forme Array inchangée (champ non touché) → aucun fichier retiré", () => {
    // A et B portent le même champ en Array : symétrie → removed vide.
    const atLoad = collectUploaderDocIds({
      sf1: { up: { updateDate: ["x"], files: [{ docId: "d1", docPath: "/p1" }] } },
    });
    const submitted = collectUploaderDocIds({
      sf1: { up: { updateDate: ["x"], files: [{ docId: "d1", docPath: "/p1" }] } },
    });
    const removed = [...atLoad].filter((id) => !submitted.has(id));
    expect(removed).toEqual([]);
  });

  it("ignore les entrées Array sans docId string sans crash", () => {
    const answers = {
      sf1: {
        up: {
          updateDate: ["x"],
          files: [{ docId: "d1", docPath: "/p1" }, { docPath: "/orphan" }, null, "x"],
        },
      },
    };
    expect(collectUploaderDocIds(answers)).toEqual(new Set(["d1"]));
  });
});

describe("extractDeletedDocIds", () => {
  it("collecte les docId tracés et STRIP la clé deletedDocIds de la structure", () => {
    const answers = {
      sf1: {
        up: { updateDate: ["x"], files: { d1: "/p1" }, deletedDocIds: ["d2", "d3"] },
      },
    };
    const { cleaned, deletedDocIds } = extractDeletedDocIds(answers);
    expect(deletedDocIds).toEqual(new Set(["d2", "d3"]));
    // La clé transitoire ne doit JAMAIS rester dans le payload sauvegardé.
    expect(cleaned).toEqual({ sf1: { up: { updateDate: ["x"], files: { d1: "/p1" } } } });
  });

  it("laisse intacts les champs sans deletedDocIds", () => {
    const answers = {
      sf1: { up: { updateDate: ["x"], files: { d1: "/p1" } }, txt: "réponse" },
    };
    const { cleaned, deletedDocIds } = extractDeletedDocIds(answers);
    expect(deletedDocIds).toEqual(new Set());
    expect(cleaned).toEqual(answers);
  });

  it("collecte à travers plusieurs champs", () => {
    const answers = {
      sf1: {
        a: { updateDate: ["x"], files: {}, deletedDocIds: ["d1"] },
        b: { updateDate: ["y"], deletedDocIds: ["d2", "d3"] },
      },
    };
    const { deletedDocIds } = extractDeletedDocIds(answers);
    expect(deletedDocIds).toEqual(new Set(["d1", "d2", "d3"]));
  });

  it("answers undefined/null → set vide, pas de crash", () => {
    expect(extractDeletedDocIds(undefined).deletedDocIds).toEqual(new Set());
    expect(extractDeletedDocIds(null).deletedDocIds).toEqual(new Set());
  });

  it("SCÉNARIO legacy L1 : fichier absent de la map → seul deletedDocIds le supprime", () => {
    // Le champ legacy est `{updateDate}` SANS clé `files` : le snapshot (A) est
    // aveugle. L'utilisateur retire le fichier (résolu via getFiles) → handleRemove
    // produit `files: {}` + `deletedDocIds: [realId]`.
    const filesAtLoad = collectUploaderDocIds({
      sf1: { up: { updateDate: ["x"] } }, // pas de clé files → A vide
    });
    const submittedRaw = {
      sf1: { up: { updateDate: ["x"], files: {}, deletedDocIds: ["6941c25b746a677c175a6ba6"] } },
    };
    const { cleaned, deletedDocIds: explicit } = extractDeletedDocIds(submittedRaw);
    const filesAfterSubmit = collectUploaderDocIds(cleaned);

    const removedByDiff = [...filesAtLoad].filter((id) => !filesAfterSubmit.has(id));
    const removed = [...new Set([...removedByDiff, ...explicit])];

    expect(removedByDiff).toEqual([]); // le diff seul raterait le fichier
    expect(removed).toEqual(["6941c25b746a677c175a6ba6"]); // l'explicite le rattrape
    // et la clé transitoire n'est pas persistée
    expect(cleaned).toEqual({ sf1: { up: { updateDate: ["x"], files: {} } } });
  });

  it("SCÉNARIO moderne : diff et explicite convergent (union dédupliquée)", () => {
    const filesAtLoad = collectUploaderDocIds({
      sf1: { up: { updateDate: ["x"], files: { d1: "/p1", d2: "/p2" } } },
    });
    const submittedRaw = {
      sf1: { up: { updateDate: ["x"], files: { d1: "/p1" }, deletedDocIds: ["d2"] } },
    };
    const { cleaned, deletedDocIds: explicit } = extractDeletedDocIds(submittedRaw);
    const filesAfterSubmit = collectUploaderDocIds(cleaned);
    const removedByDiff = [...filesAtLoad].filter((id) => !filesAfterSubmit.has(id));
    const removed = [...new Set([...removedByDiff, ...explicit])];

    expect(removedByDiff).toEqual(["d2"]);
    expect(removed).toEqual(["d2"]); // pas de doublon
  });
});
