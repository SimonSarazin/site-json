/**
 * Mutation de soumission finale d'un formulaire CoForm avec pipeline d'upload de fichiers.
 *
 * Extrait de `hooks/useCoFormQuery.tsx` (Sprint 3) pour découpler la query du
 * pipeline d'upload (~190 lignes). Le hook orchestre :
 *  1. Collecte des `data:URI` pending dans la structure (via `collectPendingUploads`).
 *  2. Soumission directe si aucun fichier (cas simple).
 *  3. Sinon : premier upload séparé pour obtenir `answerId`, puis batches de 4
 *     uploads parallèles pour les fichiers restants.
 *  4. Normalisation des champs `uploader` (legacy format `{updateDate, files}`).
 *  5. Nettoyage des URLs absolues → chemins relatifs.
 *  6. POST final `saveCoformAnswer` avec `answers` JSON sérialisé.
 *
 * Garde une signature backward-compatible avec l'ancien `useCoFormFinalMutation`
 * pour ne pas casser les call-sites (`CoFormPage`, `CoFormAnswerPage`, `SmartCoForm`).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../../constants";
import type { AllStepsData, CoFormData } from "../../types";
import {
  cleanUploaderUrls,
  collectPendingUploads,
  dataUriToFile,
  getUploadKeys,
  getValueAtPath,
  normalizeUploaderValue,
  setValueAtPath,
  uploadInBatches,
} from "./uploadHelpers";

export interface UseCoFormFinalMutationOptions {
  /** ID du formulaire */
  formId: string;
  answerId?: string | null;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export interface CoFormFinalMutationData {
  allData: AllStepsData;
  addedOptions?: Record<string, Record<string, string[]>>;
  /** Liens à ajouter dans answer.links (éléments Finder sélectionnés) */
  links?: Record<string, Record<string, { name: string; type: string }>>;
}

/**
 * Hook pour soumettre le formulaire complet via l'API.
 * Supporte la création (nouvelle réponse) et la mise à jour (answerId fourni).
 */
export function useCoFormFinalMutation({
  formId,
  answerId,
  onSuccess,
  onError,
}: UseCoFormFinalMutationOptions) {
  const { api } = useCocolight();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ allData, addedOptions, links }: CoFormFinalMutationData) => {
      if (!api) throw new Error("API non initialisée");

      // Métadonnées du formulaire depuis le cache.
      const formData = queryClient.getQueryData<CoFormData>(COFORM_QUERY_KEYS.form(formId)) ?? null;

      // Collecter tous les fichiers à uploader avec les types d'input.
      const pendingUploads = collectPendingUploads(allData, [], formData);

      if (pendingUploads.length === 0) {
        // Pas de fichiers, soumission directe (nettoyer les URLs uploader).
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

      // Si pas d'answerId, faire le premier upload séparément pour l'obtenir.
      let activeAnswerId = answerId ?? undefined;
      let preparedData = allData;
      let startIndex = 0;

      if (!activeAnswerId && pendingUploads.length > 0) {
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
          // `qqfile` est typé `{ [k: string]: unknown }` côté lib — le `File` natif
          // n'est pas reconnu comme tel, d'où le cast structurel.
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

        activeAnswerId = firstUploadData.answerId;

        // Remplacer le premier item à son chemin exact.
        // Format `{ docId, docPath }` uniquement pour les inputs uploader (normalisation
        // ultérieure). Pour les autres : juste le docPath string.
        const isUploaderInput = firstPending.inputType?.endsWith(".uploader");
        preparedData = setValueAtPath(
          preparedData,
          firstPending.path,
          isUploaderInput
            ? { docId: firstUploadData.id, docPath: firstUploadData.docPath }
            : firstUploadData.docPath,
        ) as AllStepsData;

        startIndex = 1;
      }

      // Upload des fichiers restants par batches de 4 (avec answerId).
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
              answerId: activeAnswerId!,
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

            const isUploader = pending.inputType?.endsWith(".uploader");
            return isUploader
              ? { docId: uploadData.id, docPath: uploadData.docPath }
              : uploadData.docPath;
          },
          4,
        );

        // Remplacer les fichiers restants à leur chemin exact.
        remainingUploads.forEach((pending, index) => {
          preparedData = setValueAtPath(
            preparedData,
            pending.path,
            remainingDocPaths[index],
          ) as AllStepsData;
        });
      }

      // Normaliser les champs uploader : chaque ImageUploadValue a été remplacé
      // par { docId, docPath }. Convertir en { updateDate, files: { docId: docPath, ... } }.
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
        preparedData = setValueAtPath(
          preparedData,
          fieldPath,
          normalizeUploaderValue(fieldValue),
        ) as AllStepsData;
      }

      // Nettoyer les URLs uniquement dans les champs uploader.
      const finalCleanedData = cleanUploaderUrls(preparedData, formData);

      const response = await api.endpointApi.saveCoformAnswer({
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
      queryClient.invalidateQueries({ queryKey: COFORM_QUERY_KEYS.form(formId) });
      queryClient.invalidateQueries({ queryKey: COFORM_QUERY_KEYS.formAnswers(formId) });
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}
