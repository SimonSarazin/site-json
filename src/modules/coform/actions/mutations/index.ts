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
