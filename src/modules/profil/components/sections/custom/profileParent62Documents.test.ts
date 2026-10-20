import { describe, it, expect } from "vitest";
import { toPresentationDocs } from "./profileParent62Documents";

describe("toPresentationDocs", () => {
  it("données absentes / invalides → []", () => {
    expect(toPresentationDocs(undefined)).toEqual([]);
    expect(toPresentationDocs(null)).toEqual([]);
    expect(toPresentationDocs("x")).toEqual([]);
    expect(toPresentationDocs([])).toEqual([]);
  });

  // Régression : les images `contentKey:"presentation"` d'une fiche importée (ex. `epdefSajppe1`, un
  // flyer déposé comme photo plutôt que PDF) n'apparaissaient nulle part sur la page profil —
  // `useDocumentsList` ne voit que `docType:"file"`, et l'appel galerie sans `contentKey` ne les liste
  // pas (regroupées par dossier côté backend, "presentation" n'en est pas un). Sans le filtre
  // `contentKey === "presentation"` ci-dessous, cette assertion échoue (retour `[]`).
  it("ne garde que les images contentKey:presentation, mappées en DocFile", () => {
    const images = [
      { id: "a1", contentKey: "profil", imagePath: "http://x/logo.jpg", name: "logo.jpg" },
      { id: "p1", contentKey: "presentation", imagePath: "http://x/flyer-page-1.jpg", name: "flyer-page-1.jpg" },
      { id: "p2", contentKey: "presentation", imagePath: "http://x/flyer-page-2.jpg", name: "flyer-page-2.jpg" },
    ];
    expect(toPresentationDocs(images)).toEqual([
      { docId: "p1", docPath: "http://x/flyer-page-1.jpg", name: "flyer-page-1.jpg" },
      { docId: "p2", docPath: "http://x/flyer-page-2.jpg", name: "flyer-page-2.jpg" },
    ]);
  });

  it("écarte une entrée sans id (docId vide)", () => {
    expect(toPresentationDocs([{ contentKey: "presentation", imagePath: "http://x/y.jpg" }])).toEqual([]);
  });
});
