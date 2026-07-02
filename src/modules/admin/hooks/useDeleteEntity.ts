import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Entité supprimable : org/project/poi/event/answer exposent un `delete(reason)` public (→ backend
 * `element/delete`, autorisation `canDeleteElement`, auteur d'answer inclus depuis le fix de parité).
 */
export interface DeletableEntity {
  id: string | null;
  delete: (reason?: string) => Promise<void>;
}

/**
 * Mutation générique de suppression d'une entité (P2). Toast + callback (refetch de la liste).
 * Best-effort côté bulk : l'appelant boucle et agrège (cf. deleteFiles legacy).
 */
export function useDeleteEntity(onDeleted?: () => void) {
  return useMutation({
    mutationFn: async ({ entity, reason }: { entity: DeletableEntity; reason?: string }) => {
      await entity.delete(reason);
    },
    onSuccess: () => {
      toast.success("Élément supprimé");
      onDeleted?.();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    },
  });
}
