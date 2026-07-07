import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";

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
  const queryClient = useQueryClient();
  const t = useT("modules/admin");
  return useMutation({
    mutationFn: async ({ carrier, op, type, id }: { carrier: ReferencingCarrier; op: ReferenceOp; type: string; id: string }) => {
      if (op === "reference") return carrier.addReference(type, id);
      if (op === "unreference") return carrier.removeReference(type, id);
      return carrier.removeFromSource(type, id);
    },
    onSuccess: (_res, vars) => {
      const msg = t(vars.op === "reference" ? "useReferenceElement.referenced" : vars.op === "unreference" ? "useReferenceElement.unreferenced" : "useReferenceElement.detached");
      toast.success(msg);
      // REVIEW M5 : invalide TOUTES les requêtes admin (autres filtres statut, Contenu vs
      // Référencement, tuiles dashboard) — le refetch() du composant ne couvre que la clé active.
      void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("admin-") });
      onDone?.();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("useReferenceElement.error"));
    },
  });
}
