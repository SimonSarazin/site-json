import { useMemo } from "react";
import { useCoFormQuery } from "../hooks/useCoFormQuery";
import { DynamicCoForm } from "./DynamicCoForm";
import { MultiStepCoForm } from "./MultiStepCoForm";
import { parseCoFormFields, normalizeAnswerData, denormalizeAnswerData, extractFinderLinks } from "../utils/formParser";
import type { CoFormData, SubmitMode, AllStepsData, SubFormData, AddedOptionsMap } from "../types";
import type { FinderLinksMap } from "../utils/formParser";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";

interface SmartCoFormProps {
  formId?: string;
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
}: SmartCoFormProps) {
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
  });

  // Utiliser les données externes ou celles de l'API
  const formData = externalFormData ?? apiFormData;

  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  const subFormsFields = useMemo(
    () => (formData ? parseCoFormFields(formData) : []),
    [formData]
  );

  // Normaliser les defaultValues pour les champs stockés à la racine (comme evaluation)
  const normalizedDefaults = useMemo(
    () => normalizeAnswerData(defaultValues as Record<string, unknown> | undefined, subFormsFields),
    [defaultValues, subFormsFields]
  ) as AllStepsData | undefined;

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
      selected: shouldUseMultiStep ? "MultiStepCoForm" : "DynamicCoForm",
    });
  }

  // Afficher le composant approprié
  if (shouldUseMultiStep) {
    return (
      <MultiStepCoForm
        formData={formData}
        submitMode={submitMode}
        onStepSubmit={onStepSubmit}
        onFinalSubmit={onFinalSubmit}
        className={className}
        showProgress={showProgress}
        showStepNumbers={showStepNumbers}
        defaultValues={normalizedDefaults}
        answerId={answerId}
      />
    );
  }

  // Rendu : formulaire simple (1 seule étape)
  const subFormIds = Object.keys(formData.inputs || {});
  const subFormId = subFormIds[0] || "default";

  // Extraire les valeurs par défaut pour cette étape
  const stepDefaults = normalizedDefaults?.[subFormId];

  return (
    <DynamicCoForm
      formData={formData}
      submitButtonText={t("coform.navigation.submit")}
      defaultValues={stepDefaults}
      answerId={answerId}
      onSubmit={async (data, addedOptions) => {
        try {
          if (onFinalSubmit) {
            // Dénormaliser pour le format PHP (champs root-level à la racine)
            const rawData = { [subFormId]: data } as Record<string, unknown>;
            const dataForServer = denormalizeAnswerData(rawData, subFormsFields) as AllStepsData;
            
            // Extraire les links des champs Finder (avant dénormalisation)
            const links = extractFinderLinks(rawData, subFormsFields);
            
            // Formater addedOptions pour le format attendu { subFormId: {...} }
            const formattedAddedOptions = addedOptions ? { [subFormId]: addedOptions } : undefined;
            
            await onFinalSubmit(
              dataForServer, 
              formattedAddedOptions,
              Object.keys(links).length > 0 ? links : undefined
            );
          }
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }}
    />
  );
}

export default SmartCoForm;
