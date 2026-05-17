import { describe, expect, it } from "vitest";
import {
  cleanUrlToRelativePath,
  collectPendingUploads,
  getUploadKeys,
  getValueAtPath,
  inferExtensionFromMimeType,
  isDataUri,
  isObjectRecord,
  isPendingUploadValue,
  normalizeUploaderValue,
  parseMimeType,
  sanitizeBaseName,
  setValueAtPath,
  shouldCleanUrls,
  uploadInBatches,
} from "./uploadHelpers";

/**
 * Tests des helpers d'upload CoForm extraits au Sprint 3.
 * Ne testent que les pure functions (pas le pipeline `useCoFormFinalMutation`
 * qui appelle l'API SDK — celui-là nécessiterait un mock complet de Cocolight).
 */

describe("isDataUri", () => {
  it("détecte un data URI base64 valide", () => {
    expect(isDataUri("data:image/png;base64,iVBORw0KGgo...")).toBe(true);
    expect(isDataUri("data:application/pdf;base64,JVBERi0xLj...")).toBe(true);
  });

  it("rejette une URL classique", () => {
    expect(isDataUri("https://example.com/file.png")).toBe(false);
    expect(isDataUri("/upload/path.png")).toBe(false);
  });

  it("rejette les chaînes vides ou non data-URI", () => {
    expect(isDataUri("")).toBe(false);
    expect(isDataUri("data:image/png")).toBe(false); // pas de ;base64,
  });
});

describe("isObjectRecord", () => {
  it("retourne true pour un objet plain", () => {
    expect(isObjectRecord({})).toBe(true);
    expect(isObjectRecord({ a: 1 })).toBe(true);
  });

  it("retourne false pour null, array, primitive", () => {
    expect(isObjectRecord(null)).toBe(false);
    expect(isObjectRecord([])).toBe(false);
    expect(isObjectRecord("string")).toBe(false);
    expect(isObjectRecord(42)).toBe(false);
  });
});

describe("isPendingUploadValue", () => {
  it("détecte un objet { data: '<data-uri>' }", () => {
    expect(isPendingUploadValue({ data: "data:image/png;base64,xxx" })).toBe(true);
    expect(isPendingUploadValue({ name: "photo.jpg", data: "data:image/jpeg;base64,xxx" })).toBe(true);
  });

  it("rejette si data n'est pas un data URI", () => {
    expect(isPendingUploadValue({ data: "/upload/path.png" })).toBe(false);
  });

  it("rejette si pas un objet record", () => {
    expect(isPendingUploadValue(null)).toBe(false);
    expect(isPendingUploadValue("data:image/png;base64,xxx")).toBe(false);
  });
});

describe("parseMimeType", () => {
  it("extrait le MIME du data URI", () => {
    expect(parseMimeType("data:image/png;base64,xxx")).toBe("image/png");
    expect(parseMimeType("data:application/pdf;base64,xxx")).toBe("application/pdf");
  });

  it("normalise en lowercase", () => {
    expect(parseMimeType("data:IMAGE/PNG;base64,xxx")).toBe("image/png");
  });

  it("retourne application/octet-stream pour data URI invalide", () => {
    expect(parseMimeType("not-a-data-uri")).toBe("application/octet-stream");
  });
});

describe("inferExtensionFromMimeType", () => {
  it("mappe les MIME images courants", () => {
    expect(inferExtensionFromMimeType("image/jpeg")).toBe("jpg");
    expect(inferExtensionFromMimeType("image/png")).toBe("png");
    expect(inferExtensionFromMimeType("image/svg+xml")).toBe("svg");
  });

  it("mappe les MIME documents courants", () => {
    expect(inferExtensionFromMimeType("application/pdf")).toBe("pdf");
    expect(inferExtensionFromMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("docx");
  });

  it("retourne 'bin' pour un MIME inconnu", () => {
    expect(inferExtensionFromMimeType("application/x-custom-format")).toBe("bin");
  });
});

describe("sanitizeBaseName", () => {
  it("retire l'extension", () => {
    expect(sanitizeBaseName("photo.jpg")).toBe("photo");
    expect(sanitizeBaseName("doc.pdf")).toBe("doc");
  });

  it("remplace les caractères spéciaux par des tirets", () => {
    expect(sanitizeBaseName("my/file:name.txt")).toBe("my-file-name");
  });

  it("retourne 'upload' si totalement vide après sanitization", () => {
    expect(sanitizeBaseName(".jpg")).toBe("upload");
    // Note: une suite de caractères invalides est compressée en un seul tiret
    // par le regex `+` (greedy), pas en chaîne vide.
    expect(sanitizeBaseName("///")).toBe("-");
  });

  it("préserve les caractères alphanumériques + underscore + tiret + espace + point", () => {
    expect(sanitizeBaseName("My_Photo 2 v1.0.jpg")).toBe("My_Photo 2 v1.0");
  });
});

describe("shouldCleanUrls", () => {
  it("retourne true pour types se terminant par .uploader ou .simpleTable", () => {
    expect(shouldCleanUrls("tpls.form.uploader")).toBe(true);
    expect(shouldCleanUrls("custom.simpleTable")).toBe(true);
  });

  it("retourne false pour autres types", () => {
    expect(shouldCleanUrls("tpls.form.text")).toBe(false);
    expect(shouldCleanUrls("finder")).toBe(false);
  });

  it("retourne false pour undefined", () => {
    expect(shouldCleanUrls(undefined)).toBe(false);
  });
});

describe("cleanUrlToRelativePath", () => {
  it("convertit une URL absolue en chemin relatif", () => {
    expect(cleanUrlToRelativePath("https://example.com/upload/photo.png")).toBe("/upload/photo.png");
    expect(cleanUrlToRelativePath("http://localhost:3000/path/file.pdf")).toBe("/path/file.pdf");
  });

  it("préserve les data URI inchangés", () => {
    const dataUri = "data:image/png;base64,xxx";
    expect(cleanUrlToRelativePath(dataUri)).toBe(dataUri);
  });

  it("préserve les chemins relatifs", () => {
    expect(cleanUrlToRelativePath("/upload/photo.png")).toBe("/upload/photo.png");
  });

  it("traverse récursivement les arrays", () => {
    const input = ["https://x.com/a", "https://x.com/b"];
    expect(cleanUrlToRelativePath(input)).toEqual(["/a", "/b"]);
  });

  it("traverse récursivement les objets", () => {
    const input = { url: "https://x.com/a", nested: { url: "https://x.com/b" } };
    expect(cleanUrlToRelativePath(input)).toEqual({
      url: "/a",
      nested: { url: "/b" },
    });
  });

  it("préserve les types non-string non-object", () => {
    expect(cleanUrlToRelativePath(42)).toBe(42);
    expect(cleanUrlToRelativePath(true)).toBe(true);
    expect(cleanUrlToRelativePath(null)).toBe(null);
  });
});

describe("collectPendingUploads", () => {
  it("trouve un data URI string nested", () => {
    const data = {
      step1: {
        photo: "data:image/png;base64,xxx",
      },
    };
    const result = collectPendingUploads(data);
    expect(result).toHaveLength(1);
    expect(result[0].path).toEqual(["step1", "photo"]);
    expect(result[0].value.data).toBe("data:image/png;base64,xxx");
  });

  it("trouve un PendingUploadValue { name, data }", () => {
    const data = {
      step1: {
        photo: { name: "photo.jpg", data: "data:image/jpeg;base64,xxx" },
      },
    };
    const result = collectPendingUploads(data);
    expect(result).toHaveLength(1);
    expect(result[0].value.name).toBe("photo.jpg");
  });

  it("trouve plusieurs uploads dans un array", () => {
    const data = {
      step1: {
        photos: [
          { name: "a.jpg", data: "data:image/jpeg;base64,a" },
          { name: "b.jpg", data: "data:image/jpeg;base64,b" },
        ],
      },
    };
    const result = collectPendingUploads(data);
    expect(result).toHaveLength(2);
    expect(result[0].path).toEqual(["step1", "photos", 0]);
    expect(result[1].path).toEqual(["step1", "photos", 1]);
  });

  it("retourne tableau vide si aucun data URI", () => {
    expect(collectPendingUploads({ step1: { text: "hello" } })).toEqual([]);
    expect(collectPendingUploads({})).toEqual([]);
  });
});

describe("getUploadKeys", () => {
  it("retourne presentation + subKey pour input uploader", () => {
    const result = getUploadKeys("tpls.form.uploader", ["sub1", "input1", 0]);
    expect(result.contentKey).toBe("presentation");
    expect(result.subKey).toBe("sub1.input1");
  });

  it("retourne presentation + subKey pour 'uploader' exact", () => {
    const result = getUploadKeys("uploader", ["sub1", "input1"]);
    expect(result.contentKey).toBe("presentation");
    expect(result.subKey).toBe("sub1.input1");
  });

  it("retourne slider sans subKey pour autres inputs", () => {
    const result = getUploadKeys("tpls.form.text", ["sub1", "input1"]);
    expect(result.contentKey).toBe("slider");
    expect(result.subKey).toBeUndefined();
  });

  it("retourne slider sans subKey si inputType undefined", () => {
    const result = getUploadKeys(undefined, ["sub1"]);
    expect(result.contentKey).toBe("slider");
  });
});

describe("getValueAtPath", () => {
  it("retourne la valeur à un chemin string", () => {
    expect(getValueAtPath({ a: { b: { c: 42 } } }, ["a", "b", "c"])).toBe(42);
  });

  it("retourne la valeur à un chemin mixte (string + number)", () => {
    expect(getValueAtPath({ a: ["x", "y", "z"] }, ["a", 1])).toBe("y");
  });

  it("retourne undefined pour un chemin inexistant", () => {
    expect(getValueAtPath({ a: 1 }, ["b"])).toBeUndefined();
  });

  it("retourne l'objet entier pour path vide", () => {
    const obj = { a: 1 };
    expect(getValueAtPath(obj, [])).toBe(obj);
  });
});

describe("setValueAtPath", () => {
  it("définit une valeur à un chemin string (immutable)", () => {
    const obj = { a: { b: 1 } };
    const result = setValueAtPath(obj, ["a", "b"], 42);
    expect(result).toEqual({ a: { b: 42 } });
    expect(obj).toEqual({ a: { b: 1 } }); // original inchangé
  });

  it("crée le chemin si absent dans un objet", () => {
    const obj = { a: 1 };
    const result = setValueAtPath(obj, ["a"], 42);
    expect(result).toEqual({ a: 42 });
  });

  it("définit une valeur dans un array (immutable)", () => {
    const arr = [1, 2, 3];
    const result = setValueAtPath(arr, [1], 99);
    expect(result).toEqual([1, 99, 3]);
    expect(arr).toEqual([1, 2, 3]); // original inchangé
  });

  it("traverse les structures nested", () => {
    const obj = { step1: { photos: ["a", "b", "c"] } };
    const result = setValueAtPath(obj, ["step1", "photos", 1], "B");
    expect(result).toEqual({ step1: { photos: ["a", "B", "c"] } });
  });
});

describe("normalizeUploaderValue", () => {
  it("convertit un array d'items { docId, docPath } en { updateDate, files }", () => {
    const input = [
      { docId: "id1", docPath: "/upload/a.jpg" },
      { docId: "id2", docPath: "/upload/b.jpg" },
    ];
    const result = normalizeUploaderValue(input);
    expect(result).toEqual({
      updateDate: expect.any(Array),
      files: { id1: "/upload/a.jpg", id2: "/upload/b.jpg" },
    });
  });

  it("préserve un objet déjà au format final { updateDate, files (object) }", () => {
    const input = {
      updateDate: ["19/03/2026"],
      files: { id1: "/upload/a.jpg" },
    };
    expect(normalizeUploaderValue(input)).toEqual(input);
  });

  it("convertit files: array → files: object si updateDate présent", () => {
    const input = {
      updateDate: ["19/03/2026"],
      files: [
        { docId: "id1", docPath: "/upload/a.jpg" },
      ],
    };
    const result = normalizeUploaderValue(input) as { files: Record<string, string> };
    expect(result.files).toEqual({ id1: "/upload/a.jpg" });
  });

  it("retourne la valeur inchangée pour autres types", () => {
    expect(normalizeUploaderValue("string")).toBe("string");
    expect(normalizeUploaderValue(42)).toBe(42);
  });
});

describe("uploadInBatches", () => {
  it("upload en batches de la taille spécifiée", async () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const calls: number[][] = [];
    const result = await uploadInBatches(
      items,
      async (item) => {
        return item * 2;
      },
      3,
    );

    expect(result).toEqual([2, 4, 6, 8, 10, 12, 14]);
    void calls;
  });

  it("respecte l'index global", async () => {
    const items = ["a", "b", "c", "d"];
    const result = await uploadInBatches(
      items,
      async (item, index) => `${index}:${item}`,
      2,
    );
    expect(result).toEqual(["0:a", "1:b", "2:c", "3:d"]);
  });

  it("retourne array vide si items vide", async () => {
    const result = await uploadInBatches([], async (x: number) => x);
    expect(result).toEqual([]);
  });
});
