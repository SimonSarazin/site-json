import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { TextField, TextAreaField, RadioField, CheckboxField, ProseContent, SectionTitleField, SectionDescriptionField } from "./FormFields";
import { MultiCheckboxPlusField } from "./MultiCheckboxPlusField";
import { MultiRadioField } from "./MultiRadioField";
import { EvaluationField } from "./EvaluationField";
import { CommonTableField } from "./CommonTableField";
import { MultiEvalChartDialog } from "./MultiEvalChartDialog";
import { FinderField } from "./FinderField";
import { SimpleTableField } from "./SimpleTableField";
import { UploaderField } from "./UploaderField";
import { CoFormBanner } from "./CoFormBanner";
import type { CoFormData, SubFormData, AddedOptionsMap, EvaluationValue, CommonTableValue, FinderValue, SimpleTableValue, MultiRadioValue } from "../types";
import { parseCoFormFields, generateZodSchema, generateDefaultValues, getStepHasMultiEval } from "../utils/formParser";
import { useConditionalFields } from "../hooks/useConditionalFields";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

import "../i18n/i18n";

interface DynamicCoFormProps {
  formData: CoFormData;
  onSubmit: (data: SubFormData, addedOptions?: AddedOptionsMap) => void | Promise<void>;
  submitButtonText?: string;
  isLoading?: boolean;
  /** Valeurs par défaut pour pré-remplir le formulaire (mode édition) */
  defaultValues?: SubFormData;
  /** ID de la réponse en cours d'édition (pour le chargement des fichiers legacy) */
  answerId?: string;
  /** Masquer la bannière et le titre (mode standalone / embed) */
  hideBanner?: boolean;
  /** Masquer les en-têtes d'étape (Card title/info) — mode input standalone */
  hideStepHeaders?: boolean;
  /** Masquer le bouton de soumission (auto-submit sur blur) */
  hideSubmitButton?: boolean;
  /** Soumettre automatiquement quand un champ perd le focus (si la valeur a changé) */
  autoSubmitOnBlur?: boolean;
  /** Appelé quand l'état "modifié" du formulaire change */
  onDirtyChange?: (isDirty: boolean) => void;
  /** Ref vers la fonction de soumission programmatique du formulaire */
  submitRef?: React.RefObject<(() => void) | null>;
  /** Liste de clés d'inputs verrouillés (lecture seule, non modifiables) */
  lockedFields?: string[];
}

/**
 * Composant principal pour afficher un formulaire CoForm dynamique
 * Gère automatiquement la validation Zod et l'intégration react-hook-form
 */
export function DynamicCoForm({
  formData,
  onSubmit,
  submitButtonText,
  isLoading = false,
  defaultValues: externalDefaults,
  answerId,
  hideBanner = false,
  hideStepHeaders = false,
  hideSubmitButton = false,
  autoSubmitOnBlur = false,
  onDirtyChange,
  submitRef,
  lockedFields,
}: DynamicCoFormProps) {
  const t = useT("modules/coform");
  useLoadNamespace("modules/coform");

  const resolvedSubmitText = submitButtonText ?? t("coform.navigation.submit");

  // Mémoiser pour éviter l'erreur React Compiler "dependency may be modified later"
  const subFormsFields = useMemo(() => parseCoFormFields(formData), [formData]);
  const zodSchema = useMemo(() => generateZodSchema(subFormsFields), [subFormsFields]);
  const generatedDefaults = useMemo(() => generateDefaultValues(subFormsFields), [subFormsFields]);

  // Fusionner : valeurs externes (mode édition) écrasent les défauts générés.
  // useMemo pour stabiliser la référence — sinon `lastSubmittedValuesRef` (qui
  // dépend de `defaultValues`) re-sérialise à chaque render et la sync async
  // mode édition peut déclencher un faux auto-submit.
  const defaultValues = useMemo(
    () => (externalDefaults ? { ...generatedDefaults, ...externalDefaults } : generatedDefaults),
    [externalDefaults, generatedDefaults],
  );

  type FormValues = z.infer<typeof zodSchema>;

  const {
    register,
    handleSubmit,
    getValues,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues,
  });

  // State pour collecter les options ajoutées par champ
  const [addedOptionsMap, setAddedOptionsMap] = useState<AddedOptionsMap>({});

  // Multi-eval radar : un seul Dialog réutilisé pour toutes les steps. Le state
  // mémorise la step ciblée (titre + filtre côté serveur via stepKey). `null`
  // → dialog non monté (cf. norme jdev de mount conditionnel).
  const [multiEvalContext, setMultiEvalContext] = useState<
    { stepKey: string; stepName: string } | null
  >(null);

  const lockedSet = useMemo(() => new Set(lockedFields), [lockedFields]);

  // Logique conditionnelle : collecter tous les champs et évaluer la visibilité
  const allFields = subFormsFields.flatMap((sf) => sf.fields);
  const { isFieldVisible } = useConditionalFields(allFields, control);

  // Callback pour mettre à jour les options ajoutées d'un champ
  const handleAddedOptionsChange = useCallback((fieldName: string, addedOptions: string[]) => {
    setAddedOptionsMap(prev => ({
      ...prev,
      [fieldName]: addedOptions,
    }));
  }, []);

  // Ref pour auto-submit : dernier état soumis.
  // Initialisé à null + syncé via useEffect ci-dessous quand `defaultValues`
  // change (cas mode édition où les valeurs arrivent en async via
  // `useCoFormAnswerQuery`). Évite un faux auto-submit au premier blur quand
  // les `externalDefaults` arrivent après le mount initial.
  const lastSubmittedValuesRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialise la baseline d'auto-submit UNE SEULE fois, dès que `defaultValues`
  // est réellement défini (mode édition async : la prop est undefined au mount
  // puis arrive via useCoFormAnswerQuery). On NE reset PAS sur les refetches
  // ultérieurs : ça créait une boucle d'autosave quand le backend renvoie + de
  // champs que le form (links auto-ajoutés, userContext, etc.) — la comparaison
  // watchedValues vs baseline était toujours fausse → re-trigger save → refetch
  // → ... loop. La baseline est désormais mise à jour uniquement dans l'autosave
  // après chaque submit réussi (ligne ~168).
  useEffect(() => {
    if (lastSubmittedValuesRef.current === null && defaultValues !== undefined) {
      lastSubmittedValuesRef.current = JSON.stringify(defaultValues);
    }
  }, [defaultValues]);

  const handleFormSubmit = useCallback(async (data: FormValues) => {
    const hasAddedOptions = Object.keys(addedOptionsMap).some(k => addedOptionsMap[k].length > 0);
    await onSubmit(data as SubFormData, hasAddedOptions ? addedOptionsMap : undefined);
  }, [addedOptionsMap, onSubmit]);

  // Auto-submit unifié : useWatch détecte les changements de valeur (tous types d'input)
  // puis debounce 600ms avant de soumettre si la valeur a effectivement changé.
  const watchedValues = useWatch({ control });

  // Propager isDirty vers CoFormModal (détection de modifications non enregistrées)
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Exposer la soumission programmatique via submitRef
  useEffect(() => {
    if (submitRef) {
      submitRef.current = () => handleSubmit(handleFormSubmit)();
    }
    return () => {
      if (submitRef) submitRef.current = null;
    };
  }, [submitRef, handleSubmit, handleFormSubmit]);

  // Auto-submit debounced : déclenché 600 ms après le dernier changement de
  // valeur, uniquement si la valeur courante diffère de la dernière soumise.
  // La baseline `lastSubmittedValuesRef` est null tant que `defaultValues`
  // n'est pas synchronisé (mode édition async) → on skip pour éviter un faux
  // submit avec des valeurs encore non-hydratées.
  //
  // IMPORTANT : on appelle `handleFormSubmit` directement (sans passer par
  // `handleSubmit` du react-hook-form) pour **bypass la validation Zod** —
  // l'autosave persiste l'état partiel en cours d'édition (typiquement la
  // suppression d'une ligne d'un SimpleTableField alors que d'autres champs
  // requis sont encore vides). La validation reste active pour le submit
  // explicite via le bouton (qui passe lui par `handleSubmit`).
  useEffect(() => {
    if (!autoSubmitOnBlur) return;
    if (lastSubmittedValuesRef.current === null) return;
    const current = JSON.stringify(watchedValues);
    if (current === lastSubmittedValuesRef.current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      lastSubmittedValuesRef.current = current;
      handleFormSubmit(getValues() as FormValues);
    }, 600);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [watchedValues, autoSubmitOnBlur, getValues, handleFormSubmit]);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <CoFormBanner formData={formData} hidden={hideBanner} />

      {subFormsFields.map((subForm) => {
          const fieldsGrid = (
            <div className="grid grid-cols-12 gap-6">
              {subForm.fields.map((field) => {
                if (!isFieldVisible(field.name)) return null;
                const isLocked = lockedSet.has(field.name);
                // Rendu conditionnel selon le type de champ
                const fieldElement = (() => { switch (field.componentType) {
                case "text":
                  return (
                    <TextField
                      key={field.name}
                      field={field}
                      register={register}
                      errors={errors}
                    />
                  );

                case "textarea":
                  if (field.markdown) {
                    return (
                      <Controller
                        key={field.name}
                        name={field.name}
                        control={control}
                        render={({ field: controllerField }) => (
                          <TextAreaField
                            field={field}
                            errors={errors}
                            value={controllerField.value}
                            onChange={controllerField.onChange}
                          />
                        )}
                      />
                    );
                  }
                  return (
                    <TextAreaField
                      key={field.name}
                      field={field}
                      register={register}
                      errors={errors}
                    />
                  );

                case "radio":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <RadioField
                          field={field}
                          register={register}
                          errors={errors}
                          value={controllerField.value}
                          onChange={controllerField.onChange}
                        />
                      )}
                    />
                  );

                case "checkbox":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <CheckboxField
                          field={field}
                          errors={errors}
                          value={controllerField.value}
                          onChange={controllerField.onChange}
                        />
                      )}
                    />
                  );

                case "multiCheckboxPlus":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <MultiCheckboxPlusField
                          field={field}
                          errors={errors}
                          value={controllerField.value as import("../types").MultiCheckboxPlusValue}
                          onChange={controllerField.onChange}
                          onAddedOptionsChange={(opts) => handleAddedOptionsChange(field.name, opts)}
                        />
                      )}
                    />
                  );

                case "multiRadio":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <MultiRadioField
                          field={field}
                          errors={errors}
                          value={controllerField.value as MultiRadioValue}
                          onChange={controllerField.onChange}
                        />
                      )}
                    />
                  );

                case "evaluation":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <EvaluationField
                          field={field}
                          errors={errors}
                          value={controllerField.value as EvaluationValue}
                          onChange={controllerField.onChange}
                          readOnly={isLocked}
                        />
                      )}
                    />
                  );

                case "commonTable":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <CommonTableField
                          field={field}
                          errors={errors}
                          value={controllerField.value as CommonTableValue}
                          onChange={controllerField.onChange}
                          readOnly={isLocked}
                          formId={formData.id}
                        />
                      )}
                    />
                  );

                case "finder":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <FinderField
                          field={field}
                          errors={errors}
                          value={controllerField.value as FinderValue}
                          onChange={controllerField.onChange}
                          readOnly={isLocked}
                        />
                      )}
                    />
                  );

                case "simpleTable":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <SimpleTableField
                          field={field}
                          errors={errors}
                          value={controllerField.value as SimpleTableValue}
                          onChange={controllerField.onChange}
                          readOnly={isLocked}
                        />
                      )}
                    />
                  );

                case "uploader":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <UploaderField
                          field={field}
                          errors={errors}
                          value={controllerField.value as import("../types").UploaderValue}
                          onChange={controllerField.onChange}
                          formId={formData.id}
                          answerId={answerId}
                          subKey={`${subForm.subFormId}.${field.name}`}
                        />
                      )}
                    />
                  );

                case "sectionTitle":
                  return <SectionTitleField key={field.name} field={field} />;

                case "sectionDescription":
                  return <SectionDescriptionField key={field.name} field={field} />;

                default:
                  return (
                    <div key={field.name} role="alert" className="col-span-12 flex flex-col gap-1 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      <p className="font-semibold">{field.label}</p>
                      <p>Template d'input introuvable — Le type <code className="font-mono bg-destructive/20 px-1 rounded">{field.type}</code> n'a pas de template associé.</p>
                    </div>
                  );
              } })();

                // Wrapper verrouillé pour les champs non modifiables
                if (isLocked && fieldElement) {
                  return (
                    <div key={field.name} className="contents pointer-events-none opacity-60 *:cursor-not-allowed">
                      {fieldElement}
                    </div>
                  );
                }
                return fieldElement;
            })}
            </div>
          );

          if (hideStepHeaders) {
            return <div key={subForm.subFormId}>{fieldsGrid}</div>;
          }

          // Bouton "Voir les évaluations" — visible uniquement si la step
          // contient au moins un input multi-eval ET qu'on est en mode édition
          // (answerId présent : sinon il n'y a pas encore de data à agréger).
          const stepHasMultiEval = getStepHasMultiEval(subForm);
          const showMultiEvalButton = stepHasMultiEval && !!answerId;

          return (
            <Card key={subForm.subFormId} className="shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-2xl">{subForm.subFormName}</CardTitle>
                  {showMultiEvalButton && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setMultiEvalContext({
                          stepKey: subForm.subFormId,
                          stepName: subForm.subFormName,
                        })
                      }
                      className="shrink-0 gap-2"
                    >
                      <Activity className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("coform.multiEval.viewChart")}</span>
                    </Button>
                  )}
                </div>
                {formData.inputs?.[subForm.subFormId]?.info && (
                  <CardDescription className="text-base">
                    <ProseContent
                      text={formData.inputs[subForm.subFormId].info as string}
                      className="prose prose-sm dark:prose-invert max-w-none"
                    />
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {fieldsGrid}
              </CardContent>
            </Card>
          );
      })}

      {/* Dialog multi-eval : mount conditionnel, contexte = step ciblée
          (titre + stepKey). Cf. feedback_conditional_dialog_mount. */}
      {multiEvalContext && (
        <MultiEvalChartDialog
          open
          onOpenChange={(o) => { if (!o) setMultiEvalContext(null); }}
          answerId={answerId ?? null}
          stepKey={multiEvalContext.stepKey}
          stepName={multiEvalContext.stepName}
        />
      )}

      {!hideSubmitButton && (
      <div className="flex justify-end pt-4">
        <Button 
          type="submit" 
          disabled={isSubmitting || isLoading}
          size="lg"
          className="gap-2 min-w-40"
        >
          {isSubmitting || isLoading ? (
            <>
              <Spinner label={String(t("coform.status.submitting"))} />
              {t("coform.status.submitting")}
            </>
          ) : (
            <>
              {resolvedSubmitText}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </>
          )}
        </Button>
      </div>
      )}
    </form>
  );
};
