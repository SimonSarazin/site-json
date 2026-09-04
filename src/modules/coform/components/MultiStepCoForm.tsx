import { useCallback, useRef, useEffect, useMemo, useState } from "react";
import { Controller, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "../i18n/i18n";
import { CoFormProvider } from "../contexts/CoFormProvider";
import { useCoForm } from "../hooks/useCoForm";
import { useCoFormStep } from "../hooks/useCoFormStep";
import { useCoFormNavigation, useCoFormSubmit } from "../hooks/useCoFormNavigation";
import { TextField, TextAreaField, RadioField, CheckboxField, SelectField, ProseContent, SectionTitleField, SectionDescriptionField } from "./FormFields";
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
import { CoFormBanner } from "./CoFormBanner";
import { StepsNav } from "./StepsNav";
import { useConditionalFields } from "../hooks/useConditionalFields";
import { ConditionalField } from "./ConditionalField";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";
import { getStepHasMultiEval, getOriginalFieldKey } from "../utils/formParser";
import { buildStepItems, invalidSteps, isSubFormValid } from "../utils/stepsNav";
import { scrollToFieldByName } from "../utils/helpers";
import type { CoFormData, SubFormData, AllStepsData, MultiCheckboxPlusValue, MultiRadioValue, EvaluationValue, CommonTableValue, CategorizedCheckboxValue, FinderValue, SimpleTableValue, ExistingAnswerMeta } from "../types";
import type { CoFormSubmitMode, CoFormVariant } from "../schema";

interface MultiStepCoFormProps {
  formData: CoFormData;
  submitMode?: CoFormSubmitMode;
  onStepSubmit?: (subFormId: string, data: SubFormData, stepIndex: number) => Promise<void>;
  onFinalSubmit?: (allData: AllStepsData) => Promise<void>;
  onSuccess?: () => void;
  variant?: CoFormVariant;
  /**
   * Affiche l'en-tête d'étapes : pastilles cliquables, compteur et sommaire.
   * Le mettre à `false` retire donc aussi la navigation directe.
   */
  showProgress?: boolean;
  showStepNumbers?: boolean;
  /**
   * Navigation directe entre étapes depuis l'en-tête. Défaut : **true** —
   * décision produit du 4 septembre : toutes les étapes sont cliquables, en
   * création comme en édition ; sauter la 2 la laisse « À faire », c'est la
   * soumission finale qui contrôle, pas l'en-tête.
   */
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
  allowFreeNavigation = true,
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
}) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const coform = useCoForm();
  const navigation = useCoFormNavigation();
  const { submit: submitAll, isSubmitting: isFinalSubmitting } = useCoFormSubmit({
    onSuccess: () => onSuccess?.(),
  });
  const { form, fields, stepName, subFormId, isSubmitting, submitStep, saveStep } = useCoFormStep();

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
  const { isFieldVisible, hasConditionalRule } = useConditionalFields(fields?.fields ?? [], form.control);

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

  // Propager isDirty vers le parent (CoFormModal).
  //
  // `isDirty` ne vaut que pour l'étape courante, et changer d'étape remonte le
  // formulaire à zéro (`form.reset` dans `useCoFormStep`) : sans mémoire, taper
  // dans l'étape 1 puis cliquer l'étape 2 dans l'en-tête rendrait la modale
  // fermable sans confirmation, et la saisie serait perdue sans un mot — la
  // modale désactive le brouillon localStorage.
  const [hasEditedAnyStep, setHasEditedAnyStep] = useState(false);
  const isDirty = form.formState.isDirty || hasEditedAnyStep;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Warning navigateur avant fermeture/refresh si modifications non sauvegardées.
  useUnsavedChangesWarning(isDirty);

  // Affiche le récap d'erreurs (ErrorSummary) uniquement après une tentative
  // de soumission échouée — évite de polluer la lecture initiale.
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Action stable du provider : dépendre de `coform` entier ferait re-créer les
  // callbacks à chaque changement d'état.
  const { markStepInvalid } = coform;

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

  // Étapes telles que l'en-tête les voit. `errorSteps` porte aussi bien un envoi
  // raté qu'une validation ratée (cf. `markStepInvalid`), les deux se lisent
  // « à corriger » pour celui qui remplit.
  const stepItems = useMemo(
    () =>
      buildStepItems({
        steps: coform.subFormsFields,
        currentIndex: navigation.currentStepIndex,
        completedIds: navigation.completedSteps,
        errorIds: coform.stepState.errorSteps,
        navigable: allowFreeNavigation,
      }),
    [
      coform.subFormsFields,
      coform.stepState.errorSteps,
      navigation.currentStepIndex,
      navigation.completedSteps,
      allowFreeNavigation,
    ]
  );

  // Changer d'étape depuis l'en-tête.
  const handleStepSelect = (index: number) => {
    if (index === navigation.currentStepIndex) return;
    // Une étape réservée à un autre rôle n'est pas atteignable, quel que soit le
    // chemin emprunté dans l'en-tête (pastille, sommaire, raccourci d'erreur).
    if (!stepItems[index]?.clickable) return;

    // Le brouillon d'abord : sinon la saisie en cours (non soumise, donc jamais
    // validée) disparaît au `form.reset` du changement d'étape. Uniquement si
    // l'user a touché à quelque chose — traverser une étape ne doit pas
    // matérialiser ses valeurs par défaut dans la réponse.
    if (form.formState.isDirty) {
      saveStep();
      setHasEditedAnyStep(true);
    }

    // Aucun « Suivant » n'est franchi en navigation libre : c'est ici qu'on
    // constate si l'étape quittée passerait sa validation. On ne LÈVE jamais
    // d'erreur au passage (une étape simplement traversée reste « à faire ») —
    // seule une tentative de soumission peut peindre une étape en rouge.
    if (fields && subFormId) {
      const valide = isSubFormValid(fields, form.getValues());
      coform.setStepCompleted(subFormId, valide);
      if (valide) coform.markStepInvalid(subFormId, false);
    }

    // Le récap d'erreurs appartient à l'étape qu'on a tenté de soumettre : sans
    // ce reset, il ressurgirait sur l'étape suivante au premier champ quitté.
    setHasAttemptedSubmit(false);
    navigation.goTo(index);
  };

  // Gérer la soumission de l'étape ou la soumission finale.
  // Note : la validation Zod est interceptée en amont par RHF via le
  // 2e arg de `form.handleSubmit(handleSubmit, handleInvalid)`. Ce bloc
  // ne tourne donc QUE si Zod a passé. On lit quand même le retour de
  // `submitStep` pour bail sur une erreur runtime (catch interne du hook,
  // mutation backend qui throw) — sinon on enchaînerait `submitAll()` sur
  // un état d'étape incohérent.
  const handleSubmit = async () => {
    setHasAttemptedSubmit(false);

    // Garde de la soumission finale, AVANT toute écriture. En navigation libre on
    // peut atteindre la dernière étape sans avoir validé les autres : `submitStep`
    // ne contrôle que l'étape courante et `submitAllData` ne valide rien. Elle
    // passe avant `submitStep()` parce qu'en mode "step"/"both" celui-ci écrit
    // déjà au serveur : refuser après avoir persisté serait pire que ne rien faire.
    //
    // L'étape COURANTE est exclue : react-hook-form vient de la valider (ce bloc
    // est la branche valide de `handleSubmit`), et ses valeurs fraîches ne sont pas
    // encore dans `stepsData`. Les autres étapes, elles, y sont : on les lit par
    // `getStepsData()`, qui rend la donnée du ref et non celle du rendu courant.
    if (navigation.isLastStep) {
      const autres = coform.subFormsFields.filter((sf) => sf.subFormId !== subFormId);
      const aCorriger = invalidSteps(autres, coform.getStepsData(), restrictedFields);
      if (aCorriger.length > 0) {
        aCorriger.forEach((step) => coform.markStepInvalid(step.subFormId, true));
        const premier = aCorriger[0];
        toast.error(
          premier.subFormName
            ? t("coform.errors.stepIncomplete", undefined, { name: premier.subFormName })
            : t("coform.errors.summary.toast")
        );
        navigation.goTo(coform.subFormsFields.indexOf(premier));
        return;
      }
    }

    const ok = await submitStep();
    if (!ok) return;

    if (navigation.isLastStep) {
      await submitAll();
    }
  };

  const handleInvalid = useCallback((invalidErrors: FieldErrors) => {
    setHasAttemptedSubmit(true);
    if (subFormId) markStepInvalid(subFormId, true);
    const firstErrorName = Object.keys(invalidErrors)[0];
    if (firstErrorName) scrollToFieldByName(firstErrorName);
    toast.error(t("coform.errors.summary.toast"));
  }, [t, subFormId, markStepInvalid]);

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

      {/* En-tête d'étapes : fenêtre cliquable sur ordinateur, étape courante +
          sommaire sur téléphone. Il porte aussi le compteur « Étape 3 sur 11 »,
          d'où le remplacement de l'ancienne barre de progression. */}
      {(showProgress || variant === "stepper") && navigation.totalSteps > 1 && (
        <StepsNav
          steps={stepItems}
          currentIndex={navigation.currentStepIndex}
          onStepSelect={handleStepSelect}
          showStepNumbers={showStepNumbers}
        />
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
                // Skip total : l'user n'a pas le droit selon les listes
                // place(Admin|Member)OnlyFields. Calculé serveur-side dans
                // `access.restrictedFields`. Aligné sur le legacy isAdminOnly
                // qui hide entirely (pas de readonly cosmétique).
                if (restrictedSet.has(getOriginalFieldKey(field))) return null;
                // Un champ PILOTÉ par une règle conditionnelle passe par
                // `ConditionalField`, qui anime sa venue et son départ ; les
                // autres gardent strictement le rendu d'origine.
                const estConditionnel = hasConditionalRule(field.name);
                const visible = isFieldVisible(field.name);
                // Garde DÉFENSIVE : un champ sans règle est toujours visible
                // (les deux fonctions lisent la même table). Elle n'est là que
                // pour le jour où un masquage viendrait d'une autre source —
                // invariant verrouillé par `useConditionalFields.test.ts`.
                if (!estConditionnel && !visible) return null;
                const isLocked = lockedSet.has(field.name);
                // Fonction NON invoquée ici : `ConditionalField` ne l'appelle
                // que lorsque le champ doit exister, sinon tous les champs
                // conditionnels seraient montés en permanence — et ceux qui
                // interrogent le réseau (`finder`, `commonTable`) le feraient
                // pour rien.
                const rendreChamp = () => { switch (field.componentType) {
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

                case "sectionTitle":
                  return <SectionTitleField key={field.name} field={field} />;

                case "sectionDescription":
                  return <SectionDescriptionField key={field.name} field={field} />;

                default:
                  return (
                    <div key={field.name} role="alert" className="col-span-12 flex flex-col gap-1 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      <p className="font-semibold">{field.label}</p>
                      <p>{t("coform.errors.unknownFieldType", undefined, { type: field.type })}</p>
                    </div>
                  );
              } };

                if (estConditionnel) {
                  // Les champs décoratifs ne reçoivent pas d'ancre
                  // `data-field-name`, comme sur le chemin non animé ci-dessous.
                  const estDecoratif =
                    field.componentType === "sectionTitle" ||
                    field.componentType === "sectionDescription";
                  return (
                    <ConditionalField
                      key={field.name}
                      visible={visible}
                      width={field.width}
                      fieldName={estDecoratif ? undefined : field.name}
                      isLocked={isLocked}
                    >
                      {rendreChamp}
                    </ConditionalField>
                  );
                }

                const fieldElement = rendreChamp();

                // Wrapper avec `data-field-name` pour permettre au récap
                // d'erreurs (`ErrorSummary`) de scroller + highlight via
                // `scrollToFieldByName`. `display: contents` → ne casse pas
                // le grid (les enfants restent items du grid parent). Les
                // composants de field qui ont déjà leur propre attribut (ex.
                // `CommonTableField`) restent prioritaires côté querySelector.
                if (!fieldElement) return null;
                if (
                  field.componentType === "sectionTitle" ||
                  field.componentType === "sectionDescription"
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

export default MultiStepCoForm;
