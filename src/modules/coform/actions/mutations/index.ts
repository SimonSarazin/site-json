/**
 * Re-exports des mutations CoForm.
 *
 * Permet l'import court `from "@/modules/coform/actions/mutations"` sans connaître
 * la structure interne. Aligné avec `cagnotte/actions/mutations/index.ts`.
 */

export {
  createCoFormMutation,
  CoFormContextError,
  type CoFormMutationContext,
  type ResolvedCoFormContext,
  type CoFormMutationConfig,
} from "./core";

export {
  useCoFormFinalMutation,
  type UseCoFormFinalMutationOptions,
  type CoFormFinalMutationData,
} from "./file";

// Re-export des helpers d'upload pour les call-sites avancés (tests, integration).
export {
  isObjectRecord,
  isDataUri,
  isPendingUploadValue,
  parseMimeType,
  inferExtensionFromMimeType,
  sanitizeBaseName,
  dataUriToFile,
  cleanUrlToRelativePath,
  shouldCleanUrls,
  cleanUploaderUrls,
  collectPendingUploads,
  getUploadKeys,
  normalizeUploaderValue,
  normalizeAnswerData,
  getValueAtPath,
  setValueAtPath,
  uploadInBatches,
  type PendingUpload,
  type PendingUploadValue,
} from "./uploadHelpers";
