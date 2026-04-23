import { useContext } from "react";
import { CoFormContext, type CoFormContextType } from "../contexts/CoFormContext";

/**
 * Hook principal pour accéder au contexte CoForm
 * @throws Error si utilisé en dehors d'un CoFormProvider
 */
export function useCoForm(): CoFormContextType {
  const context = useContext(CoFormContext);

  if (!context.formData && context.totalSteps === 0) {
    throw new Error("useCoForm doit être utilisé à l'intérieur d'un CoFormProvider");
  }

  return context;
}

/**
 * Hook optionnel - retourne null si hors du provider
 */
export function useOptionalCoForm(): CoFormContextType | null {
  const context = useContext(CoFormContext);

  if (!context.formData && context.totalSteps === 0) {
    return null;
  }

  return context;
}
