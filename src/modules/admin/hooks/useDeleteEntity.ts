import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";
import { publicSurfaceKeys } from "@/lib/queryKeys";
import { useCocolight } from "@/hooks/useCocolight";

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
  // Slug du costum PORTEUR — scope le fil blog dans `publicSurfaceKeys` (le slug de la
  // fiche touchée n'aurait aucun sens ici).
  const { entity: porteur } = useCocolight();
  const t = useT("modules/admin");
  return useMutation({
    mutationFn: async ({ entity, reason }: { entity: DeletableEntity; reason?: string }) => {
      await entity.delete(reason);
    },
    onSuccess: () => {
      toast.success(t("useDeleteEntity.success"));
      // REVIEW M5 : invalide toutes les requêtes admin (autres onglets/filtres/tuiles dashboard).
      void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("admin-") });
      // …et les surfaces PUBLIQUES : ce geste change la VISIBILITÉ d'une fiche, or les listes du site
      // vivent dans des espaces de clés disjoints de `admin-*` (search, agenda, fil blog). Sans ça,
      // la page publique reste sur son cache jusqu'au rechargement — alors que le chemin FORMULAIRE,
      // lui, les rafraîchit déjà via l'`invalidateFn` du costumForm.
      for (const key of publicSurfaceKeys(porteur?.slug ?? undefined)) void queryClient.invalidateQueries({ queryKey: key });
      onDeleted?.();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("useDeleteEntity.error"));
    },
  });
}
