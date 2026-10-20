import { type ComponentProps, useMemo, useState } from "react";
import { useLocalization } from "@/hooks/useLocalization";
import { useDebounce } from "@/hooks/useDebounce";
import { useDeleteCommun } from "./useDeleteCommun";
import { useCommunDeletionPlan } from "./useCommunDeletionPlan";
import { useAacDirectoryContext } from "./useAacDirectoryContext";
import { useAacCommuns } from "./useAacCommuns";
import { useAacFacets } from "./useAacFacets";
import { EMPTY_AAC_FILTERS, type AacDirectoryFiltersState } from "../lib/filtersKey";
import { resolveDirectoryFilters } from "../lib/directoryFilters";
import { resolveAacDepositStepKey } from "../lib/depositStep";
import { readUsageLabels } from "../lib/aacUsage";
import type { AacDirectorySectionProps, AacDisplayMode } from "../schema";
import type { AacCommunCard as CommunCard } from "../lib/parseAacAnswer";
import type { AacDirectoryFilters } from "../components/directory/AacDirectoryFilters";
import type { AacDirectoryResults } from "../components/directory/AacDirectoryResults";
import type { AacDepositButton } from "../components/directory/AacDepositButton";
import type { CommunDeleteDialog } from "../components/pageDetail/CommunDeleteDialog";

/** Le texte saisi n'entre dans la query key qu'après cette pause. */
const SEARCH_DEBOUNCE_MS = 350;

/** Sentinelle inerte : l'aperçu ne défile pas, mais la prop reste requise. */
const NOOP_REF = () => {};

/**
 * View-model de l'annuaire : toute la logique, aucune mise en page. Une coquille
 * (`AAC_DIRECTORY_SHELL_VARIANTS`) n'en est qu'une vue ; paquets prêts à épandre,
 * blocs `| null` pour ce qui peut manquer.
 */
export interface AacDirectoryReadyVM {
  status: "ready";
  /** `full` : l'annuaire complet ; `preview` : une vitrine, sans aucune commande. */
  mode: "full" | "preview";
  className?: string;
  /** `null` : ni titre, ni description, ni bouton de dépôt. */
  header: {
    title: string | null;
    description: string | null;
    deposit: ComponentProps<typeof AacDepositButton> | null;
  } | null;
  /** État, options et filtres activés (fusionnés avec les défauts) ; inutilisé en `preview`. */
  filters: ComponentProps<typeof AacDirectoryFilters>;
  /** Nombre total de communs de l'appel, pas seulement ceux chargés. */
  count: number;
  /** Mode de lecture choisi par le visiteur. */
  display: { value: AacDisplayMode; onChange: (value: AacDisplayMode) => void };
  /** Résultats avec erreur, reprise, défilement infini et suppression par item câblés. */
  results: ComponentProps<typeof AacDirectoryResults>;
  moreLink: { href: string; label: string | null } | null;
  /** Dialogue de suppression, rendu par la section hors de toute coquille. */
  deletion: ComponentProps<typeof CommunDeleteDialog>;
}

export type AacDirectoryVM =
  | ({ status: "no-form"; className?: string } & AacDirectoryBaseVM)
  | (AacDirectoryReadyVM & AacDirectoryBaseVM);

/** Ce que porte l'annuaire dans tous ses états. */
export interface AacDirectoryBaseVM {
  /** Coquille : prop de section, sinon `config.aac.directory.defaultShellVariant`. */
  shellVariant?: string;
}

export function useAacDirectoryController(props: AacDirectorySectionProps): AacDirectoryVM {
  const { t: localize } = useLocalization();

  const {
    title,
    description,
    className,
    display: initialDisplay = "grid",
    columns = 3,
    pageSize = 12,
    filters: filtersConfig,
    emptyText,
    showDepositButton = true,
    depositButtonLabel,
    variant = "full",
    moreLink,
    cardVariant,
    shellVariant,
  } = props;

  const isPreview = variant === "preview";

  // Fusion clé par clé : la config n'est pas parsée par Zod à l'exécution, un bloc partiel arrive tel quel.
  const enabledFilters = resolveDirectoryFilters(filtersConfig);

  const [filters, setFilters] = useState<AacDirectoryFiltersState>(EMPTY_AAC_FILTERS);
  const debouncedQuery = useDebounce(filters.q, SEARCH_DEBOUNCE_MS);

  // Mode initial fixé par la config ; non persisté, pour rester conforme au HTML SSR.
  const [display, setDisplay] = useState<AacDisplayMode>(initialDisplay);

  const {
    formId,
    config,
    form,
    fields: cardFields,
    resolved,
    contextId,
    formParams,
    visibility,
    api,
    permissions,
    baseUrl,
    isFormLoading,
    configError,
    refetchConfig,
    variants,
  } = useAacDirectoryContext();

  // Étape de dépôt : celle qui porte le titre, sinon la première déclarée.
  const depositStepKey = resolveAacDepositStepKey(resolved?.fields, config);

  // Facettes sur le jeu non filtré ; aucune en aperçu (évite le balayage).
  const { usageTree, tagOptions, communeOptions, isLoading: isFacetsLoading } = useAacFacets({
    formId,
    form,
    fields: cardFields,
    formParams,
    contextId,
    baseUrl,
    visibility,
    enabled: !isPreview,
  });

  const {
    communs,
    totalCount,
    isLoading,
    isPending,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    lastItemRef,
    error,
    refetch,
  } = useAacCommuns({
    formId,
    form,
    // N'attend pas le formulaire : `parseAacAnswer` se replie sur les champs pré-calculés du backend.
    fields: cardFields,
    // Seule la recherche est debouncée.
    filters: { ...filters, q: debouncedQuery },
    pageSize,
    contextId,
    baseUrl,
    visibility,
  });

  // Requête désactivée tant que `form` n'est pas résolu (`pending` sans `fetching`) :
  // `isPending` ne compte que pendant la résolution, sinon le squelette serait perpétuel.
  const isAwaitingResults = isLoading || (isPending && isFormLoading);

  // Sans formulaire le listing ne part pas : l'échec de résolution s'affiche comme une erreur des résultats.
  const resultsError = error ?? configError;

  // Reprise : la résolution du formulaire, sinon la page suivante en échec, sinon tout le listing.
  const retry = () => {
    if (configError) {
      refetchConfig();
      return;
    }
    void (isFetchNextPageError ? fetchNextPage() : refetch());
  };

  // Suppression : cible, confirmation et mutation uniques pour l'annuaire (parité `configSearchObj.js:106-137`).
  const [toDelete, setToDelete] = useState<CommunCard | null>(null);

  // Plan du commun ciblé, résolu à l'ouverture du dialogue.
  const { plan, isLoading: isPlanLoading } = useCommunDeletionPlan(
    toDelete?.id ?? null,
    config?.roles.depenseStepKey ?? undefined,
  );

  const suppression = useDeleteCommun({ api });

  const confirmerSuppression = (withProject: boolean) => {
    if (!toDelete) return;
    suppression.mutate(
      {
        answerId: toDelete.id,
        withProject,
        projectId: plan.projectId,
        actionIds: plan.actionIds,
      },
      { onSuccess: () => setToDelete(null) }
    );
  };

  // Libellés exacts des usages, pour les interfaces qui les affichent.
  const usageLabels = useMemo(() => readUsageLabels(formParams), [formParams]);

  // Pas de suppression en aperçu.
  const canDeleteCommun = isPreview ? undefined : permissions.canDeleteCommun;

  const base: AacDirectoryBaseVM = {
    // La prop de section prime sur le défaut du site.
    shellVariant: shellVariant ?? variants.directoryShell,
  };

  if (!formId) return { status: "no-form", className, ...base };

  const sharedResults = {
    communs,
    display,
    columns,
    isLoading: isAwaitingResults,
    error: resultsError,
    onRetry: retry,
    isRetrying: isFetching || isFormLoading,
    emptyText: emptyText ? localize(emptyText) : undefined,
    itemVariant: cardVariant ?? variants.directoryCard,
    usageLabels,
  };

  return {
    status: "ready",
    ...base,
    deletion: {
      open: toDelete !== null,
      onOpenChange: (open) => {
        // La cible est gardée tant que la suppression est en vol.
        if (!open && !suppression.isPending) setToDelete(null);
      },
      // `null` sans titre renseigné (le backend pose « (No title) »).
      communTitle: toDelete?.hasTitle ? toDelete.title : null,
      plan,
      isPlanLoading,
      isPending: suppression.isPending,
      onConfirm: confirmerSuppression,
    },
    mode: isPreview ? "preview" : "full",
    className,
    // En-tête dès qu'un titre, une description ou le bouton de dépôt est présent.
    header:
      title || description || showDepositButton
        ? {
            title: title ? localize(title) : null,
            description: description ? localize(description) : null,
            deposit: showDepositButton
              ? {
                  formId,
                  stepKey: depositStepKey,
                  label: depositButtonLabel ? localize(depositButtonLabel) : undefined,
                }
              : null,
          }
        : null,
    filters: {
      filters,
      onChange: setFilters,
      usageTree,
      tagOptions,
      communeOptions,
      maturityField: resolved?.fields.maturity ?? null,
      enabled: enabledFilters,
      isLoading: isFormLoading || isFacetsLoading,
    },
    count: totalCount,
    display: { value: display, onChange: setDisplay },
    // Aperçu : ni défilement infini, ni suppression.
    results: isPreview
      ? { ...sharedResults, isFetchingNextPage: false, hasNextPage: false, lastItemRef: NOOP_REF }
      : {
          ...sharedResults,
          isFetchingNextPage,
          hasNextPage,
          lastItemRef,
          canDeleteCommun,
          onRequestDelete: setToDelete,
          isDeleting: suppression.isPending,
        },
    moreLink: moreLink
      ? { href: moreLink.href, label: moreLink.label ? localize(moreLink.label) : null }
      : null,
  };
}
