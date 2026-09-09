import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { useCoFormQuery, useCoFormFinalMutation } from "../hooks/useCoFormQuery";
import { DynamicCoForm } from "./DynamicCoForm";
import { MultiStepCoForm } from "./MultiStepCoForm";
import { CoFormReadOnly } from "./CoFormReadOnly";
import { CommonTableCatalogsLoader } from "../contexts/CommonTableCatalogsLoader";
import { parseCoFormFields, omitHiddenSteps, normalizeAnswerData, denormalizeAnswerData, extractFinderLinks, collectCommonTableInputKeys } from "../utils/formParser";
import type { CoFormData, SubmitMode, AllStepsData, SubFormData, AddedOptionsMap, ExistingAnswerMeta } from "../types";
import type { FinderLinksMap } from "../utils/formParser";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useCocolightOptional } from "@/hooks/useCocolight";

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
   * Étapes à retirer du parcours pour CET appel — indépendamment de ce que le
   * formulaire déclare. Sert aux règles qui dépendent de l'utilisateur et de
   * l'écran, là où `hideStep` est une propriété du formulaire : sur la fiche
   * d'un commun, l'étape d'évaluation n'est pas proposée à qui n'administre pas
   * l'appel. L'étape sort du parcours, du sommaire, du schéma Zod et des
   * valeurs par défaut.
   */
  hiddenStepKeys?: readonly string[];
  /** updatedAt serveur (édition) — pour détecter les drafts obsolètes. */
  baseUpdatedAt?: number | null;
  /**
   * Métadonnées de la réponse existante (créateur + dernier modifieur).
   * Quand fournies, un lien "Voir l'activité" apparaît sous le form, qui
   * ouvre la modale `AnswerActivityDialog` avec l'historique des modifs.
   */
  existingAnswerMeta?: ExistingAnswerMeta | null;
  /**
   * ID de l'élément lié au form (lieu, projet, événement…). Propagé à
   * `useCoFormQuery` pour activer le mode "par élément" backend
   * (`Coform::getFormAccessInfo` calcule alors `access.restrictedFields`).
   * Entre aussi dans la clé du brouillon (cf. `useCoFormDraft`) : une saisie
   * commencée depuis un élément n'est pas proposée sur un autre.
   * Requis avec `elementType`.
   */
  elementId?: string;
  /** Type de l'élément (collection MongoDB). Requis si `elementId` fourni. */
  elementType?: "organizations" | "projects" | "events" | "poi" | "citoyens";
  /**
   * Comment rendre un champ dont le type n'a pas de composant. Défaut :
   * `"error"`. Cf. `UnsupportedField` — `"placeholder"` est réservé aux
   * formulaires de CRÉATION ouverts au public.
   */
  unknownFieldVariant?: "error" | "placeholder";
}

interface LoadingStateProps {
  message?: string;
}

const LoadingState = ({ message }: LoadingStateProps) => {
  const t = useT("modules/coform");
  const text = message ?? String(t("coform.smart.loading"));
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <Spinner className="h-8 w-8" label={text} />
        <p className="text-muted-foreground">{text}</p>
      </div>
    </div>
  );
};

interface ErrorStateProps {
  error: Error;
  onRetry?: () => void;
}

const ErrorState = ({ error, onRetry }: ErrorStateProps) => {
  const t = useT("modules/coform");
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-destructive">
          <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-destructive font-medium">{String(t("coform.smart.errorTitle"))}</p>
        <p className="text-sm text-muted-foreground max-w-md">{error.message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            {String(t("coform.smart.retry"))}
          </button>
        )}
      </div>
    </div>
  );
};

interface EmptyStateProps {
  message?: string;
}

const EmptyState = ({ message }: EmptyStateProps) => {
  const t = useT("modules/coform");
  return (
    <div className="flex items-center justify-center p-8">
      <p className="text-muted-foreground">{message ?? String(t("coform.smart.emptyMessage"))}</p>
    </div>
  );
};

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
  hiddenStepKeys,
  baseUpdatedAt,
  existingAnswerMeta,
  elementId,
  elementType,
  unknownFieldVariant,
}: SmartCoFormProps) {
  // Charger les données depuis l'API si formId est fourni
  const {
    formData: apiFormData,
    isLoading,
    error,
    refetch,
    // `stepsCount` du hook n'est volontairement PAS consommé : il compte les
    // étapes brutes, donc les étapes masquées. Cf. `actualStepsCount`.
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
  // quelle à DynamicCoForm / MultiStepCoForm qui skippent le rendu.
  const restrictedFields = formData?.access?.restrictedFields;

  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  // Optionnel : `me` ne sert qu'à activer/scoper la persistance du brouillon —
  // sans provider (tests) ou sans user, les drafts sont simplement désactivés.
  const me = useCocolightOptional()?.me;
  // Id de l'user courant : scope la persistance du brouillon ET la contribution
  // multi-eval (read = SA contribution `_multiEval.{id}` ; write = SON entrée).
  const currentUserId = me?.id ?? null;

  // Étapes masquées par l'appelant : on filtre la DONNÉE, une fois, et tout ce
  // qui suit — parse, rendu, sommaire, schéma Zod, valeurs par défaut — en
  // hérite. Filtrer seulement au parse ne suffisait pas : les enfants reparsent
  // le `formData` qu'on leur passe (cf. `omitHiddenSteps`).
  //
  // `hiddenStepKeys` est souvent recréé à chaque rendu par l'appelant : on
  // dépend de son CONTENU, pas de sa référence.
  const hiddenStepsKey = hiddenStepKeys ? hiddenStepKeys.join("|") : "";
  const visibleFormData = useMemo(
    () => (formData ? omitHiddenSteps(formData, hiddenStepKeys) : formData),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- contenu, pas référence
    [formData, hiddenStepsKey]
  );

  const allSubFormsFields = useMemo(
    () => (visibleFormData ? parseCoFormFields(visibleFormData) : []),
    [visibleFormData]
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
  //
  // `hideStep` est neutralisé sur l'étape recopiée : la config du site a
  // réclamé CETTE étape nommément, la masquer rendrait une page vide en
  // silence. Même raisonnement que pour `hideStepStandalone` (cf.
  // `CoFormSubFormInputs`) — `hideStep` retire une étape du PARCOURS, il ne
  // désactive pas une page qui ne porte qu'elle.
  const standaloneFormData = useMemo(() => {
    if (!resolvedStepKey || !formData?.inputs?.[resolvedStepKey]) return null;
    return {
      ...formData,
      inputs: {
        [resolvedStepKey]: { ...formData.inputs[resolvedStepKey], hideStep: false },
      },
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
          // Cf. `standaloneFormData` : le champ est réclamé nommément.
          hideStep: false,
          inputs: { [inputKey]: step.inputs[inputKey] },
        },
      },
      useBannerImg: false,
    } as CoFormData;
  }, [inputKey, resolvedStepKey, formData]);

  const effectiveStandaloneData = inputStandaloneFormData ?? standaloneFormData;

  // Le mode standalone n'applique PAS `hiddenStepKeys` : l'appelant a réclamé
  // cette étape-là explicitement par `stepKey`, la demande explicite l'emporte —
  // même arbitrage que le `hideStep: false` forcé sur l'étape recopiée.
  const subFormsFields = effectiveStandaloneData
    ? parseCoFormFields(effectiveStandaloneData)
    : allSubFormsFields;

  // Identifie les inputs commonTable du form pour fetcher leurs catalogues
  // collaboratifs en un seul appel batch. Si le form n'en contient aucun,
  // `inputKeys` est vide → le loader ne fait aucun appel réseau.
  const commonTableInputKeys = useMemo(
    () => collectCommonTableInputKeys(subFormsFields),
    [subFormsFields]
  );

  // Wrapper qui expose les catalogues commonTable aux fields. Le loader rend un
  // provider vide s'il n'y a pas de commonTable → no-op pur. Il est PARTAGÉ avec
  // les surfaces qui montent `CoFormReadOnly` sans passer par ici.
  const withCatalogs = (node: ReactNode) => (
    <CommonTableCatalogsLoader formId={formId} inputKeys={commonTableInputKeys}>
      {node}
    </CommonTableCatalogsLoader>
  );

  // Normaliser les defaultValues pour les champs stockés à la racine (comme evaluation)
  const normalizedDefaults = useMemo(
    () => normalizeAnswerData(defaultValues as Record<string, unknown> | undefined, subFormsFields, currentUserId),
    [defaultValues, subFormsFields, currentUserId]
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

  // Compte des étapes RÉELLEMENT rendues. `stepsCount` (comme le décompte brut
  // de `externalFormData.inputs`) part de `formData.inputs`, donc AVANT le
  // filtre `hideStep` : un formulaire à deux étapes dont une masquée franchirait
  // encore `multiStepThreshold` et afficherait tout le chrome du wizard pour une
  // étape unique. On dérive donc du parse, seule source qui connaît le filtre.
  const actualStepsCount = allSubFormsFields.length;

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
  // `formData` est narrowé non-null par la garde ci-dessus (l.367) ; le memo,
  // lui, est déclaré avant elle. On retombe donc explicitement sur `formData`
  // plutôt que de poser une assertion.
  const effectiveFormData = effectiveStandaloneData ?? visibleFormData ?? formData;
  const isStandalone = !!standaloneFormData;
  const isInputStandalone = !!inputStandaloneFormData;

  // Persistance du draft : désactivée en lecture seule, en standalone
  // (sous-composant embarqué), ou sans utilisateur identifié (la clé
  // localStorage est user-scopée, pour éviter les fuites cross-user).
  //
  // ACTIVÉE EN MODALE. Elle en était exclue au motif d'un « contexte
  // éphémère » — or c'est justement le contexte où un brouillon sert le plus :
  // fermer une modale par erreur perdait toute la saisie. Le vrai obstacle
  // était ailleurs : l'écriture est debouncée à 500 ms et le démontage
  // l'annulait au lieu de la vider, ce qui rendait le brouillon inexploitable
  // là où le démontage est le cas nominal. Corrigé dans `useCoFormDraft`
  // (flush au démontage + à la sortie d'onglet).
  // ACTIVÉE AUSSI SUR UNE ÉTAPE SEULE. Elle en était exclue (`!isStandalone`)
  // parce que la clé de brouillon ignorait le périmètre : un brouillon écrit sur
  // une étape extraite, restauré dans le parcours complet, aurait remplacé
  // `stepsData` par cette seule étape. Or c'est exactement la forme du dépôt d'un
  // commun — bouton « Déposer », une étape, une modale — donc le cas où fermer
  // par erreur coûte le plus cher. La clé porte désormais le périmètre
  // (`draftScope`, cf. `useCoFormDraft`), la restauration croisée est impossible,
  // et l'exclusion n'a plus lieu d'être.
  //
  // `isInputStandalone` reste exclu : ce mode soumet au blur
  // (`autoSubmitOnBlur`), un brouillon n'y a rien à sauver.
  const enableDraft = !readOnly && !isInputStandalone && !!formId && !!me?.id;
  const draftUserId = currentUserId;
  // Vide pour le parcours complet — la clé reste alors celle d'avant, et les
  // brouillons déjà enregistrés continuent d'être retrouvés.
  // `resolvedStepKey` et non `stepKey` brut : c'est lui qui construit
  // `standaloneFormData`, donc lui qui décrit ce qui est réellement rendu. Les deux
  // ne divergent aujourd'hui que sur la branche `inputKey` seul, où le brouillon
  // est de toute façon coupé — s'appuyer là-dessus serait un accident.
  const draftScope = isStandalone ? (resolvedStepKey ?? null) : null;

  // Mode lecture seule : utiliser CoFormReadOnly
  if (readOnly) {
    return withCatalogs(
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

  // Afficher le composant approprié
  if (shouldUseMultiStep) {
    return withCatalogs(
      <MultiStepCoForm
        formData={effectiveFormData}
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
        draftScope={draftScope}
        elementId={elementId}
        elementType={elementType}
        userId={draftUserId}
        baseUpdatedAt={baseUpdatedAt}
        enableDraft={enableDraft}
        existingAnswerMeta={existingAnswerMeta}
        unknownFieldVariant={unknownFieldVariant}
      />
    );
  }

  // Rendu : formulaire simple (1 seule étape ou standalone)
  //
  // Clé de l'étape PARSÉE, pas `Object.keys(inputs)[0]` : c'est celle que
  // `DynamicCoForm` utilise (`subFormsFields[0].subFormId`), donc la seule sous
  // laquelle ses `defaultValues` et sa saisie ont un sens. Les deux divergent
  // dès que la première étape déclarée est masquée (`hideStep`) : le parse ne
  // garde que la suivante, on tombe en mode simple — et on lisait les défauts
  // de l'étape masquée puis on renvoyait la saisie sous SA clé, l'étape rendue
  // repartant vide.
  const subFormId = subFormsFields[0]?.subFormId ?? "default";

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
      draftScope={draftScope}
      elementId={elementId}
      elementType={elementType}
      userId={draftUserId}
      baseUpdatedAt={baseUpdatedAt}
      enableDraft={enableDraft}
      existingAnswerMeta={existingAnswerMeta}
      unknownFieldVariant={unknownFieldVariant}
      onSubmit={async (data, addedOptions) => {
        try {
          // Dénormaliser pour le format PHP (champs root-level à la racine)
          const rawData = { [subFormId]: data } as Record<string, unknown>;
          const dataForServer = denormalizeAnswerData(rawData, subFormsFields, currentUserId) as AllStepsData;
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
