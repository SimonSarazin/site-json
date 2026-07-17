import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";

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
  const queryClient = useQueryClient();
  const t = useT("modules/admin");
  return useMutation({
    mutationFn: async ({ entity, reason }: { entity: DeletableEntity; reason?: string }) => {
      await entity.delete(reason);
    },
    onSuccess: () => {
      toast.success(t("useDeleteEntity.success"));
      // REVIEW M5 : invalide toutes les requêtes admin (autres onglets/filtres/tuiles dashboard).
      void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("admin-") });
      onDeleted?.();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("useDeleteEntity.error"));
    },
  });
}
