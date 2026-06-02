/**
 * Hook pour sauvegarder les données de contribution cagnotte dans Answer
 * Utilise `Answer.updateField` (atomique par milestone) avec fallback vers `answer.save()`
 *
 * Signature : le caller passe l'entité `Answer` déjà chargée (évite un GET en double).
 */

import { useCallback } from "react";
import type {
  Answer,
  AnswerItemNormalized,
  SaveCoformAnswerData,
} from "@communecter/cocolight-api-client";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolight } from "@/hooks/useCocolight";
import { launchConfettiBurst } from "@/lib/confetti";
import { asRecord as toRecord } from "@/modules/cagnotte/utils/dataTransform";

interface MilestoneFunding {
  milestoneId: string;
  milestoneIndex: number;
  amount: number;
  name?: string;
  price?: number;
}

interface FinancerEntry {
  amount: number;
  date: string;
  user: string;
  id: string;
  name: string;
  type: string;
  fundingType: string;
  [k: string]: unknown;
}

interface financerData {
  id: string;
  name: string;
  type: string;
}

function createFinancerEntry(params: {
  amount: number;
  financerData: financerData;
  userId: string;
}): FinancerEntry {
  return {
    amount: params.amount,
    date: "now",
    user: params.userId,
    id: params.financerData.id,
    name: params.financerData.name,
    type: params.financerData.type,
    fundingType: "prepaid",
  };
}

function getFormIdFromAnswerData(currentAnswerData: AnswerItemNormalized): string {
  const project = toRecord(currentAnswerData.project);
  const answers = toRecord(currentAnswerData.answers);
  const answerMeta = toRecord(currentAnswerData.answer);

  const candidates = [
    // `form` est le champ canonique de AnswerItemNormalized ; les autres alias couvrent
    // les variantes legacy (form_id snake_case, formId imbriqué) renvoyées par
    // certains endpoints backend.
    currentAnswerData.form,
    currentAnswerData.formId,
    currentAnswerData.form_id,
    answerMeta.formId,
    project.formId,
    project.parentFormId,
    project.form_id,
    answers.formId,
    answers.parentFormId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function applyMilestoneFundingsToAnswerData(
  currentAnswerData: AnswerItemNormalized,
  milestoneFundings: MilestoneFunding[],
  financerData: financerData,
  userId: string,
) {
  const cloned = JSON.parse(JSON.stringify(currentAnswerData ?? {})) as Record<string, unknown>;
  const answers = toRecord(cloned.answers);
  const aapStep1 = toRecord(answers.aapStep1);
  const depensesRaw = aapStep1.depense;
  const depenses = Array.isArray(depensesRaw) ? depensesRaw : depensesRaw ? [depensesRaw] : [];

  const depenseMap = new Map<string, Record<string, unknown>>();
  depenses.forEach((depense) => {
    const depenseRecord = toRecord(depense);
    const milestoneId = typeof depenseRecord.milestone === "string" ? depenseRecord.milestone : "";
    if (milestoneId) {
      depenseMap.set(milestoneId, depenseRecord);
    }
  });

  milestoneFundings.forEach(({ milestoneId, amount }) => {
    if (amount <= 0 || !milestoneId) return;

    const depense = depenseMap.get(milestoneId);
    if (!depense) return;

    const currentFinancers = Array.isArray(depense.financer) ? depense.financer : [];
    const financerEntry = createFinancerEntry({ amount, financerData, userId });

    depense.financer = [...currentFinancers, financerEntry];
    depenseMap.set(milestoneId, depense);
  });

  aapStep1.depense = Array.from(depenseMap.values());
  answers.aapStep1 = aapStep1;
  cloned.answers = answers;

  return cloned;
}

function resolveDepenseIndex(params: {
  depenses: Array<Record<string, unknown>>;
  milestoneId: string;
  preferredIndex?: number;
}): number {
  const { depenses, milestoneId, preferredIndex } = params;

  if (Number.isInteger(preferredIndex) && preferredIndex! >= 0 && preferredIndex! < depenses.length) {
    const preferredDepense = toRecord(depenses[preferredIndex as number]);
    if (String(preferredDepense.milestone ?? "").trim() === milestoneId) {
      return preferredIndex as number;
    }
  }

  return depenses.findIndex((d) => String(d.milestone ?? "").trim() === milestoneId);
}

export const useSaveCagnotteContribution = () => {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const { api, me } = useCocolight();

  /**
   * Approche 1 : Atomique avec `Answer.updateField`
   * Plus fiable en cas de concurrence (pas de risque de overwrite)
   */
  const saveViaUpdatePathValue = useCallback(
    async (
      answer: Answer,
      milestoneFundings: MilestoneFunding[],
      financerData: financerData
    ): Promise<boolean> => {
      try {
        if (!api) {
          throw new Error(String(t("toasts.errors.noApiClient")));
        }
        const userId = me?.serverData?.id;
        if (!userId) {
          throw new Error(String(t("toasts.errors.notLoggedIn")));
        }
        // `answer.serverData` est typé AnswerItemNormalized (rempli par api.answer({id}) qui
        // appelle get() automatiquement).
        const currentAnswerData = answer.serverData;
        const answers = (currentAnswerData.answers as Record<string, unknown> | undefined) ?? {};
        const aapStep1 = (answers.aapStep1 as Record<string, unknown>) || {};
        const depensesRaw = aapStep1.depense;
        const depenses = Array.isArray(depensesRaw)
          ? (depensesRaw as Array<Record<string, unknown>>)
          : depensesRaw && typeof depensesRaw === "object"
            ? [depensesRaw as Record<string, unknown>]
            : [];

        let successCount = 0;
        const errors: string[] = [];

        for (const { milestoneId, amount, milestoneIndex } of milestoneFundings) {
          if (amount <= 0) continue;

          const depenseIndex = resolveDepenseIndex({
            depenses,
            milestoneId,
            preferredIndex: milestoneIndex,
          });

          if (depenseIndex === -1) {
            errors.push(String(t("toasts.errors.noMilestoneForId", undefined, { milestoneId })));
            continue;
          }
          const financerEntry = createFinancerEntry({ amount, financerData, userId });

          if (!Number.isFinite(financerEntry.amount) || financerEntry.amount <= 0) {
            errors.push(String(t("toasts.errors.invalidAmount", undefined, { milestoneId })));
            continue;
          }
          if (!financerEntry.id || !financerEntry.user) {
            errors.push(String(t("toasts.errors.invalidFinancer", undefined, { milestoneId })));
            continue;
          }

          // Ecriture atomique de la depense complete (meme logique que la modif depense)
          await answer.updateField(
            `answers.aapStep1.depense.${depenseIndex}.financer`,
            financerEntry,
            {
              arrayForm: true,
              setType: [
                { path: "amount", type: "int" },
                { path: "date", type: "isoDate" },
              ],
            },
          );

          successCount++;
        }

        if (errors.length > 0 && successCount === 0) {
          throw new Error(String(t("toasts.errors.noneSaved", undefined, { reasons: errors.join(" | ") })));
        }

        if (errors.length > 0) {
          console.warn(`${errors.length} milestone(s) non enregistre(s): ${errors.join(" | ")}`);
        }

        return successCount > 0;
      } catch (error) {
        console.error("Erreur Answer.updateField:", error);
        throw error;
      }
    },
    [api, me, t]
  );

  /**
   * Approche 2 : Fallback vers `answer.save()` (modifications brouillons)
   * À utiliser si Answer.updateField n'est pas disponible
   */
  const saveViaDraftAndSave = useCallback(
    async (
      answer: Answer,
      milestoneFundings: MilestoneFunding[],
      financerData: financerData
    ): Promise<boolean> => {
      try {
        const userId = me?.serverData?.id;
        if (!userId) {
          throw new Error(String(t("toasts.errors.notLoggedIn")));
        }
        const currentAnswerData = answer.serverData;
        const updatedAnswerData = applyMilestoneFundingsToAnswerData(currentAnswerData, milestoneFundings, financerData, userId);
        const formId = getFormIdFromAnswerData(currentAnswerData);

        if (api && formId) {
          const payload: SaveCoformAnswerData = {
            formId,
            answerId: answer.id ?? undefined,
            answers: JSON.stringify(updatedAnswerData.answers ?? {}),
            links: JSON.stringify(updatedAnswerData.links ?? currentAnswerData.links ?? {}),
          };
          await api.endpointApi.saveCoformAnswer(payload);
          return true;
        }

        // Fallback ultime : `answer.save()` persiste le draft local.
        await answer.save();
        return true;
      } catch (error) {
        console.error("Erreur saveViaDraftAndSave:", error);
        throw error;
      }
    },
    [api, me, t]
  );

  /**
   * Méthode principale : essaie Answer.updateField d'abord, fallback vers save()
   *
   * @param answerOrId - L'entité Answer déjà chargée (0 GET) ou son id (le hook
   *   charge l'entité via `api.answer({id})`). Préférer l'entity si déjà sous la main.
   */
  const saveContribution = useCallback(
    async (
      answerOrId: Answer | string,
      milestoneFundings: MilestoneFunding[],
      financerData: financerData
    ): Promise<boolean> => {
      try {
        if (!milestoneFundings.length) throw new Error(String(t("toasts.errors.noMilestoneFundings")));
        if (typeof answerOrId === "string" && !answerOrId.trim()) {
          throw new Error(String(t("toasts.errors.noAnswerId")));
        }
        if (!api) {
          throw new Error(String(t("toasts.errors.noApiClient")));
        }

        const answer = typeof answerOrId === "string"
          ? await api.answer({ id: answerOrId })
          : answerOrId;

        if (!answer.id) throw new Error(String(t("toasts.errors.noAnswerId")));

        try {
          const success = await saveViaUpdatePathValue(answer, milestoneFundings, financerData);
          if (success) {
            showSuccessToast("toasts.contributionSaved.title", t, {
              count: String(milestoneFundings.length),
            });
            launchConfettiBurst({ originY: 0.36, spread: 78, count: Math.min(36, 18 + milestoneFundings.length * 6) });
            return true;
          }
        } catch (pathError) {
          console.warn("Answer.updateField échoué", pathError);
          // Continuer vers fallback
        }

        throw new Error(String(t("toasts.errors.updatePathValueFailed")));
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erreur inconnue";
        console.error("Erreur sauvegarde contribution:", msg);
        showErrorToast(
          error instanceof Error ? error : new Error(msg),
          "toasts.contributionPartial.title",
          t,
          { reason: msg },
        );
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, saveViaUpdatePathValue, saveViaDraftAndSave, t]
  );

  return { saveContribution, saveViaUpdatePathValue, saveViaDraftAndSave };
};
