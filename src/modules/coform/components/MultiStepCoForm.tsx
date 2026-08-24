import { Fragment, useCallback, useRef, useEffect, useMemo, useState } from "react";
import { Controller, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "../i18n/i18n";
import { CoFormProvider } from "../contexts/CoFormProvider";
import { useCoForm } from "../hooks/useCoForm";
import { useCoFormStep } from "../hooks/useCoFormStep";
import { useCoFormNavigation, useCoFormSubmit } from "../hooks/useCoFormNavigation";
import { TextField, TextAreaField, RadioField, CheckboxField, SelectField, ProseContent, SectionTitleField, SectionDescriptionField, TitleSeparatorField } from "./FormFields";
import { TagsField } from "./TagsField";
import { MultiCheckboxPlusField } from "./MultiCheckboxPlusField";
import { MultiRadioField } from "./MultiRadioField";
import { EvaluationField } from "./EvaluationField";
import { CommonTableField } from "./CommonTableField";
import { CategorizedCheckboxField } from "./CategorizedCheckboxField";
import { TimeSlotsField } from "./TimeSlotsField";
import { DynamicFieldsField } from "./DynamicFieldsField";
import { MultiEvalChartDialog } from "./MultiEvalChartDialog";
import { DraftRecoveryBanner } from "./DraftRecoveryBanner";
import { ErrorSummary } from "./ErrorSummary";
import { AnswerActivityDialog } from "./AnswerActivityDialog";
import { FinderField } from "./FinderField";
import { SimpleTableField } from "./SimpleTableField";
import { UploaderField } from "./UploaderField";
import { MilestoneListField } from "./MilestoneListField";
import { UnsupportedField } from "./UnsupportedField";
import { CoFormBanner } from "./CoFormBanner";
import { useConditionalFields } from "../hooks/useConditionalFields";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";
import { getStepHasMultiEval, getOriginalFieldKey } from "../utils/formParser";
import { scrollToFieldByName } from "../utils/helpers";
import type { CoFormData, SubFormData, AllStepsData, MultiCheckboxPlusValue, MultiRadioValue, EvaluationValue, CommonTableValue, CategorizedCheckboxValue, FinderValue, SimpleTableValue, ExistingAnswerMeta, TagsValue } from "../types";
import type { CoFormSubmitMode, CoFormVariant } from "../schema";

interface MultiStepCoFormProps {
  formData: CoFormData;
  submitMode?: CoFormSubmitMode;
  onStepSubmit?: (subFormId: string, data: SubFormData, stepIndex: number) => Promise<void>;
  onFinalSubmit?: (allData: AllStepsData) => Promise<void>;
  onSuccess?: () => void;
  variant?: CoFormVariant;
  showProgress?: boolean;
  showStepNumbers?: boolean;
  allowFreeNavigation?: boolean;
  className?: string;
  /** Valeurs par défaut pour pré-remplir le formulaire (mode édition) */
  defaultValues?: AllStepsData;
  /** ID de la réponse en cours d'édition (pour le chargement des fichiers legacy) */
  answerId?: string;
  /** Clé (subFormId) de l'étape initiale pour démarrer le wizard sur une étape spécifique */
  initialStepKey?: string;
  /** Appelé quand l'état "modifié" change (utilisable par CoFormModal) */
  onDirtyChange?: (isDirty: boolean) => void;
  /** Liste de clés d'inputs verrouillés (lecture seule, non modifiables) */
  lockedFields?: string[];
  /**
   * Liste de clés d'inputs **complètement masqués** (skip total du rendu).
   * Calculée serveur-side dans `access.restrictedFields` à partir de
   * `placeAdminOnlyFields` / `placeMemberOnlyFields` croisés avec le rôle
   * de l'user sur le lieu. Aligné sur le legacy `isAdminOnly` qui hide
   * entirely (pas de readonly cosmétique).
   */
  restrictedFields?: string[];
  /** ID du formulaire — clé de draft localStorage. */
  formId?: string;
  /** ID utilisateur connecté — clé de draft localStorage. */
  userId?: string | null;
  /** updatedAt serveur (édition) — pour détecter les drafts obsolètes. */
  baseUpdatedAt?: number | null;
  /** Active la persistance du draft. Défaut : true. */
  enableDraft?: boolean;
  /**
   * Métadonnées de la réponse existante (créateur + dernier modifieur).
   * Quand fournies, un lien "Voir l'activité" apparaît sous le form qui
   * ouvre la modale AnswerActivityDialog avec l'historique des modifs.
   */
  existingAnswerMeta?: ExistingAnswerMeta | null;
  /**
   * Comment rendre un champ dont le type n'a pas de composant. Défaut :
   * `"error"`. Cf. `UnsupportedField`.
   */
  unknownFieldVariant?: "error" | "placeholder";
}

/**
 * Composant de formulaire multi-étapes avec envoi de données à chaque étape
 */
export function MultiStepCoForm({
  formData,
  // Aligné sur le default de `CoFormProvider` : "final" pour éviter le no-op
  // silencieux quand le caller ne précise pas le mode. Voir README.md#step-mode.
  submitMode = "final",
  onStepSubmit,
  onFinalSubmit,
  onSuccess,
  variant = "wizard",
  showProgress = true,
  showStepNumbers = true,
  allowFreeNavigation = false,
  className,
  defaultValues,
  answerId,
  initialStepKey,
  onDirtyChange,
  lockedFields,
  restrictedFields,
  formId,
  userId,
  baseUpdatedAt,
  enableDraft = true,
  existingAnswerMeta,
  unknownFieldVariant = "error",
}: MultiStepCoFormProps) {
  return (
    <CoFormProvider
      formData={formData}
      onStepSubmit={onStepSubmit}
      onFinalSubmit={onFinalSubmit}
      submitMode={submitMode}
      defaultValues={defaultValues}
      answerId={answerId}
      initialStepKey={initialStepKey}
      formId={formId}
      userId={userId}
      baseUpdatedAt={baseUpdatedAt}
      enableDraft={enableDraft}
    >
      <MultiStepCoFormContent
        variant={variant}
        showProgress={showProgress}
        showStepNumbers={showStepNumbers}
        allowFreeNavigation={allowFreeNavigation}
        onSuccess={onSuccess}
        onDirtyChange={onDirtyChange}
        lockedFields={lockedFields}
        restrictedFields={restrictedFields}
        className={className}
        existingAnswerMeta={existingAnswerMeta}
        unknownFieldVariant={unknownFieldVariant}
      />
    </CoFormProvider>
  );
};

/**
 * Contenu interne du formulaire multi-étapes
 */
function MultiStepCoFormContent({
  variant,
  showProgress,
  showStepNumbers,
  allowFreeNavigation,
  onSuccess,
  onDirtyChange,
  lockedFields,
  restrictedFields,
  className,
  existingAnswerMeta,
  unknownFieldVariant,
}: {
  variant: CoFormVariant;
  showProgress: boolean;
  showStepNumbers: boolean;
  allowFreeNavigation: boolean;
  onSuccess?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  lockedFields?: string[];
  restrictedFields?: string[];
  className?: string;
  existingAnswerMeta?: ExistingAnswerMeta | null;
  unknownFieldVariant: "error" | "placeholder";
}) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const coform = useCoForm();
  const navigation = useCoFormNavigation();
  const { submit: submitAll, isSubmitting: isFinalSubmitting } = useCoFormSubmit({
    onSuccess: () => onSuccess?.(),
  });
  const { form, fields, stepName, isSubmitting, submitStep } = useCoFormStep();

  // Multi-eval radar : on affiche un bouton "Voir les évaluations" dans le
  // header de la step si elle contient au moins un input avec
  // `activeMultieval=true` ET qu'on est en mode édition (answerId présent).
  const [multiEvalOpen, setMultiEvalOpen] = useState(false);
  const stepHasMultiEval = useMemo(
    () => (fields ? getStepHasMultiEval(fields) : false),
    [fields]
  );
  const showMultiEvalButton = stepHasMultiEval && !!coform.answerId;

  // Logique conditionnelle pour l'étape courante
  const { isFieldVisible } = useConditionalFields(fields?.fields ?? [], form.control);

  const lockedSet = useMemo(() => new Set(lockedFields ?? []), [lockedFields]);
  const restrictedSet = useMemo(() => new Set(restrictedFields ?? []), [restrictedFields]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Remonter en haut du conteneur (modal ou page) au changement d'étape
  useEffect(() => {
    if (!containerRef.current) return;
    // Chercher le premier ancêtre scrollable (modal body, dialog, ou page)
    let el: HTMLElement | null = containerRef.current.parentElement;
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === "auto" || overflowY === "scroll") {
        el.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      el = el.parentElement;
    }
    // Fallback : remonter le conteneur lui-même via scrollIntoView
    containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [navigation.currentStepIndex]);

  // Propager isDirty vers le parent (CoFormModal)
  const isDirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Warning navigateur avant fermeture/refresh si modifications non sauvegardées.
  useUnsavedChangesWarning(isDirty);

  // Affiche le récap d'erreurs (ErrorSummary) uniquement après une tentative
  // de soumission échouée — évite de polluer la lecture initiale.
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Activity dialog (historique de modifications de la réponse).
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);

  // Map subFormId → display name pour rendre l'historique d'activité lisible
  // (sinon on affiche les clés brutes type `navigatorDesTierslieux1572025_2311_0`).
  const formInputs = coform.formData?.inputs;
  const stepNames = useMemo(() => {
    const map: Record<string, string> = {};
    if (formInputs) {
      for (const [stepId, stepData] of Object.entries(formInputs)) {
        const name = (stepData as { name?: unknown })?.name;
        if (typeof name === "string" && name.trim() !== "") {
          map[stepId] = name;
        }
      }
    }
    return map;
  }, [formInputs]);

  // Gérer la soumission de l'étape ou la soumission finale.
  // Note : la validation Zod est interceptée en amont par RHF via le
  // 2e arg de `form.handleSubmit(handleSubmit, handleInvalid)`. Ce bloc
  // ne tourne donc QUE si Zod a passé. On lit quand même le retour de
  // `submitStep` pour bail sur une erreur runtime (catch interne du hook,
  // mutation backend qui throw) — sinon on enchaînerait `submitAll()` sur
  // un état d'étape incohérent.
  const handleSubmit = async () => {
    setHasAttemptedSubmit(false);
    const ok = await submitStep();
    if (!ok) return;

    if (navigation.isLastStep) {
      await submitAll();
    }
  };

  const handleInvalid = useCallback((invalidErrors: FieldErrors) => {
    setHasAttemptedSubmit(true);
    const firstErrorName = Object.keys(invalidErrors)[0];
    if (firstErrorName) scrollToFieldByName(firstErrorName);
    toast.error(t("coform.errors.summary.toast"));
  }, [t]);

  const handleErrorFieldClick = useCallback((name: string) => {
    scrollToFieldByName(name);
  }, []);

  if (!fields || !coform.formData) {
    return <div>{t("coform.status.loading")}</div>;
  }
  // Narrow local : permet aux callbacks (Controller.render, etc.) d'utiliser
  // formId sans avoir à re-vérifier le null.
  const formId = coform.formData.id;

  return (
    <div ref={containerRef} className={cn("space-y-6", className)}>
      <CoFormBanner formData={coform.formData} />

      {/* Barre de progression - Style amélioré */}
      {showProgress && (
        <div className="space-y-3 pb-4 border-b">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-foreground">
              {stepName}
            </span>
            <span className="text-muted-foreground">
              {t("coform.steps.step")} {navigation.currentStepIndex + 1} {t("coform.steps.of")} {navigation.totalSteps}
            </span>
          </div>
          <Progress 
            value={navigation.progressPercent} 
            className="h-2 bg-muted"
          />
          <div className="text-xs text-muted-foreground text-right">
            {t("coform.progress.percent", undefined, { percent: navigation.progressPercent })}
          </div>
        </div>
      )}

      {/* Banner de récupération de draft (s'il y en a un en localStorage).
          Mount conditionnel — pas de surface si rien à restaurer. */}
      {coform.restorableDraft && (
        <DraftRecoveryBanner
          mode="restorable"
          timestamp={coform.restorableDraft.timestamp}
          onRestore={coform.restoreDraft}
          onDiscard={coform.discardDraft}
        />
      )}
      {coform.staleDraftInfo && !coform.restorableDraft && (
        <DraftRecoveryBanner
          mode="stale"
          timestamp={coform.staleDraftInfo.timestamp}
          onAcknowledge={coform.acknowledgeStaleDraft}
        />
      )}

      {/* Indicateurs d'étapes */}
      {variant === "stepper" && (
        <StepIndicator
          totalSteps={navigation.totalSteps}
          currentStep={navigation.currentStepIndex}
          completedSteps={navigation.completedSteps}
          subFormsFields={coform.subFormsFields}
          allowFreeNavigation={allowFreeNavigation}
          showStepNumbers={showStepNumbers}
          onStepClick={allowFreeNavigation ? navigation.goTo : undefined}
        />
      )}

      {/* Formulaire de l'étape actuelle */}
      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-2xl">{stepName}</CardTitle>
            {showMultiEvalButton && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMultiEvalOpen(true)}
                className="shrink-0 gap-2"
              >
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">{t("coform.multiEval.viewChart")}</span>
              </Button>
            )}
          </div>
          {coform.formData?.inputs?.[fields.subFormId]?.info && (
            <CardDescription className="text-base">
              <ProseContent
                text={coform.formData.inputs[fields.subFormId].info as string}
                className="prose prose-sm dark:prose-invert max-w-none"
              />
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          <form id="step-form" onSubmit={form.handleSubmit(handleSubmit, handleInvalid)}>
            <div className="grid grid-cols-12 gap-6">
              {fields.fields.map((field) => {
                if (!isFieldVisible(field.name)) return null;
                // Skip total : l'user n'a pas le droit selon les listes
                // place(Admin|Member)OnlyFields. Calculé serveur-side dans
                // `access.restrictedFields`. Aligné sur le legacy isAdminOnly
                // qui hide entirely (pas de readonly cosmétique).
                if (restrictedSet.has(getOriginalFieldKey(field))) return null;
                const isLocked = lockedSet.has(field.name);
                const fieldElement = (() => { switch (field.componentType) {
                case "text":
                  return (
                    <TextField
                      key={field.name}
                      field={field}
                      register={form.register}
                      errors={form.formState.errors}
                    />
                  );

                case "textarea":
                  if (field.markdown) {
                    return (
                      <Controller
                        key={field.name}
                        name={field.name}
                        control={form.control}
                        render={({ field: controllerField }) => (
                          <TextAreaField
                            field={field}
                            errors={form.formState.errors}
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
                      register={form.register}
                      errors={form.formState.errors}
                    />
                  );

                case "radio":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <RadioField
                          field={field}
                          register={form.register}
                          errors={form.formState.errors}
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
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <CheckboxField
                          field={field}
                          register={form.register}
                          errors={form.formState.errors}
                          value={controllerField.value}
                          onChange={controllerField.onChange}
                        />
                      )}
                    />
                  );

                case "select":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <SelectField
                          field={field}
                          errors={form.formState.errors}
                          value={controllerField.value}
                          onChange={controllerField.onChange}
                        />
                      )}
                    />
                  );

                case "multiRadio":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <MultiRadioField
                          field={field}
                          errors={form.formState.errors}
                          value={controllerField.value as MultiRadioValue}
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
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <MultiCheckboxPlusField
                          field={field}
                          errors={form.formState.errors}
                          value={controllerField.value as MultiCheckboxPlusValue}
                          onChange={controllerField.onChange}
                          onAddedOptionsChange={(opts) => {
                            if (fields.subFormId) {
                              coform.saveAddedOptions(fields.subFormId, field.name, opts);
                            }
                          }}
                        />
                      )}
                    />
                  );

                case "evaluation":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <EvaluationField
                          field={field}
                          errors={form.formState.errors}
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
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <CommonTableField
                          field={field}
                          errors={form.formState.errors}
                          value={controllerField.value as CommonTableValue}
                          onChange={controllerField.onChange}
                          formId={formId}
                          readOnly={isLocked}
                        />
                      )}
                    />
                  );

                case "categorizedCheckbox":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <CategorizedCheckboxField
                          field={field}
                          errors={form.formState.errors}
                          value={controllerField.value as CategorizedCheckboxValue}
                          onChange={controllerField.onChange}
                          readOnly={isLocked}
                        />
                      )}
                    />
                  );

                case "timeSlots":
                  // Câblage identique à DynamicCoForm — le trou multi-step rendait « type de champ
                  // inconnu » sur un form multi-étapes portant ces inputs (cas réel : form 13
                  // étapes, dynamicFields à l'étape 9). NB : ces 2 composants n'ont pas (encore)
                  // de prop readOnly — même limite que côté DynamicCoForm.
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <TimeSlotsField
                          field={field}
                          errors={form.formState.errors}
                          value={controllerField.value}
                          onChange={controllerField.onChange}
                        />
                      )}
                    />
                  );

                case "dynamicFields":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <DynamicFieldsField
                          field={field}
                          errors={form.formState.errors}
                          value={controllerField.value}
                          onChange={controllerField.onChange}
                        />
                      )}
                    />
                  );

                case "finder":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <FinderField
                          field={field}
                          errors={form.formState.errors}
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
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <SimpleTableField
                          field={field}
                          errors={form.formState.errors}
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
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <UploaderField
                          field={field}
                          errors={form.formState.errors}
                          value={controllerField.value as import("../types").UploaderValue}
                          onChange={controllerField.onChange}
                          formId={formId}
                          answerId={coform.answerId}
                          subKey={fields.subFormId ? `${fields.subFormId}.${field.name}` : undefined}
                        />
                      )}
                    />
                  );

                case "tags":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={form.control}
                      render={({ field: controllerField }) => (
                        <TagsField
                          field={field}
                          errors={form.formState.errors}
                          value={controllerField.value as TagsValue}
                          onChange={controllerField.onChange}
                          readOnly={isLocked}
                        />
                      )}
                    />
                  );

                case "titleSeparator":
                  return <TitleSeparatorField key={field.name} field={field} />;

                case "sectionTitle":
                  return <SectionTitleField key={field.name} field={field} />;

                case "sectionDescription":
                  return <SectionDescriptionField key={field.name} field={field} />;

                case "milestoneList":
                  return (
                    <MilestoneListField
                      key={field.name}
                      field={field}
                      answerId={coform.answerId}
                      readOnly={isLocked}
                    />
                  );

                default:
                  return (
                    <UnsupportedField
                      key={field.name}
                      label={field.label}
                      type={field.type}
                      variant={unknownFieldVariant}
                    />
                  );
              } })();

                // Wrapper avec `data-field-name` pour permettre au récap
                // d'erreurs (`ErrorSummary`) de scroller + highlight via
                // `scrollToFieldByName`. `display: contents` → ne casse pas
                // le grid (les enfants restent items du grid parent). Les
                // composants de field qui ont déjà leur propre attribut (ex.
                // `CommonTableField`) restent prioritaires côté querySelector.
                if (!fieldElement) return null;
                if (
                  field.componentType === "sectionTitle" ||
                  field.componentType === "sectionDescription" ||
                  field.componentType === "titleSeparator"
                ) {
                  return fieldElement;
                }
                return (
                  <div
                    key={field.name}
                    data-field-name={field.name}
                    className={cn(
                      "contents",
                      isLocked && "pointer-events-none opacity-60 *:cursor-not-allowed",
                    )}
                  >
                    {fieldElement}
                  </div>
                );
            })}
            </div>
          </form>

          {/* Récap d'erreurs : affiché seulement après une tentative de submit
              échouée, listant tous les champs invalides avec leur message,
              cliquables pour scroller au champ. */}
          <ErrorSummary
            errors={hasAttemptedSubmit ? form.formState.errors : {}}
            fields={fields?.fields ?? []}
            onFieldClick={handleErrorFieldClick}
          />
        </CardContent>

        <CardFooter className="flex justify-between gap-3 border-t pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={navigation.previous}
            disabled={navigation.isFirstStep || isSubmitting}
            className={cn(
              "gap-2 transition-opacity",
              navigation.isFirstStep && "invisible"
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("coform.navigation.previous")}
          </Button>

          <div className="flex gap-2 ml-auto">
            {navigation.isLastStep ? (
              <Button
                type="submit"
                form="step-form"
                disabled={isSubmitting || isFinalSubmitting}
                className="gap-2 min-w-35"
                size="lg"
              >
                {isSubmitting || isFinalSubmitting ? (
                  <>
                    <Spinner label={String(t("coform.status.submitting"))} />
                    {t("coform.status.submitting")}
                  </>
                ) : (
                  <>
                    {t("coform.navigation.submit")}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="submit"
                form="step-form"
                disabled={isSubmitting}
                className="gap-2 min-w-35"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Spinner label={String(t("coform.status.submitting"))} />
                    {t("coform.status.submitting")}
                  </>
                ) : (
                  <>
                    {t("coform.navigation.next")}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Message d'erreur global */}
      {coform.error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
          {coform.error.message}
        </div>
      )}

      {/* Lien discret "Voir l'activité" — visible uniquement en mode édition
          d'une réponse existante. Aligné sur DynamicCoForm pour parité de
          features entre single-step et multi-step. */}
      {existingAnswerMeta && coform.answerId && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setActivityDialogOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
          >
            {t("coform.activity.link")}
          </button>
        </div>
      )}
      {activityDialogOpen && (
        <AnswerActivityDialog
          open
          onOpenChange={setActivityDialogOpen}
          answerId={coform.answerId ?? null}
          meta={existingAnswerMeta}
          stepNames={stepNames}
        />
      )}

      {/* Dialog multi-eval : mount conditionnel — évite de payer le fetch
          `useMultiEvalData` + le lazy-import recharts tant que l'utilisateur
          n'a pas cliqué sur "Voir les évaluations". */}
      {multiEvalOpen && (
        <MultiEvalChartDialog
          open
          onOpenChange={setMultiEvalOpen}
          answerId={coform.answerId ?? null}
          stepKey={fields?.subFormId ?? null}
          stepName={stepName}
        />
      )}
    </div>
  );
};

/**
 * Indicateur visuel des étapes (stepper)
 */
function StepIndicator({
  totalSteps,
  currentStep,
  completedSteps,
  subFormsFields,
  allowFreeNavigation,
  showStepNumbers,
  onStepClick,
}: {
  totalSteps: number;
  currentStep: number;
  completedSteps: string[];
  subFormsFields: { subFormId: string; subFormName: string }[];
  allowFreeNavigation: boolean;
  showStepNumbers: boolean;
  onStepClick?: (index: number) => void;
}) {
  return (
    <nav aria-label="Étapes du formulaire">
      <ol className="flex items-center justify-between list-none p-0 m-0">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const subForm = subFormsFields[index];
          const isCompleted = subForm && completedSteps.includes(subForm.subFormId);
          const isCurrent = index === currentStep;
          const isPending = !isCompleted && !isCurrent;

          // Contenu du bouton: ✓ si complété, numéro si showStepNumbers, sinon point
          const buttonContent = isCompleted
            ? "✓"
            : showStepNumbers
              ? index + 1
              : "•";

          // Label parlant pour SR : "Étape X : Nom du sub-form (complétée|en cours|à venir)"
          const stateLabel = isCompleted
            ? "complétée"
            : isCurrent
              ? "en cours"
              : "à venir";
          const stepLabel = `Étape ${index + 1}${subForm?.subFormName ? ` : ${subForm.subFormName}` : ""} (${stateLabel})`;

          return (
            <Fragment key={index}>
              <li className="contents">
                <button
                  type="button"
                  onClick={() => allowFreeNavigation && onStepClick?.(index)}
                  disabled={!allowFreeNavigation}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={stepLabel}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 font-medium transition-colors",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "border-primary text-primary",
                    isPending && "border-muted text-muted-foreground",
                    allowFreeNavigation && "cursor-pointer hover:border-primary/80"
                  )}
                >
                  <span aria-hidden="true">{buttonContent}</span>
                </button>
              </li>

              {index < totalSteps - 1 && (
                <li aria-hidden="true" className="contents">
                  <div
                    className={cn(
                      "flex-1 h-1 mx-2",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )}
                  />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default MultiStepCoForm;
