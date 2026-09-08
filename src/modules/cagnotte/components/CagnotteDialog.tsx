import {useState, useEffect, useRef, useMemo, useCallback, Suspense} from "react";
import {lazy} from "vite-preload";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {PiggyBank, Heart, Anchor} from "lucide-react";
import {showErrorToast, showSuccessToast} from "@/lib/toastUtils";
import {useT} from "@/hooks/useT";
import {useLoadNamespace} from "@/hooks/useLoadNamespace";
import "@/modules/cagnotte/i18n";
import {CAGNOTTE_QUERY_KEYS} from "@/modules/cagnotte/constants/queryKeys";
import {useCocolight} from "@/hooks/useCocolight";
import {useQueryClient} from "@tanstack/react-query";
import {ClientOnly} from "@/components/layout/ClientOnly";
// Lazy-load : `PaymentConfigPage` tire `@stripe/stripe-js` + `@stripe/react-stripe-js`
// par chaîne d'imports statique. En lazy, Stripe loader n'est plus dans le bundle
// initial — il est téléchargé uniquement quand l'utilisateur déclenche
// `showPaymentConfig` (clic sur "Contribuer").
const PaymentConfigPage = lazy(() => import("./PaymentConfigPage"));
import {CagnotteAmountPicker} from "./parts/CagnotteAmountPicker";
import {CagnotteResourceSelector} from "./parts/CagnotteResourceSelector.tsx";
import {PledgeFundingToast} from "./parts/PledgeFundingToast.tsx";
import {CagnotteItemList} from "./parts/CagnotteItemList.tsx";
import {CagnotteResourceProgressCard} from "./parts/CagnotteResourceProgressCard.tsx";
import {CagnotteContributeButton} from "./parts/CagnotteContributeButton";
import {useFundingEnvelope} from "@/modules/cagnotte/hooks/useFundingEnvelope";
import {useResourceModalPreference} from "@/modules/cagnotte/hooks/useResourceModalPreference";
import {useCagnottePermissions} from "@/modules/cagnotte/hooks/useCagnottePermissions";
import {useCagnotteContextSafe} from "@/modules/cagnotte/hooks/useCagnotteContext";
import {formatNumber} from "@/modules/cagnotte/utils/format";
import {
    getEntityId,
    normalizeIdOrNull,
    readEntityPreferences,
    toSafeInt,
} from "@/modules/cagnotte/utils/dataTransform";
import {computeResourceFundingTotals} from "@/modules/cagnotte/lib/resourceFundingTotals";
import {useCagnotteType} from "@/modules/cagnotte/hooks/useCagnotteType.ts";
import {computePledgesFromResources, useCagnotteAdapter} from "@/modules/cagnotte/hooks/useCagnotteAdapter";
import {useSite} from "@/hooks/useSite.tsx";
import {CagnotteResource, CagnotteType, Pledge, Objective} from "@/modules/cagnotte/types.ts";
import {useOrganizationProjectsWithAnswers} from "@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers.ts";
import {useUserAdminOrganizations} from "@/modules/cagnotte/hooks/useUserAdminOrganizations.ts";
// Chargement à la demande du modal de paiement des promesses.
const PromessesDialog = lazy(() => import("./PromessesDialog"));
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";
import PaymentReceivedScreen from "@/modules/cagnotte/components/PaymentReceivedScreen.tsx";
import PledgeConfirmedScreen from "@/modules/cagnotte/components/PledgeConfirmedScreen.tsx";

/**
 * Palier financier déclenchant une célébration (toast + confetti à venir).
 * Pas exposé via les sections JSON — défini ici jusqu'à ce que la feature de paliers
 * UX soit activée (cf. tableau vide ci-dessous).
 */

const objectives: Objective[] = [
    {target: 0, label: "", description: "", icon: Anchor}
];

interface CagnotteDialogProps {
    totalAmount: number;
    children: React.ReactNode;
    defaultResourceId?: string;
    onRefresh?: () => void | Promise<void>;
    openContext?: {
        resourceId?: string;
        itemId?: string;
        hideResourceSelect?: boolean;
        hideOtherItems?: boolean;
        /**
         * Entité sur laquelle lire l'enveloppe. Par défaut celle du site — ce qui ne
         * convient qu'aux ressources de CE contexte. Une fiche qui affiche une
         * ressource vivant sous un autre contexte doit passer son hôte, sinon la
         * ressource forcée reste introuvable ici.
         */
        hostEntity?: EntityTypes | null;
        /**
         * Ressource injectée par l'appelant, en repli de l'enveloppe : elle rejoint la liste et peut être
         * sélectionnée comme les autres.
         */
        resource?: CagnotteResource;
    };
    cagnotteType?: CagnotteType;
}

/**
 * Wrapper minimal — ne rend que le trigger.
 *
 * Le contenu (et donc tous les hooks data : `useFundingEnvelope`,
 * `useOrganizationProjectsWithAnswers`, etc.) n'est monté que quand `open === true`.
 * Cela évite :
 *   - les fetchs "fantômes" au mount du header (avant que l'utilisateur ne clique)
 *   - les flickers de montants à 0 entre fermeture/réouverture (état local et
 *     refetchs partiels qui se désynchronisent)
 *
 * Le cache React Query (`queryClient`) survit au unmount, donc les réouvertures
 * rapides restent instantanées si la donnée est encore fresh (`staleTime`).
 */
const CagnotteDialog = ({children, ...props}: CagnotteDialogProps) => {
    const [open, setOpen] = useState(false);
    const [openPromesses, setOpenPromesses] = useState(false);
    const [pledges, setPledges] = useState<Pledge[]>([]);

    return (
        <ClientOnly fallback={<>{children}</>}>
            {() => (
                <>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>{children}</DialogTrigger>
                        {open && (
                            <CagnotteDialogContent
                                open={open}
                                setOpen={setOpen}
                                onOpenPromesses={() => {
                                    setOpen(false);
                                    setOpenPromesses(true);
                                }}
                                setPledges={setPledges}
                                {...props}
                            />
                        )}
                    </Dialog>

                    {openPromesses && (
                        <Suspense fallback={null}>
                            <PromessesDialog
                                open={openPromesses}
                                onOpenChange={setOpenPromesses}
                                pledges={pledges}
                                onOpenCagnotte={() => {
                                    setOpenPromesses(false); // Ferme les promesses
                                    setOpen(true);           // Réouvre la cagnotte
                                }}
                            />
                        </Suspense>
                    )}
                </>
            )}
        </ClientOnly>
    );
};

interface CagnotteDialogContentProps extends Omit<CagnotteDialogProps, "children"> {
    open: boolean;
    setOpen: (open: boolean) => void;
    onOpenPromesses: () => void;
    setPledges: (pledges: Pledge[]) => void;
}

const CagnotteDialogContent = ({
                                   totalAmount,
                                   defaultResourceId,
                                   onRefresh,
                                   openContext,
                                   cagnotteType: propsType,
                                   setOpen,
                                   onOpenPromesses,
                                   setPledges
                               }: CagnotteDialogContentProps) => {
    type CompletedContribution = { type: "paid" | "pledged"; amount: number } | null;
    const [completedContribution, setCompletedContribution] = useState<CompletedContribution>(null);
    const [customAmount, setCustomAmount] = useState("");
    const [selectedAmountType, setSelectedAmountType] = useState<"predefined" | "custom" | null>(null);
    const [selectedPredefinedAmount, setSelectedPredefinedAmount] = useState<number | null>(null);
    const [pendingContributionAmount, setPendingContributionAmount] = useState<number | null>(null);
    const [objectiveReached, setObjectiveReached] = useState<Objective | null>(null);
    const [selectedResourceId, setSelectedResourceId] = useState<string>("");
    const [showPaymentConfig, setShowPaymentConfig] = useState(false);
    const [isProcessing] = useState(false);
    const [optimisticResourceModalId, setOptimisticResourceModalId] = useState<string | null>(null);
    //  États pour les milestones activables
    const [activeItems, setActiveItems] = useState<Set<string>>(new Set());
    const [hasClickedFirstItem, setHasClickedFirstItem] = useState(false);
    // Clé de synchro pour détecter quand re-initialiser activeItems
    // (changement de project/proposition ou de forcedItemId). Pattern "adjust state
    // during render" pour éviter setState-in-effect.
    const [lastItemSyncKey, setLastItemSyncKey] = useState<string | null>(null);
    const previousAmountRef = useRef(totalAmount);
    useLoadNamespace("modules/cagnotte");
    const t = useT("modules/cagnotte");
    const queryClient = useQueryClient();

    const forcedResourceId = normalizeIdOrNull(openContext?.resourceId);
    const forcedItemId = normalizeIdOrNull(openContext?.itemId);
    const hideResourceSelect = !!openContext?.hideResourceSelect;
    const hideOtherItems = !!openContext?.hideOtherItems;
    const lockItemSelection = hideOtherItems && !!forcedItemId;

    // Récupérer l'entité depuis le contexte
    const { entity, me } = useCocolight();

    // Récupérer TOUS les projets pour le SELECT.
    // Le content n'est monté qu'à l'ouverture du dialog → fetch démarre ici,
    // pas en background sur le header.
    const {
        projects: allProjects,
        isLoading: allProjectsLoading,
    } = useOrganizationProjectsWithAnswers({
        entity: entity || null,
        enabled: !!entity,
    });

    // Un seul useFundingEnvelope() : il retourne `projects[]` complet ET
    // `selectedProject` ciblé (filtré par projectId côté normalize). Pas besoin
    // d'un 2e hook global — voir doc/refactor-useOrganizationProjectsWithAnswers-lazy.md §9.
    const {data: fundingEnvelope, isLoading: isEnvelopeLoading} = useFundingEnvelope(
        selectedResourceId || undefined,
        {hostEntity: openContext?.hostEntity},
    );
    const siteConfig = useSite();

    const {config: cagnotteConfig} = useCagnotteType({
        propsOverride: propsType,
        siteConfig: siteConfig?.config?.cagnotteModuleConfig?.defaultType,
    });

    //context => Pour personalisation des textes à afficher pour certain groupe d'organisation
    const context = siteConfig?.config?.cagnotteModuleConfig?.context ?? "";

    // Unifier les données venant de projet ou proposition/ depenses ou milestone
    const {
        resources: envelopeResources,
        savedSelectedResource: envelopeSelectedResource
    } = useCagnotteAdapter(fundingEnvelope, allProjects, cagnotteConfig, selectedResourceId);

    // La ressource injectée par l'appelant complète l'enveloppe sans la remplacer
    const injectedResource = openContext?.resource;
    const resources = useMemo(() => {
        if (!injectedResource) return envelopeResources;
        const injectedId = getEntityId(injectedResource.id);
        return envelopeResources.some((resource) => getEntityId(resource.id) === injectedId)
            ? envelopeResources
            : [injectedResource, ...envelopeResources];
    }, [envelopeResources, injectedResource]);

    const savedSelectedResource = useMemo(() => {
        if (envelopeSelectedResource) return envelopeSelectedResource;
        if (!injectedResource) return undefined;
        return getEntityId(injectedResource.id) === getEntityId(selectedResourceId)
            ? injectedResource
            : undefined;
    }, [envelopeSelectedResource, injectedResource, selectedResourceId]);
    const fundingByResourceId = useMemo(() => {
        const nextMap = new Map<string, { totalFunding: number; totalCost: number }>();
        resources.forEach((resource) => {
            const resourceId = String(resource?.id || "").trim();
            if (!resourceId) return;

            nextMap.set(resourceId, {
                totalFunding: toSafeInt(resource?.resourceFinancedAmount),
                totalCost: toSafeInt(resource?.resourceTotalAmount),
            });
        });

        return nextMap;
    }, [resources]);
    const currentUserEntity = (me && isUser(me) ? me : null) as User | null;
    const userAdminOrganizations = useUserAdminOrganizations(currentUserEntity, {});
    const orgsIds =  userAdminOrganizations?.map(user => user.id);
    //computedPledges : Promesses de financement non payé
    const computedPledges = useMemo<Pledge[]>(() => computePledgesFromResources(resources, me?.serverData?.id, orgsIds) , [resources, me?.serverData?.id, orgsIds]);

    // Permissions cagnotte calculées sur l'ORGA (entity Cocolight), pas sur le
    // projet visité. La modale CagnotteDialog est rendue dans 2 contextes :
    //  - Header (HeaderTransparentScroll) : indépendant du projet de la page courante.
    //  - Sidebar profil projet (FinanceSummary "Soutenir") : l'action `canContribute`
    //    ne dépend pas du statut admin, et le bouton 💾 "Cagnotte principale" agit
    //    sur `entity.preferences.projectModalId` de l'ORGA — donc admin orga requis.
    const cagnottePerms = useCagnottePermissions(entity, {
        hasActiveItems:
            (savedSelectedResource?.items ?? []).some((r) => r.status !== "close"),
        resourceId: selectedResourceId,
    });

    // Context cagnotte (null si CagnotteDialog est rendu hors d'un <CagnotteLayout>,
    // ex: depuis HeaderTransparentScroll). Permet aux features futures d'émettre des events
    // vers les sections cagnotte en dessous (scroll vers milestone financé, etc.).
    const cagnotteCtx = useCagnotteContextSafe();
    void cagnotteCtx; // unused pour l'instant — placeholder pour usage futur

    // Ids de toutes les ressources (mémoïsé — évite de re-parcourir `resources` à
    // chaque render, cf. getEntityId dans dataTransform.ts pour les formes d'id gérées).
    const allResourcesIds = useMemo(
        () =>
            resources
                .flatMap((p) => [
                    getEntityId(p.id),
                    getEntityId(p.projectId),
                    getEntityId(p.answerId),
                    getEntityId((p as { _id?: unknown })._id)
                ])
                .filter(Boolean),
        [resources]
    );

    const isValidResourceId = useCallback(
        (id: unknown) => {
            const cleaned = getEntityId(id);
            return !!cleaned && allResourcesIds.includes(cleaned);
        },
        [allResourcesIds]
    );

    // Sélectionner le projet avec priorité au contexte d'ouverture.
    // Pattern "adjust state during render" (React 19) au lieu d'un useEffect
    // pour éviter `react-hooks/set-state-in-effect` warning.
    // Cf. https://react.dev/reference/react/useState#storing-information-from-previous-renders
    if (resources.length > 0) {
        const targetId = isValidResourceId(forcedResourceId) ? getEntityId(forcedResourceId)
                       // Une ressource forcée mais absente ne retombe sur AUCUNE autre.
                       : forcedResourceId ? ""
                       : isValidResourceId(selectedResourceId) ? getEntityId(selectedResourceId)
                       : isValidResourceId(defaultResourceId) ? getEntityId(defaultResourceId)
                       : (allResourcesIds[0] || "");

        if (targetId !== getEntityId(selectedResourceId)) {
            setSelectedResourceId(targetId);
        }
    }

    const forcedResourceMissing =
        !!forcedResourceId && !isEnvelopeLoading && !allProjectsLoading && !isValidResourceId(forcedResourceId);

    const selectedResource: CagnotteResource | undefined = useMemo(() => {
        const cleanedSelected = getEntityId(selectedResourceId);
        return resources.find((p) =>
            getEntityId(p.id) === cleanedSelected ||
            getEntityId(p.projectId) === cleanedSelected ||
            getEntityId(p.answerId) === cleanedSelected
        );
    }, [resources, selectedResourceId]);

    const activeResourceItems = useMemo(
        () => selectedResource?.items.filter((item) => (item.status || 'open') !== 'close'),
        [selectedResource]
    );

    const visibleResourceItems = useMemo(() => {
        if (!hideOtherItems || !forcedItemId) {
            return activeResourceItems;
        }
        return (activeResourceItems || []).filter((item) => item.itemId === forcedItemId);
    }, [activeResourceItems, hideOtherItems, forcedItemId]);

    const selectedResourceName =
        savedSelectedResource?.name
        || (selectedResource?.name && selectedResource.name.length > 0 ? selectedResource.name : undefined)
        || String(t("CagnotteDialog.fallbacks.untitled", undefined, {context: cagnotteConfig.selectorType + context}));
    const resourceImage = selectedResource?.image;

    //  Récupérer l'answerId depuis le projet sélectionné
    const selectedResourceAnswerId =
        savedSelectedResource?.answerId
        || selectedResource?.answerId;

    const selectedResourceProjectId =
        savedSelectedResource?.projectId
        || selectedResource?.projectId;

    // Note (refactor lazy-mount) : on ne refetch plus à l'ouverture.
    // Le composant n'est monté QUE si `open === true`, donc les hooks démarrent
    // leur fetch à neuf à chaque ouverture (cache hit si staleTime valide).
    // Les `refetch*` restent disponibles pour des invalidations manuelles
    // (ex. après `handleContributionSaved`).

    //  Activer les milestones au chargement/changement de projet.
    //  Pattern "adjust state during render" via clé de synchro :
    //  - On calcule une key qui change UNIQUEMENT quand le project/proposition ou
    //    forcedMilestoneId change (pas à chaque render).
    //  - On compare avec la dernière key syncée ; si différente, on met à
    //    jour activeItems + hasClickedFirstItem.
    {
        const itemIds = (activeResourceItems || []).map((i) => i.itemId);
        const itemSyncKey = `${itemIds.join("|")}::${forcedItemId ?? ""}`;
        if (itemSyncKey !== lastItemSyncKey) {
            const hasForcedMatch = !!forcedItemId && itemIds.includes(forcedItemId);
            const targetIds = hasForcedMatch ? [forcedItemId!] : itemIds;
            setActiveItems(new Set(targetIds));
            setHasClickedFirstItem(hasForcedMatch);
            setLastItemSyncKey(itemSyncKey);
        }
    }

    // Total financé, cible et reste à financer sommés sur les MÊMES items ouverts
    // (dépenses orphelines comprises), comme `PaymentConfigPage.maxAllocatable`.
    // Ne PAS court-circuiter par `selectedResource.resourceFinancedAmount` : cet
    // agrégat n'a pas le périmètre de `items[]` (milestones projet seuls côté
    // projet, dépenses closes comprises côté proposition) — le plafond de la
    // modale divergeait alors de celui du paiement (cf. resourceFundingTotals.ts).
    // `resourceProgressPercentage` est calculé en interne par `CagnotteResourceProgressCard`.
    const {
        totalAmount: resourceCagnotteTotalAmount,
        targetAmount: resourceCagnotteTargetAmount,
        remainingAmount: remainingToFinanceAmount,
    } = useMemo(
        () => computeResourceFundingTotals(activeResourceItems, selectedResource),
        [activeResourceItems, selectedResource]
    );
    const maxContributionAmount = remainingToFinanceAmount;

    // Vérifier si le resource(proposition ou projet) sélectionné est déjà le resourceModalId
    // Lecture: d'abord dans data.preferences (draft), puis dans _serverData.preferences (server)
    const draftPreferencesData = readEntityPreferences(entity, "data");
    const serverPreferencesData = readEntityPreferences(entity, "serverData");

    const currentResourceModalId = optimisticResourceModalId
        || normalizeIdOrNull(draftPreferencesData?.projectModalId)
        || normalizeIdOrNull(serverPreferencesData?.projectModalId);
    const isCurrentResourceModalId = !!selectedResourceId && !!currentResourceModalId && selectedResourceId === currentResourceModalId;

    const predefinedAmounts = siteConfig?.config?.cagnotteModuleConfig?.predefinedAmounts || cagnotteConfig?.defaultPredefinedAmounts || [10, 20, 30, 50];

    // Fonction pour obtenir le montant sélectionné
    const getSelectedAmount = () => {
        if (selectedAmountType === "predefined" && selectedPredefinedAmount !== null) {
            return selectedPredefinedAmount <= maxContributionAmount ? selectedPredefinedAmount : 0;
        }
        if (selectedAmountType === "custom") {
            const amount = parseFloat(customAmount);
            if (!Number.isFinite(amount) || amount <= 0) {
                return 0;
            }
            return Math.min(amount, maxContributionAmount);
        }
        return 0;
    };

    // Cap les montants pendant le render si `maxContributionAmount` baisse.
    // Pattern "adjust state during render" (React 19) — chaque set est gardé
    // par un check de la valeur courante pour éviter de re-render inutilement.
    if (selectedPredefinedAmount !== null && selectedPredefinedAmount > maxContributionAmount) {
        setSelectedPredefinedAmount(null);
        if (selectedAmountType === "predefined") {
            setSelectedAmountType(null);
        }
    }
    if (customAmount) {
        const parsedCustom = parseFloat(customAmount);
        if (Number.isFinite(parsedCustom) && parsedCustom > maxContributionAmount) {
            const cappedValue = maxContributionAmount > 0 ? String(maxContributionAmount) : "";
            if (cappedValue !== customAmount) {
                setCustomAmount(cappedValue);
            }
            if (maxContributionAmount <= 0 && selectedAmountType === "custom") {
                setSelectedAmountType(null);
            }
        }
    }

    // Fire confetti celebration
    /*const fireCelebration = () => {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            // Confetti from both sides
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
                colors: ['#00d4aa', '#0ea5e9', '#22d3ee', '#14b8a6', '#06b6d4'],
            });
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
                colors: ['#00d4aa', '#0ea5e9', '#22d3ee', '#14b8a6', '#06b6d4'],
            });
        }, 250);
    };
*/
    // Check for milestone reached
    useEffect(() => {
        const previousAmount = previousAmountRef.current;

        // Find if a milestone was crossed
        const crossedItem = objectives.find(
            o => previousAmount < o.target && totalAmount >= o.target
        );

        if (crossedItem) {
            setObjectiveReached(crossedItem);
            //fireCelebration();

            // Special milestone toast
            showSuccessToast("CagnotteDialog.toasts.itemReached.title", t, {
                amount: formatNumber(crossedItem.target),
                context: cagnotteConfig.selectorType + context
            });

            // Clear milestone celebration after delay
            setTimeout(() => {
                setObjectiveReached(null);
            }, 5000);
        }

        previousAmountRef.current = totalAmount;
    }, [totalAmount, t, cagnotteConfig.selectorType, context]);

    const handleOpenPaymentConfig = () => {
        const amount = getSelectedAmount();

        if (!selectedResourceId) {
            showErrorToast(
                new Error(String(t("CagnotteDialog.toasts.resourceRequired.description", undefined, {context: cagnotteConfig.selectorType + context}))),
                String(t("CagnotteDialog.toasts.resourceRequired.title", undefined, {context: cagnotteConfig.selectorType + context})),
                t,
            );
            return;
        }

        if (activeItems.size === 0) {
            showErrorToast(
                new Error(String(t("CagnotteDialog.toasts.itemRequired.description", undefined, {context: cagnotteConfig.selectorType + context}))),
                String(t("CagnotteDialog.toasts.itemRequired.title", undefined, {context: cagnotteConfig.selectorType + context})),
                t,
            );
            return;
        }

        if (amount <= 0) {
            showErrorToast(
                new Error(String(t("CagnotteDialog.toasts.invalidAmount.description", undefined, {context: cagnotteConfig.selectorType + context}))),
                String(t("CagnotteDialog.toasts.invalidAmount.title", undefined, {context: cagnotteConfig.selectorType + context})),
                t,
            );
            return;
        }

        setPendingContributionAmount(amount);
        setShowPaymentConfig(true);
    };

    const handleContributionSaved = useCallback(async () => {
        await Promise.allSettled([
            queryClient.invalidateQueries({queryKey: CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX()}),
            queryClient.invalidateQueries({queryKey: CAGNOTTE_QUERY_KEYS.ORGANIZATION_PROJECTS_WITH_ANSWERS_PREFIX()}),
            queryClient.invalidateQueries({queryKey: CAGNOTTE_QUERY_KEYS.PROJECT_MODAL_CAGNOTTE_PREFIX()}),
            Promise.resolve(onRefresh?.()),
        ]);
    }, [queryClient, onRefresh]);

    const isContributionEnabled = getSelectedAmount() > 0 && activeItems.size > 0 && !!selectedResourceId;

    // Hook qui encapsule la logique save (BDD + toasts via useMutationWithToast).
    const {save: saveResourceModal, isSaving: isSavingResourceModal} = useResourceModalPreference(entity ?? null);

    const handleSaveResourceModal = async () => {
        const success = await saveResourceModal(selectedResourceId);
        if (success) {
            setOptimisticResourceModalId(normalizeIdOrNull(selectedResourceId));
        }
    };

    //  Gérer le click sur un milestone
    const handleItemClick = (itemId: string) => {
        if (lockItemSelection) {
            return;
        }

        if (!hasClickedFirstItem) {
            // Premier click: désélectionner tous et activer seulement celui-ci
            setActiveItems(new Set([itemId]));
            setHasClickedFirstItem(true);
        } else {
            // Clicks suivants: toggle normal
            const newActiveItems = new Set(activeItems);
            if (newActiveItems.has(itemId)) {
                newActiveItems.delete(itemId);
            } else {
                newActiveItems.add(itemId);
            }
            setActiveItems(newActiveItems);
        }
    };

    //  Gérer la sélection d'un montant prédéfini (comportement radio button)
    const handlePredefinedAmountClick = (amount: number) => {
        if (amount > maxContributionAmount) {
            return;
        }
        setSelectedAmountType("predefined");
        setSelectedPredefinedAmount(amount);
        setCustomAmount(""); // Effacer l'input custom
    };

    //  Gérer la modification de l'input custom (désélectionne les radios)
    const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (!value) {
            setCustomAmount("");
            setSelectedAmountType(null);
            setSelectedPredefinedAmount(null);
            return;
        }

        const numericValue = parseFloat(value);
        if (!Number.isFinite(numericValue)) {
            return;
        }

        const cappedValue = Math.min(numericValue, maxContributionAmount);
        setCustomAmount(cappedValue > 0 ? String(cappedValue) : "");

        if (cappedValue > 0) {
            setSelectedAmountType("custom");
            setSelectedPredefinedAmount(null); // Désélectionner les radios
        } else {
            setSelectedAmountType(null);
            setSelectedPredefinedAmount(null);
        }
    };

    return (
        <DialogContent className="sm:max-w-xl bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b py-4">
                <DialogTitle className="flex items-center gap-2 text-2xl">
                    <PiggyBank className="w-6 h-6 text-primary"/>
                    {t("CagnotteDialog.title", undefined, {context: cagnotteConfig.selectorType + context})}
                </DialogTitle>
                <DialogDescription>
                    {t("CagnotteDialog.description", undefined, {context: cagnotteConfig.selectorType + context})}
                </DialogDescription>
            </DialogHeader>

            {completedContribution ? (
                completedContribution.type === "paid" ? (
                    <PaymentReceivedScreen
                        amount={completedContribution.amount}
                        objectiveReached={objectiveReached}
                        onClose={() => setOpen(false)}
                    />
                ) : (
                    <PledgeConfirmedScreen
                        amount={completedContribution.amount}
                        onClose={() => setOpen(false)}
                    />
                )
            ) : showPaymentConfig && pendingContributionAmount ? (
                <Suspense fallback={
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                        {t("CagnotteDialog.loadingPayment", "Chargement du paiement…")}
                    </div>
                }>
                    <PaymentConfigPage
                        resourceName={selectedResourceName}
                        resourceId={selectedResourceId}
                        resourceImage={typeof resourceImage === "string" ? resourceImage : undefined}
                        amount={pendingContributionAmount}
                        items={activeResourceItems}
                        activeItemsIds={activeItems}
                        itemAnswerId={selectedResourceAnswerId} //  Passer l'answerId pour enregistrer les financements
                        itemProjectId={selectedResourceProjectId} //  Passer le projectId
                        onBack={() => setShowPaymentConfig(false)}
                        onPaymentSuccess={(payload) => {
                            setShowPaymentConfig(false);
                            // `method` présent ⇒ paiement réel (stripe/helloasso) ; absent ⇒ promesse.
                            // `payload.amount` porte l'effectiveAmount réellement débité/enregistré
                            // (potentiellement < montant saisi si un item a été désélectionné),
                            // donc on l'affiche plutôt que `pendingContributionAmount` brut.
                            setCompletedContribution({
                                type: payload?.method ? "paid" : "pledged",
                                amount: typeof payload?.amount === "number" ? payload.amount : (pendingContributionAmount ?? 0),
                            });
                            setPendingContributionAmount(null);
                        }}
                        onContributionSaved={handleContributionSaved}
                        onClose={() => setOpen(false)} //  Fermer la modale après paiement réussi
                        currentUser={null}
                        context={context}
                        cagnotteConfig={cagnotteConfig}
                    />
                </Suspense>
            ) : forcedResourceMissing ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                    {t("CagnotteDialog.labels.resourceOutOfScope", undefined, {
                        context: cagnotteConfig.selectorType + context,
                    })}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Bouton pour ouvrir le modal de paiement des promesses */}
                    {computedPledges.length > 0 && (
                        <PledgeFundingToast
                            pending={computedPledges}
                            onOpenPromesses={() => {
                                setPledges(computedPledges);
                                onOpenPromesses();
                            }}
                            cagnotteConfig={cagnotteConfig}
                            context={context}
                        />
                    )}
                    {/* Sélection du projet/proposition */}
                    <CagnotteResourceSelector
                        hasEntity={!!entity}
                        isLoading={allProjectsLoading}
                        resources={resources}
                        selectedResource={selectedResource}
                        selectedResourceId={selectedResourceId}
                        onSelectedResourceIdChange={setSelectedResourceId}
                        hideResourceSelect={hideResourceSelect}
                        fundingByResourceId={fundingByResourceId}
                        // Le bouton 💾 (cagnotte principale) est caché si le projet/proposition est déjà
                        // marqué comme principal, OU si l'utilisateur n'est pas admin de l'orga.
                        isCurrentResourceModalId={isCurrentResourceModalId || !cagnottePerms.isAdmin}
                        isSavingResourceModal={isSavingResourceModal}
                        onSaveResourceModal={handleSaveResourceModal}
                        cagnotteConfig={cagnotteConfig}
                        context={context}
                    />

                    {selectedResource ? (
                        <CagnotteResourceProgressCard
                            totalAmount={resourceCagnotteTotalAmount}
                            targetAmount={resourceCagnotteTargetAmount}
                            cagnotteConfig={cagnotteConfig}
                            context={context}
                        />
                    ) : null}

                    {/* Milestones */}
                    <CagnotteItemList
                        items={visibleResourceItems}
                        activeItemIds={activeItems}
                        onItemClick={handleItemClick}
                        cagnotteConfig={cagnotteConfig}
                        context={context}
                    />

                    {cagnotteConfig.showInfoText && (
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex items-start gap-3">
                                <Heart className="w-5 h-5 text-primary mt-0.5 shrink-0"/>
                                <p>{t("CagnotteDialog.labels.infoText1")}</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <Heart className="w-5 h-5 text-primary mt-0.5 shrink-0"/>
                                <p>{t("CagnotteDialog.labels.infoText2")}</p>
                            </div>
                        </div>
                    )}

                    <CagnotteAmountPicker
                        predefinedAmounts={predefinedAmounts}
                        selectedAmountType={selectedAmountType}
                        selectedPredefinedAmount={selectedPredefinedAmount}
                        customAmount={customAmount}
                        maxContributionAmount={maxContributionAmount}
                        remainingToFinanceAmount={remainingToFinanceAmount}
                        isProcessing={isProcessing}
                        onPredefinedAmountClick={handlePredefinedAmountClick}
                        onCustomAmountChange={handleCustomAmountChange}
                    />

                    {/* `canContribute` = connecté + projet + au moins un milestone actif. */}
                    {cagnottePerms.canContribute ? (
                        <CagnotteContributeButton
                            selectedAmountType={selectedAmountType}
                            selectedPredefinedAmount={selectedPredefinedAmount}
                            customAmount={customAmount}
                            isProcessing={isProcessing}
                            isContributionEnabled={isContributionEnabled}
                            onClick={handleOpenPaymentConfig}
                        />
                    ) : null}
                </div>
            )}
        </DialogContent>
    );
};

export default CagnotteDialog;
