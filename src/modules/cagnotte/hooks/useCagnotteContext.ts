import { useContext } from "react";
import {
  CagnotteContext,
  type CagnotteContextValue,
} from "@/modules/cagnotte/contexts/CagnotteContext";

/**
 * Hook pour consommer le `CagnotteContext`.
 *
 * Variante **strict** : throw si pas dans un `<CagnotteProvider>`.
 * À utiliser dans les composants qu'on SAIT être rendus sous un Provider
 * (typiquement les sections cagnotte rendues par `<CagnotteLayout>`).
 *
 * @throws Error si appelé hors d'un Provider — signal d'erreur de wiring.
 */
export function useCagnotteContext(): CagnotteContextValue {
  const ctx = useContext(CagnotteContext);
  if (!ctx) {
    throw new Error(
      "useCagnotteContext must be used within a CagnotteProvider. " +
        "Ensure the section is rendered inside <CagnotteLayout> or wrap manually with <CagnotteProvider>."
    );
  }
  return ctx;
}

/**
 * Variante **safe** : retourne `null` si pas dans un Provider.
 * À utiliser uniquement pour les composants qui peuvent vivre dans ou hors
 * d'un Provider (cas legacy pendant la migration depuis `window.dispatchEvent`).
 *
 * Préférer `useCagnotteContext()` quand possible.
 */
export function useCagnotteContextSafe(): CagnotteContextValue | null {
  return useContext(CagnotteContext);
}
