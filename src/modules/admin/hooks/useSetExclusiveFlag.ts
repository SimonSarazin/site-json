import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";
import { SEARCH_STATIC_LIST_PREFIX } from "@/modules/search/constants/queryKeys";
import { itemsToUnset, type ExclusiveFlagRow } from "../lib/exclusiveFlag";

/** Entité admin exposant `updateField` (PATCH single-field, `UPDATE_PATH_VALUE`) — même contrat
 *  que `CardEventFeatured`/`CardDetailedDefault` pour leur toggle `isStarred`. */
export interface ExclusiveFlagEntity extends ExclusiveFlagRow {
  updateField: (path: string, value: unknown) => Promise<unknown>;
}

/**
 * Bascule un champ booléen EXCLUSIF (P3, ex. `featured`/« à la une ») : en mettant `target` à
 * `true`, repasse d'abord à `false` toute autre ligne CHARGÉE qui portait déjà le flag (cf.
 * `itemsToUnset` — portée limitée aux lignes en mémoire, pas une recherche dédiée sur tout le
 * périmètre, volumétrie admin usuelle). En retirant (`value:false`), ne touche que `target`.
 *
 * Best-effort séquentiel comme `bulkValidate`/`bulkDelete` (pas de transaction serveur) — une
 * collision entre deux admins cliquant simultanément sur deux lignes différentes est une
 * limitation connue et acceptée (cf. doc-projet), pas un bug à corriger ici.
 */
export function useSetExclusiveFlag(onDone?: () => void) {
  const queryClient = useQueryClient();
  const t = useT("modules/admin");
  return useMutation({
    mutationFn: async ({
      field,
      value,
      target,
      rows,
    }: {
      field: string;
      value: boolean;
      target: ExclusiveFlagEntity;
      rows: ExclusiveFlagEntity[];
    }) => {
      if (value) {
        const targetId = target.id ?? (target.serverData as { id?: unknown } | undefined)?.id;
        for (const other of itemsToUnset(rows, field, targetId != null ? String(targetId) : null)) {
          await (other as ExclusiveFlagEntity).updateField(field, false);
        }
      }
      await target.updateField(field, value);
    },
    onSuccess: (_res, vars) => {
      toast.success(t(vars.value ? "useSetExclusiveFlag.featured" : "useSetExclusiveFlag.unfeatured"));
      // Rafraîchit le tableau admin ET les sections publiques (home « à la une » + grille) — même
      // périmètre que `invalidate:standard` côté formEngine (searchKeys:["searchCostumStatic"]).
      void queryClient.invalidateQueries({
        predicate: (q) => {
          const k = String(q.queryKey[0] ?? "");
          return k.startsWith("admin-") || k.startsWith(SEARCH_STATIC_LIST_PREFIX);
        },
      });
      onDone?.();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("useSetExclusiveFlag.error"));
    },
  });
}
