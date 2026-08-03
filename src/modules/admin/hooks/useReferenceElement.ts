import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";

/**
 * Carrier costum exposant le référencement (BaseEntity, lib ≥ 1.0.160) : rattache/détache un élément
 * du costum courant (`reference.costum` / `source.keys`) via SET_SOURCE (SetSourceAction).
 */
export interface ReferencingCarrier {
  addReference: (type: string, id: string) => Promise<{ result: boolean; msg?: string } | null>;
  removeReference: (type: string, id: string) => Promise<{ result: boolean; msg?: string } | null>;
  removeFromSource: (type: string, id: string) => Promise<{ result: boolean; msg?: string } | null>;
}

export type ReferenceOp = "reference" | "unreference" | "detach";

/** Mutation de (dé)référencement d'un élément sous le costum du carrier (P5). Toast + refetch. */
export function useReferenceElement(onDone?: () => void) {
  const queryClient = useQueryClient();
  const t = useT("modules/admin");
  return useMutation({
    mutationFn: async ({ carrier, op, type, id }: { carrier: ReferencingCarrier; op: ReferenceOp; type: string; id: string }) => {
      const res =
        op === "reference" ? await carrier.addReference(type, id)
        : op === "unreference" ? await carrier.removeReference(type, id)
        : await carrier.removeFromSource(type, id);
      // Refus métier en HTTP 200 (`{result:false, msg}`, ex. SetSourceAction « You can't add existed
      // element as sourceKey ») — sinon toast de succès sur une écriture qui n'a pas eu lieu.
      // `null` = champ absent (parité legacy `Rest::json(null)`) : pas un échec.
      if (res && res.result === false) throw new Error(res.msg || t("useReferenceElement.error"));
      return res;
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
