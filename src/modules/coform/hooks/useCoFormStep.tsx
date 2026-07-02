import { useEffect, useMemo } from "react";
import { useForm, type UseFormReturn, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useT } from "@/hooks/useT";
import { useCoForm } from "./useCoForm";
import { generateZodSchema, generateDefaultValues } from "../utils/formParser";
import type { SubFormFields, SubFormData } from "../types";

interface UseCoFormStepOptions {
  stepIndex?: number;
  /** Valeurs initiales personnalisées */
  defaultValues?: SubFormData;
  onSuccess?: (data: SubFormData) => void;
  onError?: (error: Error) => void;
}

interface UseCoFormStepReturn {
  /** Instance react-hook-form */
  form: UseFormReturn<FieldValues>;
  /** Champs de l'étape actuelle */
  fields: SubFormFields | null;
  /** ID du sous-formulaire */
  subFormId: string | null;
  stepName: string;
  /** L'étape est-elle en cours de soumission? */
  isSubmitting: boolean;
  /** L'étape a-t-elle été complétée? */
  isCompleted: boolean;
  hasError: boolean;
  submitStep: () => Promise<boolean>;
  saveStep: () => void;
}

/**
 * Hook pour gérer une étape spécifique du formulaire
 * Fournit react-hook-form configuré avec validation Zod
 */
export function useCoFormStep(options: UseCoFormStepOptions = {}): UseCoFormStepReturn {
  const { stepIndex, defaultValues: customDefaultValues, onSuccess, onError } = options;
  const coform = useCoForm();
  const t = useT("modules/coform");

  // Déterminer l'étape à utiliser
  const effectiveStepIndex = stepIndex ?? coform.stepState.currentStepIndex;
  const stepFields = coform.subFormsFields[effectiveStepIndex] ?? null;
  const subFormId = stepFields?.subFormId ?? null;

  // Générer le schéma Zod et les valeurs par défaut pour cette étape
  const { schema, defaults } = useMemo(() => {
    if (!stepFields) {
      return { schema: null, defaults: {} };
    }

    const schema = generateZodSchema([stepFields], t);
    const defaults = {
      ...generateDefaultValues([stepFields]),
      ...(coform.stepState.stepsData[subFormId!] ?? {}),
      ...customDefaultValues,
    };

    return { schema, defaults };
  }, [stepFields, subFormId, coform.stepState.stepsData, customDefaultValues, t]);

  // Configurer react-hook-form
  const form = useForm({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues: defaults,
    mode: "onBlur",
  });

  // Réinitialiser le formulaire quand on change d'étape
  // useForm ne réagit pas aux changements de defaultValues après le premier rendu
  useEffect(() => {
    form.reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStepIndex]);

  // États dérivés
  const isSubmitting = coform.stepState.submittingStep === subFormId;
  const isCompleted = subFormId ? coform.stepState.completedSteps.includes(subFormId) : false;
  const hasError = subFormId ? coform.stepState.errorSteps.includes(subFormId) : false;

  // Soumettre l'étape. Renvoie `true` si la validation Zod a passé ET la
  // soumission au provider s'est terminée sans throw ; `false` sinon. Le
  // caller (`MultiStepCoForm.handleSubmit`) lit ce retour pour décider
  // d'afficher l'`ErrorSummary` + le scroll + le toast, ou pour passer à
  // l'étape suivante / au submit final.
  const submitStep = async (): Promise<boolean> => {
    if (!subFormId) return false;

    try {
      const data = form.getValues();
      const isValid = await form.trigger();

      if (!isValid) {
        return false;
      }

      await coform.submitStepData(subFormId, data);
      onSuccess?.(data);
      return true;
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error("Erreur de soumission"));
      return false;
    }
  };

  // Sauvegarder sans soumettre
  const saveStep = () => {
    if (!subFormId) return;
    const data = form.getValues();
    coform.saveStepData(subFormId, data);
  };

  return {
    form,
    fields: stepFields,
    subFormId,
    stepName: stepFields?.subFormName ?? "",
    isSubmitting,
    isCompleted,
    hasError,
    submitStep,
    saveStep,
  };
}
