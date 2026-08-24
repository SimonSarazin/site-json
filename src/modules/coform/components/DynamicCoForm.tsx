import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useForm, Controller, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { TextField, TextAreaField, RadioField, CheckboxField, SelectField, ProseContent, SectionTitleField, SectionDescriptionField, TitleSeparatorField } from "./FormFields";
import { TagsField } from "./TagsField";
import { MultiCheckboxPlusField } from "./MultiCheckboxPlusField";
import { MultiRadioField } from "./MultiRadioField";
import { EvaluationField } from "./EvaluationField";
import { CommonTableField } from "./CommonTableField";
import { CategorizedCheckboxField } from "./CategorizedCheckboxField";
import { MultiEvalChartDialog } from "./MultiEvalChartDialog";
import { FinderField } from "./FinderField";
import { SimpleTableField } from "./SimpleTableField";
import { LocationField } from "./LocationField";
import { UploaderField } from "./UploaderField";
import { UnsupportedField } from "./UnsupportedField";
import { MilestoneListField } from "./MilestoneListField";
import { TimeSlotsField } from "./TimeSlotsField";
import { DynamicFieldsField } from "./DynamicFieldsField";
import { CoFormBanner } from "./CoFormBanner";
import { DraftRecoveryBanner } from "./DraftRecoveryBanner";
import { ErrorSummary } from "./ErrorSummary";
import { AnswerActivityDialog } from "./AnswerActivityDialog";
import type { CoFormData, SubFormData, AddedOptionsMap, EvaluationValue, CommonTableValue, CategorizedCheckboxValue, FinderValue, SimpleTableValue, MultiRadioValue, ExistingAnswerMeta, TagsValue } from "../types";
import { parseCoFormFields, generateZodSchema, generateDefaultValues, getStepHasMultiEval, getOriginalFieldKey } from "../utils/formParser";
import { scrollToFieldByName } from "../utils/helpers";
import { cn } from "@/lib/utils";
import { useConditionalFields } from "../hooks/useConditionalFields";
import { useCoFormDraft } from "../hooks/useCoFormDraft";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";
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
  /**
   * Liste de clés d'inputs **complètement masqués** (skip total du rendu).
   * Calculée serveur-side dans `access.restrictedFields` à partir de
   * `placeAdminOnlyFields` / `placeMemberOnlyFields` croisés avec le rôle
   * de l'user sur le lieu. Aligné sur le legacy `isAdminOnly` qui hide
   * entirely (pas de readonly cosmétique).
   */
  restrictedFields?: string[];
  /** ID du formulaire — clé de draft localStorage */
  formId?: string;
  /** ID utilisateur connecté — clé de draft */
  userId?: string | null;
  /** updatedAt serveur (édition) — pour détecter les drafts obsolètes */
  baseUpdatedAt?: number | null;
  /** Active la persistance du draft. Défaut : true. */
  enableDraft?: boolean;
  /**
   * Métadonnées de la réponse existante (créateur + dernier modifieur).
   * Quand fournies, propagées par SmartCoForm depuis la query.
   */
  existingAnswerMeta?: ExistingAnswerMeta | null;
  /**
   * Comment rendre un champ dont le type n'a pas de composant. Défaut :
   * `"error"` — un encadré rouge, parce qu'un type non mappé est un défaut de
   * couverture qu'il ne faut pas taire. `"placeholder"` (bloc neutre) est
   * réservé aux formulaires ouverts au public, cf. `UnsupportedField`.
   */
  unknownFieldVariant?: "error" | "placeholder";
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
  restrictedFields,
  formId,
  userId,
  baseUpdatedAt,
  enableDraft = true,
  existingAnswerMeta,
  unknownFieldVariant = "error",
}: DynamicCoFormProps) {
  const t = useT("modules/coform");
  useLoadNamespace("modules/coform");

  const resolvedSubmitText = submitButtonText ?? t("coform.navigation.submit");

  // Mémoiser pour éviter l'erreur React Compiler "dependency may be modified later"
  const subFormsFields = useMemo(() => parseCoFormFields(formData), [formData]);
  const zodSchema = useMemo(() => generateZodSchema(subFormsFields, t), [subFormsFields, t]);
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
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues,
  });

  // State pour collecter les options ajoutées par champ
  const [addedOptionsMap, setAddedOptionsMap] = useState<AddedOptionsMap>({});

  // Affiche le récap d'erreurs (ErrorSummary) uniquement après une tentative
  // de soumission échouée — évite de polluer la lecture initiale.
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Identifiant du sous-formulaire courant (pour encapsuler les données dans
  // le payload du draft, qui partage le format AllStepsData de MultiStepCoForm).
  const subFormId = subFormsFields[0]?.subFormId ?? "default";

  // Persistance du brouillon en localStorage. Désactivée si conditions non réunies.
  // `answerId` scope la clé par réponse (sinon "new") : sans lui, l'édition de
  // deux réponses du même formulaire partagerait le même slot de brouillon
  // (restauration croisée) et écraserait le brouillon de création.
  const { restorableDraft, staleDraftInfo, saveDraft, discardDraft, purgeDraft, acknowledgeStale } =
    useCoFormDraft({
      formId,
      userId,
      answerId,
      baseUpdatedAt,
      disabled: !enableDraft || autoSubmitOnBlur,
    });

  // Multi-eval radar : un seul Dialog réutilisé pour toutes les steps. Le state
  // mémorise la step ciblée (titre + filtre côté serveur via stepKey). `null`
  // → dialog non monté (cf. norme jdev de mount conditionnel).
  const [multiEvalContext, setMultiEvalContext] = useState<
    { stepKey: string; stepName: string } | null
  >(null);

  // Activity dialog (historique de modifications de la réponse).
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);

  // Map subFormId → display name pour rendre l'historique d'activité lisible
  // (sinon on affiche les clés brutes type `navigatorDesTierslieux1572025_2311_0`).
  const stepNames = useMemo(() => {
    const map: Record<string, string> = {};
    if (formData.inputs) {
      for (const [stepId, stepData] of Object.entries(formData.inputs)) {
        const name = (stepData as { name?: unknown })?.name;
        if (typeof name === "string" && name.trim() !== "") {
          map[stepId] = name;
        }
      }
    }
    return map;
  }, [formData.inputs]);

  const lockedSet = useMemo(() => new Set(lockedFields), [lockedFields]);
  const restrictedSet = useMemo(() => new Set(restrictedFields ?? []), [restrictedFields]);

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
    setHasAttemptedSubmit(false);
    const hasAddedOptions = Object.keys(addedOptionsMap).some(k => addedOptionsMap[k].length > 0);
    await onSubmit(data as SubFormData, hasAddedOptions ? addedOptionsMap : undefined);
    // Succès : purge le draft (le serveur est désormais la source de vérité).
    purgeDraft();
  }, [addedOptionsMap, onSubmit, purgeDraft]);

  const handleRestoreDraft = useCallback(() => {
    if (!restorableDraft) return;
    const restored = restorableDraft.data[subFormId] as Record<string, unknown> | undefined;
    if (restored) {
      // `keepDirty: true` : sans ça, un restore effacerait le draft sans le
      // ré-écrire (l'auto-save est gated par isDirty), et un refresh juste
      // après perdrait les données restaurées.
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

  // Warning navigateur avant fermeture/refresh si modifications non sauvegardées.
  useUnsavedChangesWarning(isDirty);

  // Auto-save du draft à chaque changement de valeur (debounce interne au hook).
  // `formId` et `userId` dans les deps : ils peuvent arriver async (URL / loader),
  // sinon un save précoce partirait avec key=null.
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
    <form onSubmit={handleSubmit(handleFormSubmit, handleInvalid)} className="space-y-6">
      <CoFormBanner formData={formData} hidden={hideBanner} />

      {/* Banner de récupération de draft (s'il y en a un en localStorage).
          Mount conditionnel — pas de surface si rien à restaurer. */}
      {restorableDraft && (
        <DraftRecoveryBanner
          mode="restorable"
          timestamp={restorableDraft.timestamp}
          onRestore={handleRestoreDraft}
          onDiscard={discardDraft}
        />
      )}
      {staleDraftInfo && (
        <DraftRecoveryBanner
          mode="stale"
          timestamp={staleDraftInfo.timestamp}
          onAcknowledge={acknowledgeStale}
        />
      )}

      {subFormsFields.map((subForm) => {
          const fieldsGrid = (
            <div className="grid grid-cols-12 gap-6">
              {subForm.fields.map((field) => {
                if (!isFieldVisible(field.name)) return null;
                // Skip total : l'user n'a pas le droit selon les listes
                // place(Admin|Member)OnlyFields. Calculé serveur-side dans
                // `access.restrictedFields`. Aligné sur le legacy isAdminOnly
                // qui hide entirely (pas de readonly cosmétique).
                if (restrictedSet.has(getOriginalFieldKey(field))) return null;
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

                case "location":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <LocationField
                          field={field}
                          errors={errors}
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
                      control={control}
                      render={({ field: controllerField }) => (
                        <SelectField
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

                case "categorizedCheckbox":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <CategorizedCheckboxField
                          field={field}
                          errors={errors}
                          value={controllerField.value as CategorizedCheckboxValue}
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
                          formId={formData.id}
                          answerId={answerId}
                          subKey={`${subForm.subFormId}.${field.name}`}
                        />
                      )}
                    />
                  );

                case "tags":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <TagsField
                          field={field}
                          errors={errors}
                          value={controllerField.value as TagsValue}
                          onChange={controllerField.onChange}
                          readOnly={isLocked}
                        />
                      )}
                    />
                  );

                case "titleSeparator":
                  return <TitleSeparatorField key={field.name} field={field} />;

                case "timeSlots":
                  return (
                    <Controller
                      key={field.name}
                      name={field.name}
                      control={control}
                      render={({ field: controllerField }) => (
                        <TimeSlotsField
                          field={field}
                          errors={errors}
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
                      control={control}
                      render={({ field: controllerField }) => (
                        <DynamicFieldsField
                          field={field}
                          errors={errors}
                          value={controllerField.value}
                          onChange={controllerField.onChange}
                        />
                      )}
                    />
                  );

                case "sectionTitle":
                  return <SectionTitleField key={field.name} field={field} />;

                case "sectionDescription":
                  return <SectionDescriptionField key={field.name} field={field} />;

                case "milestoneList":
                  return (
                    <MilestoneListField
                      key={field.name}
                      field={field}
                      answerId={answerId}
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

      {/* Récap d'erreurs : affiché seulement après une tentative de submit
          échouée, listant tous les champs invalides avec leur message,
          cliquables pour scroller au champ. */}
      <ErrorSummary
        errors={hasAttemptedSubmit ? errors : {}}
        fields={subFormsFields.flatMap((sf) => sf.fields)}
        onFieldClick={handleErrorFieldClick}
      />

      {/* Lien discret "Voir l'activité" — visible uniquement en mode édition
          d'une réponse existante. Ouvre une modale avec l'historique des
          modifications. */}
      {existingAnswerMeta && answerId && (
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
          answerId={answerId}
          meta={existingAnswerMeta}
          stepNames={stepNames}
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
