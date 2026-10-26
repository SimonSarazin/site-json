import { describe, expect, it } from "vitest";
import {
  MAX_IMAGES,
  imageFilesFrom,
  isAcceptedImage,
  normalizeImages,
  screenImageFiles,
  toMediaImgPayload,
} from "./commentImages";

/** Un faux fichier : seuls `type` et `size` comptent pour le tri. */
function fichier(type: string, size = 1024, name = "image"): File {
  return { type, size, name } as unknown as File;
}

describe("isAcceptedImage", () => {
  it("accepte les types que le SDK sait valider", () => {
    expect(isAcceptedImage(fichier("image/png"))).toBe(true);
    expect(isAcceptedImage(fichier("image/jpeg"))).toBe(true);
    expect(isAcceptedImage(fichier("IMAGE/PNG"))).toBe(true);
  });

  // Le backend accepte webp et gif, mais `BaseEntity._validateImage` non : c'est le client qui
  // refuserait, et il vaut mieux le dire à la saisie qu'à l'envoi.
  it("refuse webp et gif, que le SDK rejette", () => {
    expect(isAcceptedImage(fichier("image/webp"))).toBe(false);
    expect(isAcceptedImage(fichier("image/gif"))).toBe(false);
  });

  it("ne suppose rien d'un fichier sans type", () => {
    expect(isAcceptedImage(fichier(""))).toBe(false);
    expect(isAcceptedImage(null)).toBe(false);
  });
});

describe("screenImageFiles", () => {
  it("prend ce qui rentre et nomme chaque motif de refus", () => {
    const { accepted, rejected } = screenImageFiles([
      fichier("image/png"),
      fichier("image/webp"),
      fichier("image/png", 20 * 1024 * 1024),
    ]);
    expect(accepted).toHaveLength(1);
    expect(rejected).toEqual(["type", "size"]);
  });

  // Le plafond porte sur le MESSAGE : trois images déjà en attente n'en laissent passer que deux.
  it("compte les images déjà en attente dans le plafond", () => {
    const fournee = Array.from({ length: 4 }, () => fichier("image/png"));
    const { accepted, rejected } = screenImageFiles(fournee, 3);
    expect(accepted).toHaveLength(MAX_IMAGES - 3);
    expect(rejected).toEqual(["count"]);
  });

  it("ne répète pas un motif de refus", () => {
    const { rejected } = screenImageFiles([fichier("image/gif"), fichier("image/webp")]);
    expect(rejected).toEqual(["type"]);
  });
});

describe("imageFilesFrom", () => {
  it("ne retient que les entrées fichier de type image d'un collage", () => {
    const png = fichier("image/png");
    const transfer = {
      items: [
        { kind: "string", type: "text/html", getAsFile: () => null },
        { kind: "file", type: "image/png", getAsFile: () => png },
      ],
      files: [],
    } as unknown as DataTransfer;
    expect(imageFilesFrom(transfer)).toEqual([png]);
  });

  // Certains navigateurs ne peuplent `items` qu'au glisser-déposer : sans ce repli, coller une
  // image ne ferait rien du tout.
  it("retombe sur `files` quand `items` est vide", () => {
    const jpeg = fichier("image/jpeg");
    const transfer = { items: [], files: [jpeg, fichier("application/pdf")] } as unknown as DataTransfer;
    expect(imageFilesFrom(transfer)).toEqual([jpeg]);
  });

  it("ne lève pas sans presse-papiers", () => {
    expect(imageFilesFrom(null)).toEqual([]);
  });
});

describe("normalizeImages", () => {
  it("lit la forme hydratée du backend", () => {
    const images = normalizeImages({
      countImages: 1,
      images: [{
        _id: { $id: "a".repeat(24) },
        name: "pastedimage.jpeg",
        imagePath: "/upload/a.jpg",
        imageThumbPath: "/upload/thumb/a.jpg",
      }],
    });
    expect(images).toEqual([{
      id: "a".repeat(24),
      url: "/upload/a.jpg",
      thumbUrl: "/upload/thumb/a.jpg",
      name: "pastedimage.jpeg",
    }]);
  });

  // Avant hydratation, `images` est un tableau d'identifiants : aucune URL, donc rien à
  // afficher. Les retenir produirait une image cassée sous chaque message fraîchement écrit.
  it("ignore les identifiants bruts, qui ne portent aucune URL", () => {
    expect(normalizeImages({ images: ["a".repeat(24), "b".repeat(24)] })).toEqual([]);
  });

  it("ignore un document sans chemin et tolère une forme absente", () => {
    expect(normalizeImages({ images: [{ name: "orphelin" }] })).toEqual([]);
    expect(normalizeImages(null)).toEqual([]);
    expect(normalizeImages({ images: "pas un tableau" })).toEqual([]);
  });

  // Le backend n'hydrate que cinq images et sort de la boucle : en afficher davantage
  // promettrait ce que la lecture ne rend jamais.
  it("s'arrête au plafond du backend", () => {
    const doc = (i: number) => ({ id: String(i).padStart(24, "0"), imagePath: `/u/${i}.jpg` });
    const images = normalizeImages({ images: Array.from({ length: 8 }, (_, i) => doc(i)) });
    expect(images).toHaveLength(MAX_IMAGES);
  });
});

describe("toMediaImgPayload", () => {
  it("rend null quand il n'y a rien à joindre", () => {
    expect(toMediaImgPayload([])).toBeNull();
    expect(toMediaImgPayload(["", ""])).toBeNull();
  });

  it("compte les images et écarte les identifiants vides", () => {
    expect(toMediaImgPayload(["a".repeat(24), "", "b".repeat(24)])).toEqual({
      countImages: 2,
      images: ["a".repeat(24), "b".repeat(24)],
    });
  });

  it("ne dépasse jamais le plafond", () => {
    const ids = Array.from({ length: 9 }, (_, i) => String(i).padStart(24, "0"));
    expect(toMediaImgPayload(ids)?.images).toHaveLength(MAX_IMAGES);
  });
});
