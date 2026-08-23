import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";
import { SEARCH_STATIC_LIST_PREFIX } from "@/modules/search/constants/queryKeys";
import { runExclusiveFlag, type ExclusiveWritable } from "../lib/exclusiveFlag";

/** Entité admin exposant `updateField` (PATCH single-field, `UPDATE_PATH_VALUE`) — même contrat
 *  que `CardEventFeatured`/`CardDetailedDefault` pour leur toggle `isStarred`. */
export type ExclusiveFlagEntity = ExclusiveWritable;

/**
 * Bascule un champ booléen EXCLUSIF (ex. `featured`/« à la une ») — enveloppe react-query de
 * `runExclusiveFlag` (l'orchestration pure, testée) : cible d'abord, puis unset du périmètre
 * SERVEUR (`fetchFlagged`, jamais les lignes chargées), best-effort par fiche. Depuis la chaîne
 * `costumSlug` (lib+backend), l'écriture sur les fiches d'autrui passe par l'allowance
 * costum-admin — le multi-admin fonctionne.
 *
 * Invalidation : tableau admin + sections publiques searchProStatic + FIL BLOG (les surfaces
 * actualités vivent sur `blog:<slug>` depuis la refonte option B) — en SUCCÈS comme en ERREUR
 * (des écritures partielles ont pu avoir lieu, l'UI doit refléter la base, pas l'intention).
 */
export function useSetExclusiveFlag(onDone?: () => void) {
  const queryClient = useQueryClient();
  const t = useT("modules/admin");
  const invalidate = () =>
    queryClient.invalidateQueries({
      predicate: (q) => {
        const k = String(q.queryKey[0] ?? "");
        return k.startsWith("admin-") || k.startsWith(SEARCH_STATIC_LIST_PREFIX) || k.startsWith("blog:");
      },
    });
  return useMutation({
    mutationFn: runExclusiveFlag,
    onSuccess: ({ unsetFailures }, vars) => {
      if (unsetFailures > 0) toast.warning(t("useSetExclusiveFlag.partialUnset", undefined, { count: String(unsetFailures) }));
      else toast.success(t(vars.value ? "useSetExclusiveFlag.featured" : "useSetExclusiveFlag.unfeatured"));
      void invalidate();
      onDone?.();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("useSetExclusiveFlag.error"));
      void invalidate();
    },
  });
}
