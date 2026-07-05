import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Carrier costum exposant le référencement (BaseEntity, lib ≥ 1.0.160) : rattache/détache un élément
 * du costum courant (`reference.costum` / `source.keys`) via SET_SOURCE (SetSourceAction).
 */
export interface ReferencingCarrier {
  addReference: (type: string, id: string) => Promise<{ result: boolean }>;
  removeReference: (type: string, id: string) => Promise<{ result: boolean }>;
  removeFromSource: (type: string, id: string) => Promise<{ result: boolean }>;
}

export type ReferenceOp = "reference" | "unreference" | "detach";

/** Mutation de (dé)référencement d'un élément sous le costum du carrier (P5). Toast + refetch. */
export function useReferenceElement(onDone?: () => void) {
  return useMutation({
    mutationFn: async ({ carrier, op, type, id }: { carrier: ReferencingCarrier; op: ReferenceOp; type: string; id: string }) => {
      if (op === "reference") return carrier.addReference(type, id);
      if (op === "unreference") return carrier.removeReference(type, id);
      return carrier.removeFromSource(type, id);
    },
    onSuccess: (_res, vars) => {
      toast.success(vars.op === "reference" ? "Élément référencé" : "Élément détaché");
      onDone?.();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Action de référencement impossible");
    },
  });
}
