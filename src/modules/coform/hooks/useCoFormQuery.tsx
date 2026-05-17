import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../constants";
import type { CoFormData, CoFormAccessInfo, CoFormAnswer, SubFormData, AllStepsData } from "../types";

interface UseCoFormQueryOptions {
  /** ID du formulaire à charger */
  formId: string;
  /** Activer/désactiver la requête */
  enabled?: boolean;
}

interface UseCoFormQueryReturn {
  formData: CoFormData | null;
  access: CoFormAccessInfo | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  stepsCount: number;
  isMultiStep: boolean;
}

/**
 * Hook pour charger un formulaire CoForm depuis l'API
 * Utilise l'endpoint GET_COFORM_BY_ID créé dans cocolight-api-client
 */
export function useCoFormQuery({ formId, enabled = true }: UseCoFormQueryOptions): UseCoFormQueryReturn {
  const { api, loading } = useCocolight();
  const isReady = !loading && !!api;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: COFORM_QUERY_KEYS.form(formId),
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");
      
      // Façade `Api.form({ id })` (cf. Api.d.ts:66) — retourne une instance `Form` typée.
      const form = await api.form({ id: formId });
      // `Form.serverData` est typé `FormItemNormalized` côté lib ; le type local `CoFormData`
      // diffère (sous-ensemble enrichi). Cast structurel maintenu.
      return form.serverData as unknown as CoFormData;
    },
    enabled: enabled && isReady && !!formId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Calculer le nombre d'étapes
  const stepsCount = data?.inputs ? Object.keys(data.inputs).length : 0;
  const isMultiStep = stepsCount > 1;

  // Extraire les informations d'accès
  const access = data?.access ?? null;

  return {
    formData: data ?? null,
    access,
    isLoading,
    error: error as Error | null,
    refetch,
    stepsCount,
    isMultiStep,
  };
}

interface UseCoFormStepMutationOptions {
  /** ID du formulaire */
  formId: string;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

interface StepSubmitData {
  subFormId: string;
  data: SubFormData;
  stepIndex: number;
}

/**
 * Hook pour soumettre les données d'une étape
 * Sauvegarde locale en cache — pas d'appel API intermédiaire.
 *
 * @unused Pas de consommateur dans le repo au 2026-05-17 (vérifié `grep -rn "useCoFormStepMutation" src/`).
 * Conservé pour usage futur prévu — potentiellement pour ajouter du tracking analytics
 * par étape, ou pour un mode autosave qui appellerait `saveStepData` du Provider.
 * Son comportement actuel (`console.log` + `invalidateQueries`) est volontairement minimal.
 */
export function useCoFormStepMutation({ formId, onSuccess, onError }: UseCoFormStepMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subFormId, data, stepIndex }: StepSubmitData) => {
      // Sauvegarde en cache local (pas de round trip serveur à chaque étape)
      console.log(`[CoForm] Cache étape ${stepIndex + 1}:`, { formId, subFormId, data });
      return { success: true, subFormId, data };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: COFORM_QUERY_KEYS.formAnswers(formId),
      });
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}

interface UseCoFormFinalMutationOptions {
  /** ID du formulaire */
  formId: string;
  answerId?: string | null;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

interface CoFormFinalMutationData {
  allData: AllStepsData;
  addedOptions?: Record<string, Record<string, string[]>>;
  /** Liens à ajouter dans answer.links (éléments Finder sélectionnés) */
  links?: Record<string, Record<string, { name: string; type: string }>>;
}

interface PendingUploadValue {
  name?: string;
  data: string;
}

interface PendingUpload {
  value: PendingUploadValue;
  path: (string | number)[];
  inputType?: string; // Type de l'input CoForm (ex: "tpls.form.uploader")
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDataUri(value: string): boolean {
  return /^data:[^;]+;base64,/.test(value);
}

function isPendingUploadValue(value: unknown): value is PendingUploadValue {
  if (!isObjectRecord(value)) return false;
  return typeof value.data === "string" && isDataUri(value.data);
}

function parseMimeType(dataUri: string): string {
  const match = dataUri.match(/^data:([^;]+);base64,/i);
  return match?.[1]?.toLowerCase() ?? "application/octet-stream";
}

function inferExtensionFromMimeType(mimeType: string): string {
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

function sanitizeBaseName(fileName: string): string {
  const raw = fileName.replace(/\.[^.]+$/, "");
  const cleaned = raw.replace(/[^a-zA-Z0-9_. -]+/g, "-").trim();
  return cleaned || "upload";
}

async function dataUriToFile(
  value: PendingUploadValue,
  fallbackName: string
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

/**
 * Nettoie une URL pour ne garder que le chemin relatif
 * Supprime le baseUrl s'il est présent
 */
function cleanUrlToRelativePath(value: unknown): unknown {
  if (typeof value === "string") {
    // Si c'est un data URI, on le garde tel quel (sera uploadé)
    if (isDataUri(value)) {
      return value;
    }
    // Si c'est une URL complète, extraire seulement le chemin
    const urlMatch = value.match(/^https?:\/\/[^/]+(\/.*)/i);
    if (urlMatch) {
      return urlMatch[1]; // Retourne seulement le chemin (ex: /upload/...)
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(cleanUrlToRelativePath);
  }

  if (isObjectRecord(value)) {
    // Cas spécial : objet { name, data } utilisé pour les uploads
    if ('data' in value && typeof value.data === 'string') {
      const cleanedData = typeof value.data === 'string' && !isDataUri(value.data)
        ? cleanUrlToRelativePath(value.data)
        : value.data;
      return {
        ...value,
        data: cleanedData,
      };
    }
    
    // Cas général : nettoyer toutes les propriétés
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
 * Ajouter ici tout nouveau type d'input qui stocke des chemins de fichiers.
 */
const INPUT_TYPES_TO_CLEAN_URLS: readonly string[] = [
  ".uploader",
  ".simpleTable",
];

function shouldCleanUrls(inputType: string | undefined): boolean {
  if (!inputType) return false;
  return INPUT_TYPES_TO_CLEAN_URLS.some((suffix) => inputType.endsWith(suffix));
}

/**
 * Nettoie les URLs des champs uploader uniquement pour ne garder que les chemins relatifs.
 * Ne touche pas aux autres champs (finder, text, etc.) qui peuvent contenir des URLs légitimes.
 */
function cleanUploaderUrls(data: AllStepsData, formData: CoFormData | null): AllStepsData {
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
      const inputType = input && typeof input === 'object' && 'type' in input
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

/**
 * Collecte tous les fichiers pending dans la structure de données
 */
function collectPendingUploads(
  node: unknown, 
  path: (string | number)[] = [],
  formData?: CoFormData | null
): PendingUpload[] {
  const uploads: PendingUpload[] = [];
  
  // Déterminer le type d'input depuis le path et formData
  const getInputType = (): string | undefined => {
    if (!formData || path.length < 2) return undefined;
    const [subFormId, inputId] = path;
    if (typeof subFormId !== "string" || typeof inputId !== "string") return undefined;
    
    const subForm = formData.inputs?.[subFormId];
    if (!subForm) return undefined;
    
    const input = subForm.inputs?.[inputId];
    // Utiliser 'type' (structure réelle des données)
    const inputType = input && typeof input === 'object' && 'type' in input 
      ? (input.type as string | undefined)
      : undefined;
    return inputType;
  };

  if (typeof node === "string") {
    if (isDataUri(node)) {
      uploads.push({ 
        value: { data: node }, 
        path,
        inputType: getInputType(),
      });
    }
    return uploads;
  }

  if (isPendingUploadValue(node)) {
    uploads.push({ 
      value: node, 
      path,
      inputType: getInputType(),
    });
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

/**
 * Génère le contentKey et subKey pour un upload en fonction du type d'input
 */
function getUploadKeys(inputType: string | undefined, path: (string | number)[]) {
  // Pour l'input uploader (type peut être "uploader" ou "tpls.forms.uploader"), 
  // toujours utiliser "presentation" avec subKey
  if (inputType && (inputType === "uploader" || inputType.endsWith(".uploader"))) {
    // Générer un subKey basé sur les 2 premiers segments du path (subFormId.inputId)
    // On prend uniquement les 2 premiers pour éviter d'inclure "files" ou d'autres clés internes
    const subKey = path.slice(0, 2).filter(p => typeof p === "string").join(".");
    return {
      contentKey: "presentation",
      subKey: subKey || undefined,
    };
  }
  
  // Pour les autres inputs (ex: images dans d'autres champs), utiliser "slider" sans subKey
  return {
    contentKey: "slider",
    subKey: undefined,
  };
}

/**
 * Normalise les données d'un input uploader pour la rétrocompatibilité
 * Format stocké en base :
 * { 
 *   updateDate: ["19/03/2026"],
 *   files: { "docId1": "/upload/path1.jpg", "docId2": "/upload/path2.jpg" }
 * }
 * Où chaque clé est l'ID MongoDB du document.
 */
function normalizeUploaderValue(value: unknown): unknown {
  const today = new Date().toLocaleDateString('fr-FR');

  const toFilesObject = (arr: unknown[]): Record<string, string> => {
    const obj: Record<string, string> = {};
    for (const item of arr) {
      if (isObjectRecord(item) && typeof item.docId === 'string' && typeof item.docPath === 'string') {
        obj[item.docId as string] = item.docPath as string;
      } else if (typeof item === 'string') {
        // Chemin string brut sans docId (ancien format) — clé = valeur en fallback
        obj[item] = item;
      }
    }
    return obj;
  };

  // Si c'est déjà un objet avec updateDate (format legacy / stocké)
  if (isObjectRecord(value) && 'updateDate' in value && Array.isArray(value.updateDate)) {
    // Si files est déjà un objet Record (format DB final), garder tel quel
    if (isObjectRecord(value.files)) {
      return value;
    }
    // Si files est un tableau (format de travail du composant), convertir en objet
    if (Array.isArray(value.files)) {
      return { ...value, files: toFilesObject(value.files) };
    }
    return value;
  }
  
  // Si c'est un tableau (première soumission, pas encore wrappé)
  if (Array.isArray(value)) {
    return {
      updateDate: [today],
      files: toFilesObject(value),
    };
  }
  
  return value;
}

/**
 * Normalise récursivement toutes les données de réponse pour gérer la rétrocompatibilité
 * des inputs uploader
 */
function normalizeAnswerData(data: unknown, formData: CoFormData | null, path: (string | number)[] = []): unknown {
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
        const inputType = input && typeof input === 'object' && 'type' in input 
          ? (input.type as string | undefined)
          : undefined;
        
        // Si c'est un input uploader, normaliser la valeur
        if (inputType && inputType.endsWith(".uploader")) {
          return normalizeUploaderValue(data);
        }
      }
    }
    
    // Sinon, normaliser récursivement tous les champs
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      normalized[key] = normalizeAnswerData(value, formData, [...path, key]);
    }
    return normalized;
  }
  
  return data;
}

/**
 * Remplace un fichier pending par son docPath dans la structure
 */
/**
 * Récupère la valeur à un chemin spécifique dans un objet nested
 */
function getValueAtPath(obj: unknown, path: (string | number)[]): unknown {
  if (path.length === 0) return obj;
  
  const [first, ...rest] = path;
  
  if (Array.isArray(obj)) {
    return getValueAtPath(obj[first as number], rest);
  }
  
  if (isObjectRecord(obj)) {
    return getValueAtPath(obj[first as string], rest);
  }
  
  return undefined;
}

/**
 * Définit une valeur à un chemin spécifique dans un objet nested
 */
function setValueAtPath(obj: unknown, path: (string | number)[], value: unknown): unknown {
  if (path.length === 0) return value;
  
  const [first, ...rest] = path;
  
  if (Array.isArray(obj)) {
    const newArray = [...obj];
    newArray[first as number] = setValueAtPath(newArray[first as number], rest, value);
    return newArray;
  }
  
  if (isObjectRecord(obj)) {
    return {
      ...obj,
      [first]: setValueAtPath(obj[first as string], rest, value),
    };
  }
  
  return obj;
}

/**
 * Upload par batches pour éviter de surcharger le serveur
 */
async function uploadInBatches<T, R = string>(
  items: T[],
  uploadFn: (item: T, index: number) => Promise<R>,
  batchSize: number = 4
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => uploadFn(item, i + batchIndex))
    );
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Hook pour soumettre le formulaire complet via l'API
 * Supporte la création (nouvelle réponse) et la mise à jour (answerId fourni)
 */
export function useCoFormFinalMutation({ formId, answerId, onSuccess, onError }: UseCoFormFinalMutationOptions) {
  const { api } = useCocolight();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ allData, addedOptions, links }: CoFormFinalMutationData) => {
      if (!api) throw new Error("API non initialisée");

      // Récupérer les métadonnées du formulaire depuis le cache
      const formData = queryClient.getQueryData<CoFormData>(COFORM_QUERY_KEYS.form(formId)) ?? null;

      // Collecter tous les fichiers à uploader avec les types d'input
      const pendingUploads = collectPendingUploads(allData, [], formData);
      
      if (pendingUploads.length === 0) {
        // Pas de fichiers, soumission directe
        // Nettoyer les URLs uniquement dans les champs uploader
        const cleanedData = cleanUploaderUrls(allData, formData);
        const response = await api.endpointApi.saveCoformAnswer({
          formId,
          answers: JSON.stringify(cleanedData),
          ...(answerId ? { answerId } : {}),
          ...(addedOptions ? { addedOptions: JSON.stringify(addedOptions) } : {}),
          ...(links && Object.keys(links).length > 0 ? { links: JSON.stringify(links) } : {}),
        });
        return response;
      }

      // Si pas d'answerId, faire le premier upload séparément pour l'obtenir
      let activeAnswerId = answerId ?? undefined;
      let preparedData = allData; // Utiliser allData directement, pas cleanedData
      let startIndex = 0;

      if (!activeAnswerId && pendingUploads.length > 0) {
        // Premier upload pour obtenir l'answerId
        const firstPending = pendingUploads[0];
        const { file, docType } = await dataUriToFile(firstPending.value, "upload-1");
        const { contentKey, subKey } = getUploadKeys(firstPending.inputType, firstPending.path);

        const firstUploadResponse = await api.endpointApi.coformUploadAnswerFile({
          formId,
          docType,
          contentKey,
          ...(subKey ? { subKey } : {}),
          qquuid: crypto.randomUUID(),
          qqfilename: file.name,
          qqtotalfilesize: file.size,
          // `qqfile` est typé `{ [k: string]: unknown }` côté lib (CoformUploadAnswerFileData) :
          // le `File` natif n'est pas reconnu comme tel, d'où le cast structurel.
          qqfile: file as unknown as Record<string, unknown>,
        });

        const firstUploadData = (firstUploadResponse?.serverData ?? firstUploadResponse) as {
          result?: boolean;
          success?: boolean;
          msg?: string;
          answerId?: string;
          docPath?: string;
          id?: string;
        };

        if (!firstUploadData || (firstUploadData.result !== true && firstUploadData.success !== true)) {
          throw new Error(firstUploadData?.msg || "Echec du premier upload");
        }

        if (!firstUploadData.answerId || !firstUploadData.docPath) {
          throw new Error("Le premier upload n'a pas retourné answerId ou docPath");
        }

        // Mémoriser l'answerId pour tous les uploads suivants
        activeAnswerId = firstUploadData.answerId;
        
        // Remplacer le premier item à son chemin exact
        // Format { docId, docPath } uniquement pour les inputs uploader (normalisation ultérieure)
        // Pour les autres : juste le docPath string
        const isUploaderInput = firstPending.inputType?.endsWith(".uploader");
        preparedData = setValueAtPath(
          preparedData,
          firstPending.path,
          isUploaderInput
            ? { docId: firstUploadData.id, docPath: firstUploadData.docPath }
            : firstUploadData.docPath,
        ) as AllStepsData;
        
        startIndex = 1; // Commencer à partir du 2ème fichier
      }

      // Upload des fichiers restants par batches de 4 (avec answerId)
      if (startIndex < pendingUploads.length) {
        const remainingUploads = pendingUploads.slice(startIndex);
        
        const remainingDocPaths = await uploadInBatches(
          remainingUploads,
          async (pending, index) => {
            const fallbackName = `upload-${startIndex + index + 1}`;
            const { file, docType } = await dataUriToFile(pending.value, fallbackName);
            const { contentKey, subKey } = getUploadKeys(pending.inputType, pending.path);

            const uploadResponse = await api.endpointApi.coformUploadAnswerFile({
              formId,
              answerId: activeAnswerId!, // On a forcément un answerId ici
              docType,
              contentKey,
              ...(subKey ? { subKey } : {}),
              qquuid: crypto.randomUUID(),
              qqfilename: file.name,
              qqtotalfilesize: file.size,
              qqfile: file as unknown as Record<string, unknown>,
            });

            const uploadData = (uploadResponse?.serverData ?? uploadResponse) as {
              result?: boolean;
              success?: boolean;
              msg?: string;
              answerId?: string;
              docPath?: string;
              id?: string;
            };

            if (!uploadData || (uploadData.result !== true && uploadData.success !== true)) {
              throw new Error(uploadData?.msg || "Echec du pre-upload de fichier");
            }

            if (!uploadData.docPath) {
              throw new Error("Le pre-upload n'a pas retourné de docPath");
            }

            // Format { docId, docPath } uniquement pour les inputs uploader
            const isUploader = pending.inputType?.endsWith(".uploader");
            return isUploader
              ? { docId: uploadData.id, docPath: uploadData.docPath }
              : uploadData.docPath;
          },
          4 // Upload 4 fichiers à la fois
        );

        // Remplacer les fichiers restants à leur chemin exact
        remainingUploads.forEach((pending, index) => {
          preparedData = setValueAtPath(preparedData, pending.path, remainingDocPaths[index]) as AllStepsData;
        });
      }

      // Normaliser les champs uploader : chaque ImageUploadValue a été remplacé
      // par { docId, docPath }. Il faut maintenant convertir en
      // { updateDate, files: { docId: docPath, ... } }.
      const uploaderFieldKeys = new Map<string, (string | number)[]>();
      for (const pending of pendingUploads) {
        if (pending.inputType?.endsWith(".uploader") && pending.path.length >= 2) {
          const key = JSON.stringify(pending.path.slice(0, 2));
          if (!uploaderFieldKeys.has(key)) {
            uploaderFieldKeys.set(key, pending.path.slice(0, 2));
          }
        }
      }
      for (const fieldPath of uploaderFieldKeys.values()) {
        const fieldValue = getValueAtPath(preparedData, fieldPath);
        preparedData = setValueAtPath(preparedData, fieldPath, normalizeUploaderValue(fieldValue)) as AllStepsData;
      }
      
      // Nettoyer les URLs uniquement dans les champs uploader
      const finalCleanedData = cleanUploaderUrls(preparedData, formData);
      
      // Sérialiser les réponses en JSON pour l'envoi URL-encoded
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (api.endpointApi as any).saveCoformAnswer({
        formId,
        answers: JSON.stringify(finalCleanedData),
        ...(activeAnswerId ? { answerId: activeAnswerId } : {}),
        ...(addedOptions ? { addedOptions: JSON.stringify(addedOptions) } : {}),
        ...(links && Object.keys(links).length > 0 ? { links: JSON.stringify(links) } : {}),
      });

      return response;
    },
    onSuccess: (data) => {
      // Invalider les caches : formulaire (pour rafraîchir l'access) + réponses
      queryClient.invalidateQueries({
        queryKey: COFORM_QUERY_KEYS.form(formId),
      });
      queryClient.invalidateQueries({
        queryKey: COFORM_QUERY_KEYS.formAnswers(formId),
      });
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}

// ─── Hook pour charger une réponse par ID ─────────────────────────

interface UseCoFormAnswerQueryOptions {
  /** ID du formulaire parent */
  formId: string;
  answerId: string;
  enabled?: boolean;
}

interface UseCoFormAnswerQueryReturn {
  /** Données complètes de la réponse */
  answer: CoFormAnswer | null;
  /** Données de réponses (answers) pour pré-remplissage */
  answerData: AllStepsData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook pour charger une réponse CoForm existante par son ID
 * Utilise l'endpoint COFORM_ANSWERS_BY_ID (findanswered)
 */
export function useCoFormAnswerQuery({
  formId,
  answerId,
  enabled = true,
}: UseCoFormAnswerQueryOptions): UseCoFormAnswerQueryReturn {
  const { api, loading } = useCocolight();
  const queryClient = useQueryClient();
  const isReady = !loading && !!api;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: COFORM_QUERY_KEYS.formAnswer(formId, answerId),
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");

      const response = await api.endpointApi.coformAnswersById({
        answerId,
        fields: ["answers", "user", "created", "updated", "draft", "finished", "form", "canEdit", "editDeniedReason"],
        // Transmettre le formId pour le calcul des droits d'édition côté serveur
        ...(formId ? { formId } : {}),
      });

      const raw = response?.serverData?.data ?? response?.data;
      if (!raw) throw new Error("Réponse introuvable");

      // Normaliser les données pour gérer la rétrocompatibilité des inputs uploader
      const formData = queryClient.getQueryData<CoFormData>(COFORM_QUERY_KEYS.form(formId)) ?? null;
      const normalizedAnswers = raw.answers 
        ? normalizeAnswerData(raw.answers, formData) 
        : raw.answers;

      return {
        ...raw,
        answers: normalizedAnswers,
      } as CoFormAnswer;
    },
    enabled: enabled && isReady && !!answerId,
    staleTime: 2 * 60 * 1000,
  });

  return {
    answer: data ?? null,
    answerData: (data?.answers as AllStepsData) ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
