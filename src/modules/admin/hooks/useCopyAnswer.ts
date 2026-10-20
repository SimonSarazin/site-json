import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { publicSurfaceKeys } from "@/lib/queryKeys";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { getEntityId } from "@/modules/cagnotte/utils/dataTransform";
import "@/modules/admin/i18n";

/**
 * Réponse de l'action `copy` de `survey/answer/newanswer/form/<cible>` (backend
 * `Coform::copyAnswer`). `result:false` n'arrive jamais ici : la lib lève dessus
 * (`checkAndThrowApiResponseError`) avec le `msg` serveur — garde d'autorisation et liste
 * blanche des sources comprises.
 */
export interface CopyAnswerResult {
  result: boolean;
  msg?: string | null;
  /** Document de la copie (existante si `alreadyCopied`). */
  answer?: Record<string, unknown> | null;
  /** La source avait déjà une copie (`copiedFrom`) : rien n'a été écrit. */
  alreadyCopied?: boolean;
  /** Ids d'inputs copiés mais NON déclarés dans le form cible (form source qui a évolué seul). */
  unknownInputs?: string[];
}

export function isCopyAnswerResult(value: unknown): value is CopyAnswerResult {
  return !!value && typeof value === "object" && typeof (value as { result?: unknown }).result === "boolean";
}

export interface CopyAnswerVariables {
  /** Id de la réponse SOURCE. */
  answerId: string;
  /** Intitulé, pour les toasts. */
  name: string;
}

/**
 * Copie une réponse d'un autre form dans `targetForm` — mutation de la section `answerCopy`.
 *
 * Passe par l'endpoint EXISTANT `GENERATE_ANSWER_FROM_FORM` (« nouvelle réponse dans un form »)
 * avec `action: "copy"` + `copyFrom` : son contrat AJV n'interdit pas les clés supplémentaires,
 * et une copie EST une nouvelle réponse du form cible. La lib actuelle le transporte donc tel
 * quel — l'extension de contrat est décrite dans `ENDPOINT.md` pour que le schéma la déclare.
 * `costumSlug` est posé explicitement : cet endpoint n'est pas enveloppé costum par la lib, et
 * le serveur scope la copie (`source.key`) sur le costum ambiant avant de se replier sur l'orga
 * porteuse du form.
 *
 * `useMutation` brut plutôt que `useMutationWithToast` : la clé de succès dépend de la réponse
 * (`alreadyCopied`), un toast d'avertissement s'ajoute (`unknownInputs`) et l'invalidation se
 * fait par PRÉDICAT (`admin-*`), que `invalidateQueries: QueryKey[]` ne permet pas.
 *
 * Après succès : `onCopied(sourceId, copyId)` (la section marque la ligne « Copié » sans
 * attendre le refetch), puis invalidation de TOUTES les tables admin (`admin-*` — la cible et
 * l'index des copies en font partie) et des surfaces publiques (la copie peut être « Validé »
 * d'emblée).
 */
export function useCopyAnswer(targetForm: string, onCopied?: (sourceId: string, copyId: string) => void) {
  const { api, entity } = useCocolight();
  const queryClient = useQueryClient();
  const t = useT("modules/admin");
  const costumSlug = entity?.slug ?? undefined;

  return useMutation<CopyAnswerResult, Error, CopyAnswerVariables>({
    mutationFn: async ({ answerId }) => {
      if (!api) throw new Error(t("useCopyAnswer.noApi"));
      const res: unknown = await api.endpointApi.generateAnswerFromForm({
        pathParams: { formId: targetForm },
        action: "copy",
        copyFrom: answerId,
        ...(costumSlug ? { costumSlug } : {}),
      });
      if (!isCopyAnswerResult(res)) throw new Error(t("useCopyAnswer.badResponse"));
      return res;
    },
    onSuccess: (res, { answerId, name }) => {
      showSuccessToast(res.alreadyCopied ? "useCopyAnswer.alreadyCopied" : "useCopyAnswer.success", t, { name });
      const unknown = res.unknownInputs?.length ?? 0;
      if (unknown > 0) {
        toast.warning(t("useCopyAnswer.unknownInputs", undefined, { name, count: String(unknown) }));
      }
      onCopied?.(answerId, getEntityId(res.answer ?? undefined));
      void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("admin-") });
      for (const key of publicSurfaceKeys(costumSlug)) void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error, { name }) => showErrorToast(error, "useCopyAnswer.error", t, { name }),
  });
}
