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
} from "@communecter/cocolight-api-client";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolight } from "@/hooks/useCocolight";
import { launchConfettiBurst } from "@/lib/confetti";
import {asRecord as toRecord} from "@/modules/cagnotte/utils/dataTransform";
import {DepenseFunding, Pledge} from "@/modules/cagnotte/types.ts";

interface FinancerEntry {
  amount: number;
  date: string;
  user: string;
  id: string;
  name: string;
  type: string;
  fundingType?: string;
  method?: string;
  transactionId?: string;
  [k: string]: unknown;
}

interface FinancerData {
  id: string;
  name: string;
  type: string;
}

function createFinancerEntry({
 amount,
 financerData,
 userId,
 method,
 transactionId
}: {
  amount: number;
  financerData: FinancerData;
  userId: string;
  method?: string;
  transactionId?: string;
}): FinancerEntry {
  const entry: FinancerEntry = {
    amount,
    date: "now",
    user: userId,
    id: financerData.id,
    name: financerData.name,
    type: financerData.type,
  };

  // On n'enregistre method et transactionId que si il y a paiement via Stripe ou HelloAsso.
  // Pour un pledge (où method est undefined), ces champs n'existeront pas en base.
  if (method === "stripe" || method === "helloasso") {
    entry.method = method;
    entry.fundingType = "prepaid";
    if (transactionId) {
      entry.transactionId = transactionId;
    }
  }

  return entry;
}

export function getFormIdFromAnswerData(currentAnswerData: AnswerItemNormalized): string {
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

function applyDepenseFundingsToAnswerData(
    currentAnswerData: AnswerItemNormalized,
    depenseFundings: DepenseFunding[],
    financerData: FinancerData,
    userId: string,
    method?: string,
    transactionId?: string
) {
  const cloned = structuredClone ? structuredClone(currentAnswerData) : JSON.parse(JSON.stringify(currentAnswerData ?? {}));

  if (!cloned.answers) cloned.answers = {};
  if (!cloned.answers.aapStep1) cloned.answers.aapStep1 = {};

  let depenses = cloned.answers.aapStep1.depense;
  depenses = Array.isArray(depenses) ? depenses : depenses ? [depenses] : [];

  // `appliedCount` distingue « rien appliqué » (depenseIndex introuvable / montant nul)
  // d'un vrai enregistrement : l'appelant s'en sert pour ne pas simuler un succès à vide.
  let appliedCount = 0;
  depenseFundings.forEach(({ depenseIndex, amount }) => {
    if (amount <= 0 || depenseIndex === undefined) return;

    const depense = depenses[depenseIndex];
    if (!depense) return;

    const currentFinancers = Array.isArray(depense.financer) ? depense.financer : [];
    const financerEntry = createFinancerEntry({ amount, financerData, userId, method, transactionId });

    depense.financer = [...currentFinancers, financerEntry];
    depenses[depenseIndex] = depense;
    appliedCount++;
  });

  cloned.answers.aapStep1.depense = depenses;
  return { data: cloned, appliedCount };
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
          depenseFundings: DepenseFunding[],
          financerData: FinancerData,
          method?: string,
          transactionId?: string
      ): Promise<boolean> => {
        if (!api) throw new Error(String(t("toasts.errors.noApiClient")));

        const userId = me?.serverData?.id;
        if (!userId) throw new Error(String(t("toasts.errors.notLoggedIn")));

        let successCount = 0;
        const errors: string[] = [];

        // Parallélisation possible via Promise.allSettled si l'API le supporte,
        // mais le for...of garde la séquentialité sécurisée.
        for (const { depenseIndex, amount } of depenseFundings) {
          if (amount <= 0) continue;
          if (depenseIndex === -1) {
            errors.push(String(t("toasts.errors.noMilestoneForId", undefined, { depenseIndex })));
            continue;
          }

          const financerEntry = createFinancerEntry({ amount, financerData, userId, method, transactionId });

          if (!financerEntry.id || !financerEntry.user) {
            errors.push(String(t("toasts.errors.invalidFinancer", undefined, { depenseIndex })));
            continue;
          }

          try {
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
          } catch (error) {
            errors.push(`Échec index ${depenseIndex}`);
            console.error(error);
          }
        }

        if (errors.length > 0 && successCount === 0) {
          throw new Error(String(t("toasts.errors.noneSaved", undefined, { reasons: errors.join(" | ") })));
        }

        if (errors.length > 0) {
          console.warn(`${errors.length} milestone(s) non enregistre(s): ${errors.join(" | ")}`);
        }

        return successCount > 0;
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
          depenseFundings: DepenseFunding[],
          financerData: FinancerData,
          method?: string,
          transactionId?: string
      ): Promise<boolean> => {
        const userId = me?.serverData?.id;
        if (!userId) throw new Error(String(t("toasts.errors.notLoggedIn")));

        const currentAnswerData = answer.serverData;
        const { data: updatedAnswerData, appliedCount } = applyDepenseFundingsToAnswerData(currentAnswerData, depenseFundings, financerData, userId, method, transactionId);

        // Aucun financer effectivement appliqué (ex. depenseIndex introuvable) :
        // ne PAS enregistrer ni renvoyer `true`, sinon on afficherait un succès
        // alors que l'argent a déjà été débité et que rien n'est persisté.
        if (appliedCount === 0) return false;

        const formId = getFormIdFromAnswerData(currentAnswerData);

        if (api && formId) {
          await api.endpointApi.saveCoformAnswer({
            formId,
            answerId: answer.id ?? undefined,
            answers: JSON.stringify(updatedAnswerData.answers ?? {}),
            links: JSON.stringify(updatedAnswerData.links ?? currentAnswerData.links ?? {}),
          });
          return true;
        }

        await answer.save();
        return true;
      },
      [api, me, t]
  );

  const saveContribution = useCallback(
      async (
          answerOrId: Answer | string,
          depenseFundings: DepenseFunding[],
          financerData: FinancerData,
          method?: string,
          transactionId?: string
      ): Promise<boolean> => {
        try {
          if (!depenseFundings.length) throw new Error(String(t("toasts.errors.noMilestoneFundings")));
          if (!api) throw new Error(String(t("toasts.errors.noApiClient")));

          const answerIdStr = typeof answerOrId === "string" ? answerOrId : answerOrId.id;
          if (!answerIdStr?.trim()) throw new Error(String(t("toasts.errors.noAnswerId")));

          const answer = typeof answerOrId === "string" ? await api.answer({ id: answerIdStr }) : answerOrId;

          let success = false;
          try {
            success = await saveViaUpdatePathValue(answer, depenseFundings, financerData, method, transactionId);
          } catch (pathError) {
            console.warn("Answer.updateField échoué, essai du fallback...", pathError);
            success = await saveViaDraftAndSave(answer, depenseFundings, financerData, method, transactionId);
          }

          if (success) {
            showSuccessToast("toasts.contributionSaved.title", t, { count: String(depenseFundings.length) });
            // Formule de confettis factorisée
            launchConfettiBurst({ originY: 0.36, spread: 78, count: Math.min(36, 18 + depenseFundings.length * 6) });
            return true;
          }

          throw new Error(String(t("toasts.errors.updatePathValueFailed")));
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Erreur inconnue";
          showErrorToast(
              error instanceof Error ? error : new Error(msg),
              "toasts.contributionPartial.title",
              t,
              { reason: msg }
          );
          return false;
        }
      },
      [api, saveViaUpdatePathValue, saveViaDraftAndSave, t]
  );

  const payContribution = useCallback(
      async (
          pledges: Pledge[],
          method?: string,
          transactionId?: string,
      ): Promise<boolean> => {
        try {
          if (!pledges.length) throw new Error(String(t("toasts.errors.noMilestoneFundings")));
          if (!api) throw new Error(String(t("toasts.errors.noApiClient")));

          // Une seule Answer récupérée par ressource, même si plusieurs pledges y pointent.
          const pledgesByResource = new Map<string, Pledge[]>();
          for (const pledge of pledges) {
            if (typeof pledge.resourceId === "undefined") continue;
            const group = pledgesByResource.get(pledge.resourceId) ?? [];
            group.push(pledge);
            pledgesByResource.set(pledge.resourceId, group);
          }

          let success = false;
          let successCount = 0;
          const errors: string[] = [];

          try {
            for (const [resourceId, resourcePledges] of pledgesByResource) {
              const answer = await api.answer({ id: resourceId }); // 1 fetch par ressource, pas par pledge

              for (const pledge of resourcePledges) {
                try {
                  await answer.updateField(
                      `answers.aapStep1.depense.${pledge.depenseIndex}.financer.${pledge.fundingIndex}`,
                      {
                        fundingType : "prepaid",
                        transactionId,
                        method
                      },
                      { updatePartial: true }
                  );
                  successCount++;
                } catch (error) {
                  errors.push(`Échec index ${pledge.depenseIndex}`);
                  console.error(error);
                }
              }
            }

            if (errors.length > 0 && successCount === 0) {
              throw new Error(String(t("toasts.errors.noneSaved", undefined, { reasons: errors.join(" | ") })));
            }

            success = successCount > 0;

          } catch (pathError) {
            console.warn("Answer.updateField échoué, essai du fallback...", pathError);

            for (const [resourceId, resourcePledges] of pledgesByResource) {
              const answer = await api.answer({ id: resourceId }); // idem : 1 fetch par ressource
              const currentAnswerData = answer.serverData;
              const cloned = structuredClone ? structuredClone(currentAnswerData) : JSON.parse(JSON.stringify(currentAnswerData ?? {}));

              if (cloned?.answers?.aapStep1?.depense) {
                let depenses = cloned.answers.aapStep1.depense;
                depenses = Array.isArray(depenses) ? depenses : [depenses];

                for (const pledge of resourcePledges) { // uniquement les pledges de CETTE ressource
                  const depense = depenses[pledge.depenseIndex];
                  if (depense && Array.isArray(depense.financer) && pledge.fundingIndex !== undefined && depense.financer[pledge.fundingIndex]) {
                    depense.financer[pledge.fundingIndex].fundingType = "prepaid";
                    if (transactionId) depense.financer[pledge.fundingIndex].transactionId = transactionId;
                    if (method) depense.financer[pledge.fundingIndex].method = method;
                    success = true;
                  }
                }
                cloned.answers.aapStep1.depense = depenses;

                const formId = getFormIdFromAnswerData(currentAnswerData);
                if (api && formId && success) {
                  await api.endpointApi.saveCoformAnswer({
                    formId,
                    answerId: answer.id ?? undefined,
                    answers: JSON.stringify(cloned.answers ?? {}),
                    links: JSON.stringify(cloned.links ?? currentAnswerData.links ?? {}),
                  });
                }
              }
            }
          }

          if (success) {
            if (errors.length > 0) {
              showErrorToast(new Error(errors.join(" | ")), "toasts.contributionPartial.title", t,
                  { succeeded: String(successCount), total: String(pledges.length) });
            } else {
              showSuccessToast("toasts.contributionSaved.title", t, { count: String(successCount) });
            }
            launchConfettiBurst({ originY: 0.36, spread: 78, count: Math.min(36, 18 + pledges.length * 6) });
            return true;
          }

          throw new Error(String(t("toasts.errors.updatePathValueFailed")));
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Erreur inconnue";
          showErrorToast(
              error instanceof Error ? error : new Error(msg),
              "toasts.contributionPartial.title",
              t,
              { reason: msg }
          );
          return false;
        }
      },
      [api, t]
  );

  return { saveContribution, saveViaUpdatePathValue, saveViaDraftAndSave, payContribution };
};