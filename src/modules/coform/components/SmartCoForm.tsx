import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { useCoFormQuery, useCoFormFinalMutation, useCoFormCatalogs } from "../hooks/useCoFormQuery";
import { DynamicCoForm } from "./DynamicCoForm";
import { MultiStepCoForm } from "./MultiStepCoForm";
import { CoFormReadOnly } from "./CoFormReadOnly";
import { parseCoFormFields, normalizeAnswerData, denormalizeAnswerData, extractFinderLinks, getOriginalFieldKey } from "../utils/formParser";
import { CommonTableCatalogsProvider } from "../contexts/CommonTableCatalogsProvider";
import type { CoFormData, SubmitMode, AllStepsData, SubFormData, AddedOptionsMap, ExistingAnswerMeta } from "../types";
import type { FinderLinksMap } from "../utils/formParser";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";

interface SmartCoFormProps {
  formId?: string;
  /** updatedAt serveur de la réponse (édition) — transmis au système de draft pour détecter l'obsolescence */
  baseUpdatedAt?: number | null;
  formData?: CoFormData;
  submitMode?: SubmitMode;
  forceMultiStep?: boolean;
  forceSingleStep?: boolean;
  multiStepThreshold?: number;
  onStepSubmit?: (subFormId: string, data: SubFormData, stepIndex: number) => Promise<void>;
  onFinalSubmit?: (
    allData: AllStepsData, 
    addedOptions?: Record<string, AddedOptionsMap>,
    links?: FinderLinksMap
  ) => Promise<void>;
  onError?: (error: Error) => void;
  className?: string;
  showProgress?: boolean;
  showStepNumbers?: boolean;
  /** Valeurs par défaut pour pré-remplir le formulaire (mode édition / résumé) */
  defaultValues?: AllStepsData;
  /** ID de la réponse en cours d'édition (pour le chargement des fichiers legacy) */
  answerId?: string;
  /**
   * Clé (subFormId) d'une étape à afficher en mode standalone.
   * Si fourni, seule cette étape est rendue (mode single-step), la navigation
   * multi-step et la bannière sont masquées.
   */
  stepKey?: string;
  /**
   * Callback exécuté après une soumission réussie (ex: toast, fermer une modale).
   * La soumission des données passe toujours par onFinalSubmit.
   */
  onAfterSubmit?: () => void | Promise<void>;
  /**
   * Clé d'un champ à afficher en mode input standalone.
   * Requiert `stepKey`. Seul ce champ est rendu, sans titre d'étape ni bouton submit.
   * La soumission se fait automatiquement au blur quand la valeur change.
   */
  inputKey?: string;
  /** Mode lecture seule (affiche les valeurs sans possibilité d'édition) */
  readOnly?: boolean;
  /**
   * En mode multi-step normal, clé (subFormId) de l'étape initiale.
   * Permet de démarrer le wizard directement sur une étape spécifique.
   */
  initialStepKey?: string;
  /** Appelé quand l'état "modifié" change (utilisable par CoFormModal) */
  onDirtyChange?: (isDirty: boolean) => void;
  /** Ref vers la fonction de soumission programmatique */
  submitRef?: React.RefObject<(() => void) | null>;
  /** Liste de clés d'inputs verrouillés (lecture seule, non modifiables) */
  lockedFields?: string[];
  /**
   * Vrai quand le formulaire est rendu dans un modal (CoFormModal).
   * Désactive complètement la persistance de draft (pas d'écriture en
   * localStorage, pas de bannière de récupération) — le contexte modal est
   * éphémère et la perte accidentelle est gérée par le `onDirtyChange`.
   */
  inModal?: boolean;
  /**
   * Métadonnées de la réponse existante (créateur + dernier modifieur) pour
   * activer le lien "Voir l'activité" en bas du form. Propagé tel quel à
   * `DynamicCoForm`. Ignoré si `answerId` est absent (création).
   */
  existingAnswerMeta?: ExistingAnswerMeta | null;
  /**
   * Mode "par élément" : si fourni, le hook de fetch passe ces deux IDs au
   * backend pour activer la résolution `getFormAccessInfo` en mode
   * "réponse partagée par lieu". Nécessaire notamment pour que
   * `access.restrictedFields` (placeAdminOnlyFields / placeMemberOnlyFields)
   * soit calculé : le backend a besoin de savoir quel lieu est lié pour
   * vérifier la membership user↔lieu.
   */
  elementId?: string;
  elementType?: "organizations" | "projects" | "events" | "poi" | "citoyens";
}

interface LoadingStateProps {
  message?: string;
}

const LoadingState = ({ message = "Chargement du formulaire..." }: LoadingStateProps) => (
  <div className="flex items-center justify-center p-8">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  </div>
);

interface ErrorStateProps {
  error: Error;
  onRetry?: () => void;
}

const ErrorState = ({ error, onRetry }: ErrorStateProps) => (
  <div className="flex items-center justify-center p-8">
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="text-destructive">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className="text-destructive font-medium">Erreur de chargement</p>
      <p className="text-sm text-muted-foreground max-w-md">{error.message}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Réessayer
        </button>
      )}
    </div>
  </div>
);

interface EmptyStateProps {
  message?: string;
}

const EmptyState = ({ message = "Aucun formulaire trouvé" }: EmptyStateProps) => (
  <div className="flex items-center justify-center p-8">
    <p className="text-muted-foreground">{message}</p>
  </div>
);

/**
 * SmartCoForm - Composant intelligent qui choisit automatiquement
 * entre DynamicCoForm (single-step) et MultiStepCoForm (multi-step)
 * selon le nombre d'étapes dans le formulaire.
 * 
 * Logique de sélection :
 * - 1 étape (subForms) → DynamicCoForm (tout sur une page)
 * - 2+ étapes (subForms) → MultiStepCoForm (wizard avec navigation)
 * 
 * Peut charger le formulaire depuis l'API ou recevoir les données directement.
 */
export function SmartCoForm({
  formId,
  formData: externalFormData,
  submitMode = "final",
  forceMultiStep = false,
  forceSingleStep = false,
  multiStepThreshold = 2,
  onStepSubmit,
  onFinalSubmit,
  onError,
  className = "",
  showProgress = true,
  showStepNumbers = true,
  defaultValues,
  answerId,
  stepKey,
  onAfterSubmit,
  inputKey,
  readOnly = false,
  initialStepKey,
  onDirtyChange,
  submitRef,
  lockedFields,
  baseUpdatedAt,
  inModal = false,
  existingAnswerMeta,
  elementId,
  elementType,
}: SmartCoFormProps) {
  const { me } = useCocolight();
  // Charger les données depuis l'API si formId est fourni
  const {
    formData: apiFormData,
    isLoading,
    error,
    refetch,
    stepsCount,
  } = useCoFormQuery({
    formId: formId ?? "",
    enabled: !!formId && !externalFormData,
    elementId,
    elementType,
  });

  // Utiliser les données externes ou celles de l'API
  const formData = externalFormData ?? apiFormData;

  // Restriction par rôle dans le lieu lié (placeAdminOnlyFields /
  // placeMemberOnlyFields). Le serveur calcule la liste finale dans
  // `access.restrictedFields` selon l'user courant ; on la propage telle
  // quelle à DynamicCoForm/MultiStepCoForm qui skip le rendu.
  const restrictedFields = formData?.access?.restrictedFields;

  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  const allSubFormsFields = useMemo(
    () => (formData ? parseCoFormFields(formData) : []),
    [formData]
  );

  // Auto-résolution du stepKey à partir de l'inputKey si stepKey n'est pas fourni
  const resolvedStepKey = useMemo(() => {
    if (stepKey) return stepKey;
    if (!inputKey || !formData?.inputs) return undefined;
    for (const [key, step] of Object.entries(formData.inputs)) {
      if (step?.inputs?.[inputKey]) return key;
    }
    return undefined;
  }, [stepKey, inputKey, formData]);

  // Mode standalone : fabriquer un formData filtré à une seule étape
  const standaloneFormData = useMemo(() => {
    if (!resolvedStepKey || !formData?.inputs?.[resolvedStepKey]) return null;
    return {
      ...formData,
      inputs: { [resolvedStepKey]: formData.inputs[resolvedStepKey] },
      // Pas de bannière en standalone
      useBannerImg: false,
    } as CoFormData;
  }, [resolvedStepKey, formData]);

  // Mode input standalone : fabriquer un formData filtré à un seul champ
  const inputStandaloneFormData = useMemo(() => {
    if (!inputKey || !resolvedStepKey || !formData?.inputs?.[resolvedStepKey]?.inputs?.[inputKey]) return null;
    const step = formData.inputs[resolvedStepKey];
    return {
      ...formData,
      inputs: {
        [resolvedStepKey]: {
          ...step,
          inputs: { [inputKey]: step.inputs[inputKey] },
        },
      },
      useBannerImg: false,
    } as CoFormData;
  }, [inputKey, resolvedStepKey, formData]);

  const effectiveStandaloneData = inputStandaloneFormData ?? standaloneFormData;

  const subFormsFields = effectiveStandaloneData
    ? parseCoFormFields(effectiveStandaloneData)
    : allSubFormsFields;

  // Identifie les inputs commonTable du form pour fetcher leurs catalogues
  // collaboratifs en un seul appel batch. Si le form n'en contient aucun,
  // `inputKeys` est vide → le hook ne fait aucun appel réseau (enabled=false).
  const commonTableInputKeys = useMemo(() => {
    const keys: string[] = [];
    for (const sf of subFormsFields) {
      for (const f of sf.fields) {
        if (f.componentType === "commonTable") {
          keys.push(getOriginalFieldKey(f));
        }
      }
    }
    return keys;
  }, [subFormsFields]);

  const { catalogs: commonTableCatalogs } = useCoFormCatalogs({
    formId: formId ?? "",
    inputKeys: commonTableInputKeys,
    enabled: !!formId && commonTableInputKeys.length > 0,
  });

  // Normaliser les defaultValues pour les champs stockés à la racine (comme evaluation)
  // ainsi que pour les inputs multi-eval (radioNew + activeMultieval=true) :
  // on extrait la valeur de l'user courant depuis `_multiEval.{userId}` pour
  // pré-remplir le RadioField, en gardant les autres users dans la sous-clé.
  const userId = me?.id ?? null;
  const normalizedDefaults = useMemo(
    () => normalizeAnswerData(defaultValues as Record<string, unknown> | undefined, subFormsFields, userId),
    [defaultValues, subFormsFields, userId]
  ) as AllStepsData | undefined;

  // Mutation interne : utilisée quand aucun onFinalSubmit externe n'est fourni
  const internalMutation = useCoFormFinalMutation({
    formId: formId ?? "",
    answerId: answerId ?? null,
    onError: (err) => {
      toast.error(err.message);
      onError?.(err);
    },
  });

  // Gérer les états de chargement et d'erreur
  if (!externalFormData && formId) {
    if (isLoading) {
      return <LoadingState />;
    }

    if (error) {
      onError?.(error);
      return <ErrorState error={error} onRetry={refetch} />;
    }
  }

  // Pas de données
  if (!formData) {
    return <EmptyState />;
  }

  const actualStepsCount = externalFormData
    ? Object.keys(externalFormData.inputs || {}).length
    : stepsCount;

  // Déterminer le mode à utiliser
  const shouldUseMultiStep = (() => {
    // Mode standalone = toujours single-step
    if (standaloneFormData) return false;

    // Forcer single-step (priorité haute)
    if (forceSingleStep) return false;
    
    // Forcer multi-step
    if (forceMultiStep) return true;
    
    // Décision automatique basée sur le seuil
    return actualStepsCount >= multiStepThreshold;
  })();

  if (import.meta.env.DEV) {
    console.log("[SmartCoForm] Mode sélectionné:", {
      stepsCount: actualStepsCount,
      threshold: multiStepThreshold,
      forceMultiStep,
      forceSingleStep,
      stepKey,
      initialStepKey,
      onAfterSubmit: !!onAfterSubmit,
      selected: standaloneFormData
        ? "DynamicCoForm (standalone)"
        : shouldUseMultiStep
          ? "MultiStepCoForm"
          : "DynamicCoForm",
    });
  }

  // Données effectives (filtrées si standalone)
  const effectiveFormData = effectiveStandaloneData ?? formData;
  const isStandalone = !!standaloneFormData;
  const isInputStandalone = !!inputStandaloneFormData;

  // Persistance du draft : désactivée en mode lecture seule, standalone (sous-composant
  // embarqué), modal (contexte éphémère), ou auto-submit (le serveur est la source
  // de vérité à chaque blur).
  const enableDraft =
    !readOnly &&
    !inModal &&
    !isStandalone &&
    !isInputStandalone &&
    !!formId &&
    !!me?.id;

  // Mode lecture seule : utiliser CoFormReadOnly
  if (readOnly) {
    return (
      <CoFormReadOnly
        formData={effectiveFormData}
        answerData={normalizedDefaults ?? {}}
        answerId={answerId}
        hideBanner={isStandalone}
        hideStepHeaders={isInputStandalone}
        hideMetadata
      />
    );
  }

  // Wrapper qui expose les catalogues commonTable aux fields. Le provider
  // accepte un objet vide → si pas de commonTable, c'est un no-op pur.
  const withCatalogs = (node: ReactNode) => (
    <CommonTableCatalogsProvider catalogs={commonTableCatalogs}>{node}</CommonTableCatalogsProvider>
  );

  // Afficher le composant approprié
  if (shouldUseMultiStep) {
    return withCatalogs(
      <MultiStepCoForm
        formData={formData}
        submitMode={submitMode}
        onStepSubmit={onStepSubmit}
        onFinalSubmit={
          onFinalSubmit
            ? (data: AllStepsData) => onFinalSubmit(data)
            : async (data: AllStepsData) => {
                await internalMutation.mutateAsync({ allData: data });
              }
        }
        onSuccess={onAfterSubmit}
        onDirtyChange={onDirtyChange}
        lockedFields={lockedFields}
        restrictedFields={restrictedFields}
        className={className}
        showProgress={showProgress}
        showStepNumbers={showStepNumbers}
        defaultValues={normalizedDefaults}
        answerId={answerId}
        initialStepKey={initialStepKey}
        formId={formId}
        userId={userId}
        baseUpdatedAt={baseUpdatedAt}
        enableDraft={enableDraft}
        existingAnswerMeta={existingAnswerMeta}
      />
    );
  }

  // Rendu : formulaire simple (1 seule étape ou standalone)
  const subFormIds = Object.keys(effectiveFormData.inputs || {});
  const subFormId = subFormIds[0] || "default";

  // Extraire les valeurs par défaut pour cette étape
  const stepDefaults = normalizedDefaults?.[subFormId];

  return withCatalogs(
    <DynamicCoForm
      formData={effectiveFormData}
      submitButtonText={t("coform.navigation.submit")}
      defaultValues={stepDefaults}
      answerId={answerId}
      hideBanner={isStandalone}
      hideStepHeaders={isInputStandalone}
      hideSubmitButton={isInputStandalone}
      autoSubmitOnBlur={isInputStandalone}
      onDirtyChange={onDirtyChange}
      submitRef={submitRef}
      lockedFields={lockedFields}
      restrictedFields={restrictedFields}
      formId={formId}
      userId={userId}
      baseUpdatedAt={baseUpdatedAt}
      enableDraft={enableDraft}
      existingAnswerMeta={existingAnswerMeta}
      onSubmit={async (data, addedOptions) => {
        try {
          // Dénormaliser pour le format PHP (champs root-level à la racine).
          // Le userId courant est requis pour les inputs multi-eval — il est
          // injecté dans `_multiEval.{userId}` au format `{value, date, answer}`.
          const rawData = { [subFormId]: data } as Record<string, unknown>;
          // `defaultValues` est le payload serveur original (avant normalize).
          // Il sert à `denormalizeAnswerData` pour décider si un commonTable
          // vide doit être envoyé (clear) ou omis (jamais rempli).
          const dataForServer = denormalizeAnswerData(
            rawData,
            subFormsFields,
            userId,
            (defaultValues as Record<string, unknown> | undefined) ?? null,
          ) as AllStepsData;
          const links = extractFinderLinks(rawData, subFormsFields);
          const formattedAddedOptions = addedOptions ? { [subFormId]: addedOptions } : undefined;
          const linksOrUndef = Object.keys(links).length > 0 ? links : undefined;

          // Soumettre les données (onFinalSubmit externe ou mutation interne)
          if (onFinalSubmit) {
            await onFinalSubmit(dataForServer, formattedAddedOptions, linksOrUndef);
          } else {
            await internalMutation.mutateAsync({ allData: dataForServer, addedOptions: formattedAddedOptions, links: linksOrUndef });
          }

          // Callback post-soumission (ex: toast, fermer modale)
          if (onAfterSubmit) {
            await onAfterSubmit();
          }
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }}
    />
  );
}

export default SmartCoForm;
