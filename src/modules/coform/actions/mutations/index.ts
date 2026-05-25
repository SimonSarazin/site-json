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

// Note : les helpers d'upload (collectPendingUploads, uploadInBatches, etc.)
// vivaient ici jusqu'au refactor Module 2 — ils sont maintenant centralisés
// dans `@communecter/cocolight-api-client` (Answer.processUploads + co).
// Pour les types lib (PendingUpload, PendingUploadValue, ProcessUploadsOptions),
// importer directement depuis "@communecter/cocolight-api-client".
