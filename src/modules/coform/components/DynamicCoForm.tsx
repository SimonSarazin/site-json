import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useForm, Controller, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextField, TextAreaField, RadioField, CheckboxField, ProseContent, SectionTitleField, SectionDescriptionField } from "./FormFields";
import { MultiCheckboxPlusField } from "./MultiCheckboxPlusField";
import { MultiRadioField } from "./MultiRadioField";
import { EvaluationField } from "./EvaluationField";
import { CommonTableField } from "./CommonTableField";
import { FinderField } from "./FinderField";
import { SimpleTableField } from "./SimpleTableField";
import { UploaderField } from "./UploaderField";
import { ErrorSummary } from "./ErrorSummary";
import { DraftRecoveryBanner } from "./DraftRecoveryBanner";
import type { CoFormData, SubFormData, AddedOptionsMap, EvaluationValue, CommonTableValue, FinderValue, SimpleTableValue, MultiRadioValue } from "../types";
import { parseCoFormFields, generateZodSchema, generateDefaultValues } from "../utils/formParser";
import { useConditionalFields } from "../hooks/useConditionalFields";
import { useCoFormDraft } from "../hooks/useCoFormDraft";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";
import { scrollToFieldByName } from "../utils/helpers";
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
  /** ID du formulaire — clé de draft localStorage */
  formId?: string;
  /** ID utilisateur connecté — clé de draft */
  userId?: string | null;
  /** updatedAt serveur (édition) — pour détecter les drafts obsolètes */
  baseUpdatedAt?: number | null;
  /** Active la persistance du draft. Défaut : true. */
  enableDraft?: boolean;
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
  formId,
  userId,
  baseUpdatedAt,
  enableDraft = true,
}: DynamicCoFormProps) {
  const t = useT("modules/coform");
  useLoadNamespace("modules/coform");

  const resolvedSubmitText = submitButtonText ?? t("coform.navigation.submit");

  // Mémoiser pour éviter l'erreur React Compiler "dependency may be modified later"
  const subFormsFields = useMemo(() => parseCoFormFields(formData), [formData]);
  const zodSchema = useMemo(() => generateZodSchema(subFormsFields), [subFormsFields]);
  const generatedDefaults = useMemo(() => generateDefaultValues(subFormsFields), [subFormsFields]);

  // Fusionner : valeurs externes (mode édition) écrasent les défauts générés
  const defaultValues = useMemo(
    () => (externalDefaults ? { ...generatedDefaults, ...externalDefaults } : generatedDefaults),
    [externalDefaults, generatedDefaults]
  );

  type FormValues = z.infer<typeof zodSchema>;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues,
  });

  // State pour collecter les options ajoutées par champ
  const [addedOptionsMap, setAddedOptionsMap] = useState<AddedOptionsMap>({});

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

  // Ref pour auto-submit : dernier état soumis
  const lastSubmittedValuesRef = useRef<string>(JSON.stringify(defaultValues));
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Identifiant du sous-formulaire courant (pour encapsuler les données dans le payload du draft,
  // qui a le même format que AllStepsData utilisé par MultiStepCoForm).
  const subFormId = subFormsFields[0]?.subFormId ?? "default";

  // Persistance du brouillon en localStorage. Désactivée si conditions non réunies.
  const { restorableDraft, staleDraftInfo, saveDraft, discardDraft, purgeDraft, acknowledgeStale } =
    useCoFormDraft({
      formId,
      userId,
      baseUpdatedAt,
      disabled: !enableDraft || autoSubmitOnBlur,
    });

  const handleFormSubmit = useCallback(async (data: FormValues) => {
    setHasAttemptedSubmit(false);
    const hasAddedOptions = Object.keys(addedOptionsMap).some(k => addedOptionsMap[k].length > 0);
    await onSubmit(data as SubFormData, hasAddedOptions ? addedOptionsMap : undefined);
    // Succès : purge le draft.
    purgeDraft();
  }, [addedOptionsMap, onSubmit, purgeDraft]);

  const handleRestoreDraft = useCallback(() => {
    if (!restorableDraft) return;
    const restored = restorableDraft.data[subFormId] as Record<string, unknown> | undefined;
    if (restored) {
      // `keepDirty: true` est nécessaire pour que l'auto-save (gated by isDirty) continue
      // à persister les modifications : sans ça, un restore effacerait le draft sans le ré-écrire,
      // et un refresh juste après perdrait les données restaurées.
      reset({ ...defaultValues, ...restored } as FormValues, { keepDirty: true });
    }
    const restoredOptions = restorableDraft.addedOptions?.[subFormId];
    if (restoredOptions && Object.keys(restoredOptions).length > 0) {
      setAddedOptionsMap(restoredOptions);
    }
    discardDraft();
  }, [restorableDraft, subFormId, defaultValues, discardDraft, reset]);

  const handleInvalid = useCallback((invalidErrors: FieldErrors) => {
    setHasAttemptedSubmit(true);
    const firstErrorName = Object.keys(invalidErrors)[0];
    if (firstErrorName) scrollToFieldByName(firstErrorName);
    toast.error(t("coform.errors.summary.toast"));
  }, [t]);

  const handleErrorFieldClick = useCallback((name: string) => {
    scrollToFieldByName(name);
  }, []);

  // Auto-submit unifié : useWatch détecte les changements de valeur (tous types d'input)
  // puis debounce 600ms avant de soumettre si la valeur a effectivement changé.
  const watchedValues = useWatch({ control });

  // Propager isDirty vers CoFormModal (détection de modifications non enregistrées)
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Warning navigateur avant fermeture/refresh si modifications non sauvegardées
  useUnsavedChangesWarning(isDirty);

  // Auto-save du draft à chaque changement de valeur (debounce interne au hook).
  // `formId` et `userId` sont dans les deps pour gérer le cas où ils arriveraient
  // de façon asynchrone (URL / loader) — sinon un save précoce partirait avec key=null.
  useEffect(() => {
    if (!isDirty) return;
    saveDraft({
      data: { [subFormId]: watchedValues as SubFormData },
      currentStepIndex: 0,
      completedSteps: [],
      addedOptions: Object.keys(addedOptionsMap).length > 0
        ? { [subFormId]: addedOptionsMap }
        : {},
    });
  }, [watchedValues, addedOptionsMap, isDirty, saveDraft, subFormId, formId, userId]);

  // Exposer la soumission programmatique via submitRef
  useEffect(() => {
    if (submitRef) {
      submitRef.current = () => handleSubmit(handleFormSubmit, handleInvalid)();
    }
    return () => {
      if (submitRef) submitRef.current = null;
    };
  }, [submitRef, handleSubmit, handleFormSubmit, handleInvalid]);

  useEffect(() => {
    if (!autoSubmitOnBlur) return;
    const current = JSON.stringify(watchedValues);
    if (current === lastSubmittedValuesRef.current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      lastSubmittedValuesRef.current = current;
      handleSubmit(handleFormSubmit)();
    }, 600);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  });

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, handleInvalid)} className="space-y-6">
      {restorableDraft && (
        <DraftRecoveryBanner
          mode="restorable"
          timestamp={restorableDraft.timestamp}
          onRestore={handleRestoreDraft}
          onDiscard={discardDraft}
        />
      )}
      {staleDraftInfo && !restorableDraft && (
        <DraftRecoveryBanner
          mode="stale"
          timestamp={staleDraftInfo.timestamp}
          onAcknowledge={acknowledgeStale}
        />
      )}
      {/* Bannière du formulaire avec titre en overlay */}
      {!hideBanner && (
        formData.useBannerImg && formData.profilBannerUrl ? (
          <div className="relative w-full overflow-hidden rounded-lg">
            <img
              src={formData.profilBannerUrl}
              alt={t("coform.banner.alt")}
              className="w-full h-48 object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
            {formData.name && (
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <h1 className="text-4xl font-bold text-white drop-shadow-lg">
                  {formData.name}
                </h1>
              </div>
            )}
          </div>
        ) : formData.name ? (
          <div className="w-full rounded-lg bg-linear-to-r from-primary/10 via-primary/5 to-background p-8 border">
            <h1 className="text-4xl font-bold text-foreground">
              {formData.name}
            </h1>
          </div>
        ) : null
      )}

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

          return (
            <Card key={subForm.subFormId} className="shadow-sm">
              <CardHeader className="space-y-3">
                <CardTitle className="text-2xl">{subForm.subFormName}</CardTitle>
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

      <ErrorSummary
        errors={hasAttemptedSubmit ? errors : {}}
        fields={allFields}
        onFieldClick={handleErrorFieldClick}
      />

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
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
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
