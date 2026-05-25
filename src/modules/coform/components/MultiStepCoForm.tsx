import { Fragment, useRef, useEffect, useMemo } from "react";
import { Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "../i18n/i18n";
import { CoFormProvider } from "../contexts/CoFormProvider";
import { useCoForm } from "../hooks/useCoForm";
import { useCoFormStep } from "../hooks/useCoFormStep";
import { useCoFormNavigation, useCoFormSubmit } from "../hooks/useCoFormNavigation";
import { TextField, TextAreaField, RadioField, CheckboxField, ProseContent, SectionTitleField, SectionDescriptionField } from "./FormFields";
import { MultiCheckboxPlusField } from "./MultiCheckboxPlusField";
import { MultiRadioField } from "./MultiRadioField";
import { EvaluationField } from "./EvaluationField";
import { FinderField } from "./FinderField";
import { SimpleTableField } from "./SimpleTableField";
import { UploaderField } from "./UploaderField";
import { useConditionalFields } from "../hooks/useConditionalFields";
import type { CoFormData, SubFormData, AllStepsData, MultiCheckboxPlusValue, MultiRadioValue, EvaluationValue, FinderValue, SimpleTableValue } from "../types";
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
}

/**
 * Composant de formulaire multi-étapes avec envoi de données à chaque étape
 */
export function MultiStepCoForm({
  formData,
  submitMode = "step",
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
    >
      <MultiStepCoFormContent
        variant={variant}
        showProgress={showProgress}
        showStepNumbers={showStepNumbers}
        allowFreeNavigation={allowFreeNavigation}
        onSuccess={onSuccess}
        onDirtyChange={onDirtyChange}
        lockedFields={lockedFields}
        className={className}
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
  className,
}: {
  variant: CoFormVariant;
  showProgress: boolean;
  showStepNumbers: boolean;
  allowFreeNavigation: boolean;
  onSuccess?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  lockedFields?: string[];
  className?: string;
}) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const coform = useCoForm();
  const navigation = useCoFormNavigation();
  const { submit: submitAll, isSubmitting: isFinalSubmitting } = useCoFormSubmit({
    onSuccess: () => onSuccess?.(),
  });
  const { form, fields, stepName, isSubmitting, submitStep } = useCoFormStep();

  // Logique conditionnelle pour l'étape courante
  const { isFieldVisible } = useConditionalFields(fields?.fields ?? [], form.control);

  const lockedSet = useMemo(() => new Set(lockedFields ?? []), [lockedFields]);

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

  // Gérer la soumission de l'étape ou la soumission finale
  const handleSubmit = async () => {
    await submitStep();
    
    // Si dernière étape, soumettre toutes les données
    // stepsDataRef dans CoFormProvider garantit que les données sont à jour
    if (navigation.isLastStep) {
      await submitAll();
    }
  };

  if (!fields) {
    return <div>{t("coform.status.loading")}</div>;
  }

  return (
    <div ref={containerRef} className={cn("space-y-6", className)}>
      {/* Bannière du formulaire avec titre en overlay */}
      {coform.formData?.useBannerImg && coform.formData.profilBannerUrl ? (
        <div className="relative w-full overflow-hidden rounded-lg">
          <img
            src={coform.formData.profilBannerUrl}
            alt="Bannière du formulaire"
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
          {coform.formData.name && (
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <h1 className="text-4xl font-bold text-white drop-shadow-lg">
                {coform.formData.name}
              </h1>
            </div>
          )}
        </div>
      ) : coform.formData?.name ? (
        <div className="w-full rounded-lg bg-linear-to-r from-primary/10 via-primary/5 to-background p-8 border">
          <h1 className="text-4xl font-bold text-foreground">
            {coform.formData.name}
          </h1>
        </div>
      ) : null}

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
          <CardTitle className="text-2xl">{stepName}</CardTitle>
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
          <form id="step-form" onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="grid grid-cols-12 gap-6">
              {fields.fields.map((field) => {
                if (!isFieldVisible(field.name)) return null;
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
                          formId={coform.formData?.id}
                          answerId={coform.answerId}
                          subKey={fields.subFormId ? `${fields.subFormId}.${field.name}` : undefined}
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
                if (isLocked && fieldElement && field.componentType !== "sectionTitle" && field.componentType !== "sectionDescription") {
                  return (
                    <div key={field.name} className="contents pointer-events-none opacity-60 *:cursor-not-allowed">
                      {fieldElement}
                    </div>
                  );
                }
                return fieldElement;
            })}
            </div>
          </form>
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
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
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
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
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
    <div className="flex items-center justify-between">
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

        return (
          <Fragment key={index}>
            <button
              type="button"
              onClick={() => allowFreeNavigation && onStepClick?.(index)}
              disabled={!allowFreeNavigation}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2 font-medium transition-colors",
                isCompleted && "bg-primary border-primary text-primary-foreground",
                isCurrent && "border-primary text-primary",
                isPending && "border-muted text-muted-foreground",
                allowFreeNavigation && "cursor-pointer hover:border-primary/80"
              )}
            >
              {buttonContent}
            </button>

            {index < totalSteps - 1 && (
              <div
                className={cn(
                  "flex-1 h-1 mx-2",
                  isCompleted ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
};

export default MultiStepCoForm;
