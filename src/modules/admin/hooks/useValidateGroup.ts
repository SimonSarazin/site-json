import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Carrier costum exposant `validateGroup` (BaseEntity, lib ≥ 1.0.159) : (dé)valide un élément pour le
 * costum courant (unset/set preferences.toBeValidated[slug]) avec cascade côté serveur (ValidateGroupAction).
 */
export interface ValidatableCarrier {
  validateGroup: (type: string, id: string, valid: boolean) => Promise<{ result: boolean }>;
}

/** Mutation de (dé)validation d'un élément sous le costum du carrier (P4). Toast + refetch de la liste. */
export function useValidateGroup(onDone?: () => void) {
  return useMutation({
    mutationFn: async ({ carrier, type, id, valid }: { carrier: ValidatableCarrier; type: string; id: string; valid: boolean }) => {
      return carrier.validateGroup(type, id, valid);
    },
    onSuccess: (_res, vars) => {
      toast.success(vars.valid ? "Élément validé" : "Validation retirée");
      onDone?.();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Action de validation impossible");
    },
  });
}
