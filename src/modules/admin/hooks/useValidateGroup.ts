import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";
import { publicSurfaceKeys } from "@/lib/queryKeys";
import { useCocolight } from "@/hooks/useCocolight";

/**
 * Carrier costum exposant `validateGroup` (BaseEntity, lib ≥ 1.0.159) : (dé)valide un élément pour le
 * costum courant (unset/set preferences.toBeValidated[slug]) avec cascade côté serveur (ValidateGroupAction).
 */
export interface ValidatableCarrier {
  validateGroup: (type: string, id: string, valid: boolean) => Promise<{ result: boolean; msg?: string }>;
}

/** Mutation de (dé)validation d'un élément sous le costum du carrier (P4). Toast + refetch de la liste. */
export function useValidateGroup(onDone?: () => void) {
  const queryClient = useQueryClient();
  // Slug du costum PORTEUR — scope le fil blog dans `publicSurfaceKeys` (le slug de la
  // fiche touchée n'aurait aucun sens ici).
  const { entity: porteur } = useCocolight();
  const t = useT("modules/admin");
  return useMutation({
    mutationFn: async ({ carrier, type, id, valid }: { carrier: ValidatableCarrier; type: string; id: string; valid: boolean }) => {
      const res = await carrier.validateGroup(type, id, valid);
      // Un REFUS métier arrive en HTTP 200 avec `{result:false, msg}` (backend Node : garde
      // `isCostumAdmin` sur le costum ciblé, admin.routes.ts) — sans ce test `onSuccess` affichait
      // « Validé » alors que RIEN n'avait été écrit, et le refetch reposait la ligne en attente.
      if (res && res.result === false) throw new Error(res.msg || t("useValidateGroup.error"));
      return res;
    },
    onSuccess: (_res, vars) => {
      toast.success(t(vars.valid ? "useValidateGroup.validated" : "useValidateGroup.invalidated"));
      // REVIEW M5 : invalide TOUTES les requêtes admin (autres filtres statut, Contenu vs
      // Référencement, tuiles dashboard) — le refetch() du composant ne couvre que la clé active.
      void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("admin-") });
      // …et les surfaces PUBLIQUES : ce geste change la VISIBILITÉ d'une fiche, or les listes du site
      // vivent dans des espaces de clés disjoints de `admin-*` (search, agenda, fil blog). Sans ça,
      // la page publique reste sur son cache jusqu'au rechargement — alors que le chemin FORMULAIRE,
      // lui, les rafraîchit déjà via l'`invalidateFn` du costumForm.
      for (const key of publicSurfaceKeys(porteur?.slug ?? undefined)) void queryClient.invalidateQueries({ queryKey: key });
      onDone?.();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("useValidateGroup.error"));
    },
  });
}
