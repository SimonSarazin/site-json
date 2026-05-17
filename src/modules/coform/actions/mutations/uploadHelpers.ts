/**
 * Helpers pour le pipeline d'upload de fichiers CoForm.
 *
 * Extraits de `hooks/useCoFormQuery.tsx` (Sprint 3) pour :
 *  - Réduire la taille du fichier (797 l. → ~250 l.).
 *  - Permettre des tests unitaires sur les helpers purs.
 *  - Préparer la mutualisation avec d'éventuels autres flows d'upload.
 *
 * @remarks
 * Le pipeline gère :
 *  - Détection des `data:URI` dans une structure imbriquée (`collectPendingUploads`).
 *  - Conversion `data:URI` → `File` avec MIME inference (`dataUriToFile`).
 *  - Upload par batches pour éviter de surcharger le backend (`uploadInBatches`).
 *  - Normalisation des `uploader` fields (legacy format `{updateDate, files}`).
 *  - Nettoyage URLs absolues → chemins relatifs côté serveur.
 *  - Insertion typée par path imbriqué (`getValueAtPath`, `setValueAtPath`).
 */

import type { AllStepsData, CoFormData } from "../../types";

// ============================================================================
// TYPES
// ============================================================================

export interface PendingUploadValue {
  name?: string;
  data: string;
}

export interface PendingUpload {
  value: PendingUploadValue;
  path: (string | number)[];
  /** Type de l'input CoForm (ex: `tpls.form.uploader`) — détermine `contentKey`/`subKey`. */
  inputType?: string;
}

// ============================================================================
// PRÉDICATS DE TYPE
// ============================================================================

export function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isDataUri(value: string): boolean {
  return /^data:[^;]+;base64,/.test(value);
}

export function isPendingUploadValue(value: unknown): value is PendingUploadValue {
  if (!isObjectRecord(value)) return false;
  return typeof value.data === "string" && isDataUri(value.data);
}

// ============================================================================
// HELPERS MIME / FILE
// ============================================================================

export function parseMimeType(dataUri: string): string {
  const match = dataUri.match(/^data:([^;]+);base64,/i);
  return match?.[1]?.toLowerCase() ?? "application/octet-stream";
}

export function inferExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/csv": "csv",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/zip": "zip",
    "application/x-rar-compressed": "rar",
  };
  return map[mimeType] ?? "bin";
}

export function sanitizeBaseName(fileName: string): string {
  const raw = fileName.replace(/\.[^.]+$/, "");
  const cleaned = raw.replace(/[^a-zA-Z0-9_. -]+/g, "-").trim();
  return cleaned || "upload";
}

/**
 * Convertit un `PendingUploadValue` (data:URI) en `File` natif + détecte le `docType`
 * (image vs file) en fonction du MIME.
 */
export async function dataUriToFile(
  value: PendingUploadValue,
  fallbackName: string,
): Promise<{ file: File; docType: "image" | "file" }> {
  const mimeType = parseMimeType(value.data);
  const docType: "image" | "file" = mimeType.startsWith("image/") ? "image" : "file";
  const response = await fetch(value.data);
  const blob = await response.blob();

  const extension = inferExtensionFromMimeType(mimeType);
  const sourceName = value.name && value.name.trim() !== "" ? value.name : fallbackName;
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(sourceName);
  const fileName = hasExtension ? sourceName : `${sanitizeBaseName(sourceName)}.${extension}`;

  return {
    file: new File([blob], fileName, { type: mimeType }),
    docType,
  };
}

// ============================================================================
// NETTOYAGE URLS (uploader / simpleTable)
// ============================================================================

/**
 * Nettoie une URL pour ne garder que le chemin relatif.
 * Supprime le baseUrl s'il est présent.
 */
export function cleanUrlToRelativePath(value: unknown): unknown {
  if (typeof value === "string") {
    if (isDataUri(value)) return value;
    const urlMatch = value.match(/^https?:\/\/[^/]+(\/.*)/i);
    if (urlMatch) return urlMatch[1];
    return value;
  }

  if (Array.isArray(value)) return value.map(cleanUrlToRelativePath);

  if (isObjectRecord(value)) {
    // Cas spécial : objet { name, data } utilisé pour les uploads
    if ("data" in value && typeof value.data === "string") {
      const cleanedData =
        typeof value.data === "string" && !isDataUri(value.data)
          ? cleanUrlToRelativePath(value.data)
          : value.data;
      return { ...value, data: cleanedData };
    }
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      cleaned[key] = cleanUrlToRelativePath(val);
    }
    return cleaned;
  }

  return value;
}

/**
 * Suffixes de types d'inputs dont les valeurs contiennent des URLs de fichiers
 * à nettoyer (conversion URL absolue → chemin relatif) avant envoi au serveur.
 */
const INPUT_TYPES_TO_CLEAN_URLS: readonly string[] = [".uploader", ".simpleTable"];

export function shouldCleanUrls(inputType: string | undefined): boolean {
  if (!inputType) return false;
  return INPUT_TYPES_TO_CLEAN_URLS.some((suffix) => inputType.endsWith(suffix));
}

/**
 * Nettoie les URLs des champs uploader uniquement pour ne garder que les chemins relatifs.
 * Ne touche pas aux autres champs (finder, text, etc.) qui peuvent contenir des URLs légitimes.
 */
export function cleanUploaderUrls(data: AllStepsData, formData: CoFormData | null): AllStepsData {
  if (!formData) return data;
  const result: Record<string, unknown> = {};

  for (const [subFormId, subFormData] of Object.entries(data)) {
    if (!isObjectRecord(subFormData)) {
      result[subFormId] = subFormData;
      continue;
    }
    const subForm = formData.inputs?.[subFormId];
    if (!subForm) {
      result[subFormId] = subFormData;
      continue;
    }
    const cleaned: Record<string, unknown> = {};
    for (const [inputId, inputValue] of Object.entries(subFormData as Record<string, unknown>)) {
      const input = subForm.inputs?.[inputId];
      const inputType =
        input && typeof input === "object" && "type" in input
          ? (input.type as string | undefined)
          : undefined;
      cleaned[inputId] = shouldCleanUrls(inputType)
        ? cleanUrlToRelativePath(inputValue)
        : inputValue;
    }
    result[subFormId] = cleaned;
  }
  return result as AllStepsData;
}

// ============================================================================
// COLLECTE DES UPLOADS PENDING
// ============================================================================

/**
 * Parcourt récursivement les données du formulaire pour collecter tous les
 * `data:URI` qui restent à uploader. Renvoie chaque pending avec son `path`
 * et son `inputType` (déduit du schéma `formData`).
 */
export function collectPendingUploads(
  node: unknown,
  path: (string | number)[] = [],
  formData?: CoFormData | null,
): PendingUpload[] {
  const uploads: PendingUpload[] = [];

  const getInputType = (): string | undefined => {
    if (!formData || path.length < 2) return undefined;
    const [subFormId, inputId] = path;
    if (typeof subFormId !== "string" || typeof inputId !== "string") return undefined;
    const subForm = formData.inputs?.[subFormId];
    if (!subForm) return undefined;
    const input = subForm.inputs?.[inputId];
    return input && typeof input === "object" && "type" in input
      ? (input.type as string | undefined)
      : undefined;
  };

  if (typeof node === "string") {
    if (isDataUri(node)) {
      uploads.push({ value: { data: node }, path, inputType: getInputType() });
    }
    return uploads;
  }

  if (isPendingUploadValue(node)) {
    uploads.push({ value: node, path, inputType: getInputType() });
    return uploads;
  }

  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      uploads.push(...collectPendingUploads(item, [...path, index], formData));
    });
    return uploads;
  }

  if (isObjectRecord(node)) {
    Object.entries(node).forEach(([key, value]) => {
      uploads.push(...collectPendingUploads(value, [...path, key], formData));
    });
    return uploads;
  }

  return uploads;
}

// ============================================================================
// UPLOAD KEYS (contentKey + subKey)
// ============================================================================

/**
 * Génère le `contentKey` et `subKey` pour un upload en fonction du type d'input.
 * - `uploader` → `presentation` + subKey basé sur `subFormId.inputId`.
 * - Autres → `slider` sans subKey.
 */
export function getUploadKeys(inputType: string | undefined, path: (string | number)[]) {
  if (inputType && (inputType === "uploader" || inputType.endsWith(".uploader"))) {
    const subKey = path
      .slice(0, 2)
      .filter((p) => typeof p === "string")
      .join(".");
    return {
      contentKey: "presentation",
      subKey: subKey || undefined,
    };
  }
  return { contentKey: "slider", subKey: undefined as string | undefined };
}

// ============================================================================
// NORMALISATION UPLOADER (legacy format)
// ============================================================================

/**
 * Normalise les données d'un input uploader pour la rétrocompatibilité.
 * Format stocké en base :
 * ```
 * { updateDate: ["19/03/2026"], files: { "docId1": "/upload/path1.jpg", ... } }
 * ```
 */
export function normalizeUploaderValue(value: unknown): unknown {
  const today = new Date().toLocaleDateString("fr-FR");

  const toFilesObject = (arr: unknown[]): Record<string, string> => {
    const obj: Record<string, string> = {};
    for (const item of arr) {
      if (isObjectRecord(item) && typeof item.docId === "string" && typeof item.docPath === "string") {
        obj[item.docId as string] = item.docPath as string;
      } else if (typeof item === "string") {
        obj[item] = item;
      }
    }
    return obj;
  };

  if (isObjectRecord(value) && "updateDate" in value && Array.isArray(value.updateDate)) {
    if (isObjectRecord(value.files)) return value;
    if (Array.isArray(value.files)) return { ...value, files: toFilesObject(value.files) };
    return value;
  }

  if (Array.isArray(value)) {
    return { updateDate: [today], files: toFilesObject(value) };
  }

  return value;
}

/**
 * Normalise récursivement toutes les données de réponse pour gérer la
 * rétrocompatibilité des inputs uploader (format `{updateDate, files}`).
 */
export function normalizeAnswerData(
  data: unknown,
  formData: CoFormData | null,
  path: (string | number)[] = [],
): unknown {
  if (Array.isArray(data)) {
    return data.map((item, index) => normalizeAnswerData(item, formData, [...path, index]));
  }

  if (isObjectRecord(data)) {
    // Vérifier si on est au niveau d'un input uploader
    if (path.length === 2 && formData) {
      const [subFormId, inputId] = path;
      if (typeof subFormId === "string" && typeof inputId === "string") {
        const subForm = formData.inputs?.[subFormId];
        const input = subForm?.inputs?.[inputId];
        const inputType =
          input && typeof input === "object" && "type" in input
            ? (input.type as string | undefined)
            : undefined;
        if (inputType && inputType.endsWith(".uploader")) {
          return normalizeUploaderValue(data);
        }
      }
    }

    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      normalized[key] = normalizeAnswerData(value, formData, [...path, key]);
    }
    return normalized;
  }

  return data;
}

// ============================================================================
// ACCÈS PATHED (get/set par chemin imbriqué)
// ============================================================================

/** Récupère la valeur à un chemin spécifique dans un objet nested. */
export function getValueAtPath(obj: unknown, path: (string | number)[]): unknown {
  if (path.length === 0) return obj;
  const [first, ...rest] = path;
  if (Array.isArray(obj)) return getValueAtPath(obj[first as number], rest);
  if (isObjectRecord(obj)) return getValueAtPath(obj[first as string], rest);
  return undefined;
}

/** Définit une valeur à un chemin spécifique dans un objet nested (immutable). */
export function setValueAtPath(obj: unknown, path: (string | number)[], value: unknown): unknown {
  if (path.length === 0) return value;
  const [first, ...rest] = path;
  if (Array.isArray(obj)) {
    const newArray = [...obj];
    newArray[first as number] = setValueAtPath(newArray[first as number], rest, value);
    return newArray;
  }
  if (isObjectRecord(obj)) {
    return { ...obj, [first]: setValueAtPath(obj[first as string], rest, value) };
  }
  return obj;
}

// ============================================================================
// BATCH UPLOAD
// ============================================================================

/**
 * Upload par batches pour éviter de surcharger le serveur.
 * Default batch size : 4 fichiers en parallèle.
 */
export async function uploadInBatches<T, R = string>(
  items: T[],
  uploadFn: (item: T, index: number) => Promise<R>,
  batchSize: number = 4,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => uploadFn(item, i + batchIndex)),
    );
    results.push(...batchResults);
  }

  return results;
}
