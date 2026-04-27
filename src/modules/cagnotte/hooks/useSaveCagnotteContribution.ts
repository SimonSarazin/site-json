/**
 * Hook pour sauvegarder les données de contribution cagnotte dans Answer
 * Utilise le wrapper `updatePathValue` (atomique par milestone) avec fallback vers `entity.save()`
 */

import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { updatePathValue } from "@/lib/updatePathValue";

type EndpointCaller = {
  callEndpoint?: (endpointName: string, payload: Record<string, unknown>) => Promise<unknown>;
};

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
}

interface financerData {
  id: string;
  name: string;
  type: string;
}

function createFinancerEntry(params: {
  milestoneId: string;
  amount: number;
  currentAnswerData: Record<string, unknown>;
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

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getFormIdFromAnswerData(currentAnswerData: Record<string, unknown>): string {
  const project = toRecord(currentAnswerData.project);
  const answers = toRecord(currentAnswerData.answers);
  const answerMeta = toRecord(currentAnswerData.answer);

  const candidates = [
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

function getAnswerIdFromAnswerData(currentAnswerData: Record<string, unknown>): string {
  const directId = currentAnswerData.id;
  if (typeof directId === "string" && directId.trim()) return directId.trim();

  const mongoId = toRecord(currentAnswerData._id);
  const mongoStr = mongoId._str;
  if (typeof mongoStr === "string" && mongoStr.trim()) return mongoStr.trim();

  const mongoDollar = mongoId.$id;
  if (typeof mongoDollar === "string" && mongoDollar.trim()) return mongoDollar.trim();

  return "";
}

function applyMilestoneFundingsToAnswerData(
  currentAnswerData: Record<string, unknown>,
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
    const financerEntry = createFinancerEntry({
      milestoneId,
      amount,
      currentAnswerData,
      financerData,
      userId
    });

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

export const useSaveCagnotteContribution = (
  answerEntity: unknown | null,
  apiClient: unknown | null
) => {
  const { toast } = useToast();

  /**
   * Approche 1 : Atomique avec `updatePathValue`
   * Plus fiable en cas de concurrence (pas de risque de overwrite)
   */
  const saveViaUpdatePathValue = useCallback(
    async (
      answerId: string,
      milestoneFundings: MilestoneFunding[],
      currentAnswerData: Record<string, unknown>,
      financerData: financerData,
      userId: string
    ): Promise<boolean> => {
      try {
        if (!apiClient) {
          throw new Error("apiClient indisponible");
        }
        const data = currentAnswerData?.data as Record<string, unknown>;
        const answers = (data.answers as Record<string, unknown>) || {};
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
            errors.push(`Depense non trouvee pour milestone ${milestoneId}`);
            continue;
          }
          const financerEntry = createFinancerEntry({
            milestoneId,
            amount,
            currentAnswerData,
            financerData,
            userId
          });

          if (!Number.isFinite(financerEntry.amount) || financerEntry.amount <= 0) {
            errors.push(`Montant invalide pour milestone ${milestoneId}`);
            continue;
          }
          if (!financerEntry.id || !financerEntry.user) {
            errors.push(`Financeur invalide pour milestone ${milestoneId}`);
            continue;
          }

          const updatePayload = {
            id: answerId,
            collection: "answers",
            path: `answers.aapStep1.depense.${depenseIndex}.financer`,
            arrayForm: true,
            setType: [
              {
                path: 'amount',
                type: 'int',
              },
              {
                path: 'date',
                type: 'isoDate',
              },
            ],
            value: financerEntry,
          } as const;

          // Ecriture atomique de la depense complete (meme logique que la modif depense)
          await updatePathValue(apiClient, updatePayload);

          successCount++;
        }

        if (errors.length > 0 && successCount === 0) {
          throw new Error(`Aucun milestone enregistre: ${errors.join(" | ")}`);
        }

        if (errors.length > 0) {
          console.warn(`⚠️ ${errors.length} milestone(s) non enregistre(s): ${errors.join(" | ")}`);
        }

        return successCount > 0;
      } catch (error) {
        console.error("❌ Erreur updatePathValue:", error);
        throw error;
      }
    },
    [apiClient]
  );

  /**
   * Approche 2 : Fallback vers `entity.save()` (modifications brouillons)
   * À utiliser si updatePathValue n'est pas disponible
   */
  const saveViaDraftAndSave = useCallback(
    async (
      answerId: string,
      milestoneFundings: MilestoneFunding[],
      currentAnswerData: Record<string, unknown>,
      financerData: financerData,
      userId: string
    ): Promise<boolean> => {
      try {
        const updatedAnswerData = applyMilestoneFundingsToAnswerData(currentAnswerData, milestoneFundings,financerData,userId);
        const formId = getFormIdFromAnswerData(currentAnswerData);
        const api = apiClient as EndpointCaller | null;

        if (api && typeof api.callEndpoint === "function" && formId) {
          const resolvedAnswerId =
            (typeof answerId === "string" && answerId.trim()) ||
            getAnswerIdFromAnswerData(currentAnswerData) ||
            undefined;

          await api.callEndpoint("SAVE_COFORM_ANSWER", {
            formId,
            answerId: resolvedAnswerId,
            answers: JSON.stringify(updatedAnswerData.answers ?? {}),
            links: JSON.stringify(updatedAnswerData.links ?? currentAnswerData.links ?? {}),
          });
          return true;
        }

        if (answerEntity) {
          const saveFunc = (answerEntity as Record<string, unknown>)?.save;
          if (typeof saveFunc !== "function") throw new Error("Méthode save() indisponible");
          await (saveFunc as unknown as () => Promise<unknown>).call(answerEntity);
          return true;
        }

        throw new Error("Aucune méthode de sauvegarde CoForm disponible (formId ou answerEntity manquant)");
      } catch (error) {
        console.error("❌ Erreur saveViaDraftAndSave:", error);
        throw error;
      }
    },
    [answerEntity, apiClient]
  );

  /**
   * Méthode principale : essaie updatePathValue d'abord, fallback vers save()
   */
  const saveContribution = useCallback(
    async (
      answerId: string,
      milestoneFundings: MilestoneFunding[],
      currentAnswerData: Record<string, unknown>,
      financerData: financerData,
      userId: string
    ): Promise<boolean> => {
      try {
        if (!answerId) throw new Error("answerId manquant");
        if (!milestoneFundings.length) throw new Error("Aucun milestone à financer");

        try {
          const success = await saveViaUpdatePathValue(answerId, milestoneFundings, currentAnswerData, financerData, userId);
          if (success) {
            toast({
              title: "✅ Contribution enregistrée",
              description: `${milestoneFundings.length} milestone(s) financer(s)`,
              duration: 4000,
            });
            return true;
          }
        } catch (pathError) {
          console.warn("⚠️ updatePathValue échoué", pathError);
          // Continuer vers fallback
        }

        throw new Error("updatePathValue échoué");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erreur inconnue";
        console.error("❌ Erreur sauvegarde contribution:", msg);
        toast({
          title: "⚠️ Avertissement",
          description: `Paiement réussi. Enregistrement incomplet: ${msg}`,
          variant: "destructive",
        });
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saveViaUpdatePathValue, saveViaDraftAndSave, toast]
  );

  return { saveContribution, saveViaUpdatePathValue, saveViaDraftAndSave };
};
