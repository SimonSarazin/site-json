import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { lazy } from "vite-preload";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { PiggyBank, Heart, Anchor } from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "@/modules/cagnotte/i18n";
import { useOrganizationProjectsWithAnswers, type OrgProject } from "@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { useCocolight } from "@/hooks/useCocolight";
import { useQueryClient } from "@tanstack/react-query";
import { ClientOnly } from "@/components/layout/ClientOnly";
// Lazy-load : `PaymentConfigPage` tire `@stripe/stripe-js` + `@stripe/react-stripe-js`
// par chaîne d'imports statique. En lazy, Stripe loader n'est plus dans le bundle
// initial — il est téléchargé uniquement quand l'utilisateur déclenche
// `showPaymentConfig` (clic sur "Contribuer").
const PaymentConfigPage = lazy(() => import("./PaymentConfigPage"));
import { CagnotteSuccessScreen } from "./parts/CagnotteSuccessScreen";
import { CagnotteAmountPicker } from "./parts/CagnotteAmountPicker";
import { CagnotteProjectSelector } from "./parts/CagnotteProjectSelector";
import { CagnotteMilestoneList } from "./parts/CagnotteMilestoneList";
import { CagnotteProjectProgressCard } from "./parts/CagnotteProjectProgressCard";
import { CagnotteContributeButton } from "./parts/CagnotteContributeButton";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";
import { useProjectModalPreference } from "@/modules/cagnotte/hooks/useProjectModalPreference";
import { useCagnottePermissions } from "@/modules/cagnotte/hooks/useCagnottePermissions";
import { useCagnotteContextSafe } from "@/modules/cagnotte/hooks/useCagnotteContext";
import { formatNumber } from "@/modules/cagnotte/utils/format";
import {
    normalizeIdOrNull,
    readEntityPreferences,
    toSafeInt,
} from "@/modules/cagnotte/utils/dataTransform";

/**
 * Palier financier déclenchant une célébration (toast + confetti à venir).
 * Pas exposé via les sections JSON — défini ici jusqu'à ce que la feature de paliers
 * UX soit activée (cf. tableau vide ci-dessous).
 */
interface Milestone {
    target: number;
    label: string;
    description: string;
    icon: React.ElementType;
}

interface ProjectMilestone {
    milestoneId: string;
    name: string;
    description?: string;
    price: number | string;
    currentFunding: number | string;
    status?: string;
}

const milestones: Milestone[] = [
    { target: 0, label: "", description: "", icon: Anchor }
];

interface CagnotteDialogProps {
    totalAmount: number;
    children: React.ReactNode;
    defaultProjectId?: string;
    onRefresh?: () => void | Promise<void>;
    openContext?: {
        projectId?: string;
        milestoneId?: string;
        hideProjectSelect?: boolean;
        hideOtherMilestones?: boolean;
    };
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
const CagnotteDialog = ({ children, ...props }: CagnotteDialogProps) => {
    const [open, setOpen] = useState(false);

    return (
        <ClientOnly fallback={<>{children}</>}>
            {() => (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>{children}</DialogTrigger>
                    {open && <CagnotteDialogContent open={open} setOpen={setOpen} {...props} />}
                </Dialog>
            )}
        </ClientOnly>
    );
};

interface CagnotteDialogContentProps extends Omit<CagnotteDialogProps, "children"> {
    open: boolean;
    setOpen: (open: boolean) => void;
}

const CagnotteDialogContent = ({ totalAmount, defaultProjectId, onRefresh, openContext, setOpen }: CagnotteDialogContentProps) => {
    const [customAmount, setCustomAmount] = useState("");
    const [selectedAmountType, setSelectedAmountType] = useState<"predefined" | "custom" | null>(null);
    const [selectedPredefinedAmount, setSelectedPredefinedAmount] = useState<number | null>(null);
    const [pendingContributionAmount, setPendingContributionAmount] = useState<number | null>(null);
    const [milestoneReached, setMilestoneReached] = useState<Milestone | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState<string>("");
    const [showPaymentConfig, setShowPaymentConfig] = useState(false);
    const [paymentSuccess] = useState(false);
    const [isProcessing] = useState(false);
    const [optimisticProjectModalId, setOptimisticProjectModalId] = useState<string | null>(null);
    //  États pour les milestones activables
    const [activeMilestones, setActiveMilestones] = useState<Set<string>>(new Set());
    const [hasClickedFirstMilestone, setHasClickedFirstMilestone] = useState(false);
    // Clé de synchro pour détecter quand re-initialiser activeMilestones
    // (changement de project ou de forcedMilestoneId). Pattern "adjust state
    // during render" pour éviter setState-in-effect.
    const [lastMilestoneSyncKey, setLastMilestoneSyncKey] = useState<string | null>(null);
    const previousAmountRef = useRef(totalAmount);
    useLoadNamespace("modules/cagnotte");
    const t = useT("modules/cagnotte");
    const queryClient = useQueryClient();

    const forcedProjectId = normalizeIdOrNull(openContext?.projectId);
    const forcedMilestoneId = normalizeIdOrNull(openContext?.milestoneId);
    const hideProjectSelect = !!openContext?.hideProjectSelect;
    const hideOtherMilestones = !!openContext?.hideOtherMilestones;
    const lockMilestoneSelection = hideOtherMilestones && !!forcedMilestoneId;

    // Récupérer l'entité depuis le contexte
    const { entity } = useCocolight();

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
    const { data: fundingEnvelope } = useFundingEnvelope(selectedProjectId || undefined);

    const fundingByProjectId = useMemo(() => {
        const nextMap = new Map<string, { totalFunding: number; totalCost: number }>();
        const projects = fundingEnvelope?.projects || [];

        projects.forEach((project) => {
            const projectId = String(project?.id || "").trim();
            if (!projectId) return;

            nextMap.set(projectId, {
                totalFunding: toSafeInt(project?.totalFinancement),
                totalCost: toSafeInt(project?.totalCouts),
            });
        });

        return nextMap;
    }, [fundingEnvelope]);

    // Permissions cagnotte calculées sur l'ORGA (entity Cocolight), pas sur le
    // projet visité. La modale CagnotteDialog est rendue dans 2 contextes :
    //  - Header (HeaderRezoLaMer) : indépendant du projet de la page courante.
    //  - Sidebar profil projet (FinanceSummary "Soutenir") : l'action `canContribute`
    //    ne dépend pas du statut admin, et le bouton 💾 "Cagnotte principale" agit
    //    sur `entity.preferences.projectModalId` de l'ORGA — donc admin orga requis.
    const cagnottePerms = useCagnottePermissions(entity, {
        hasActiveMilestones:
            (fundingEnvelope?.selectedProject?.milestones ?? []).some((m) => m.status !== "close"),
        projectId: selectedProjectId,
    });

    // Context cagnotte (null si CagnotteDialog est rendu hors d'un <CagnotteLayout>,
    // ex: depuis HeaderRezoLaMer). Permet aux features futures d'émettre des events
    // vers les sections cagnotte en dessous (scroll vers milestone financé, etc.).
    const cagnotteCtx = useCagnotteContextSafe();
    void cagnotteCtx; // unused pour l'instant — placeholder pour usage futur

    // Sélectionner le projet avec priorité au contexte d'ouverture.
    // Pattern "adjust state during render" (React 19) au lieu d'un useEffect
    // pour éviter `react-hooks/set-state-in-effect` warning.
    // Cf. https://react.dev/reference/react/useState#storing-information-from-previous-renders
    if (allProjects.length > 0) {
        const allProjectIds = allProjects.map((p) => p.id).filter((id) => !!id);
        const selectionIsValid = !!selectedProjectId && allProjectIds.includes(selectedProjectId);
        if (!selectionIsValid) {
            const preferred = forcedProjectId || defaultProjectId;
            const next = preferred && allProjectIds.includes(preferred)
                ? preferred
                : (allProjectIds[0] || "");
            if (next !== selectedProjectId) {
                setSelectedProjectId(next);
            }
        }
    }

    // Récupérer les données du projet sélectionné (typé OrgProject — plus de casts)
    const selectedProject: OrgProject | undefined = allProjects.find((p) => p.id === selectedProjectId);

    const projectMilestones = useMemo(() => {
        // Mapping FundingMilestone (typé) → ProjectMilestone (forme attendue par PaymentConfigPage).
        const envelopeMilestones = (fundingEnvelope?.milestones || []).map((milestone) => {
            const currentFunding = milestone.transactions.reduce(
                (sum, transaction) => sum + toSafeInt(transaction.amount),
                0,
            );
            return {
                milestoneId: milestone.id,
                name: milestone.title,
                description: milestone.description || undefined,
                price: toSafeInt(milestone.targetAmount),
                currentFunding,
                status: milestone.status,
            } as ProjectMilestone;
        }).filter((milestone) => milestone.milestoneId.length > 0);

        if (envelopeMilestones.length > 0) {
            return envelopeMilestones;
        }

        // Fallback : milestones du projet sélectionné (typés OrgProject.milestones)
        return (selectedProject?.milestones ?? []).map((m): ProjectMilestone => ({
            milestoneId: m.milestoneId,
            name: m.name,
            description: m.description,
            price: m.price,
            currentFunding: m.currentFunding,
            status: m.status,
        }));
    }, [fundingEnvelope, selectedProject]);

    const normalizedProjectMilestones = useMemo(
        () =>
            projectMilestones.map((milestone) => ({
                ...milestone,
                price: toSafeInt(milestone.price),
                currentFunding: toSafeInt(milestone.currentFunding),
            })),
        [projectMilestones]
    );

    const activeProjectMilestones = useMemo(
        () => normalizedProjectMilestones.filter((milestone) => (milestone.status || 'open') !== 'close'),
        [normalizedProjectMilestones]
    );

    const visibleProjectMilestones = useMemo(() => {
        if (!hideOtherMilestones || !forcedMilestoneId) {
            return activeProjectMilestones;
        }
        return activeProjectMilestones.filter((milestone) => milestone.milestoneId === forcedMilestoneId);
    }, [activeProjectMilestones, hideOtherMilestones, forcedMilestoneId]);

    const selectedProjectName =
        fundingEnvelope?.selectedProject?.name
        || (selectedProject?.name && selectedProject.name.length > 0 ? selectedProject.name : undefined)
        || String(t("CagnotteDialog.fallbacks.untitled"));
    const projectImage = selectedProject?.image;

    //  Récupérer l'answerId depuis le projet sélectionné
    const selectedProjectAnswerId =
        fundingEnvelope?.selectedProject?.answerId
        || selectedProject?.answerId;

    // Note (refactor lazy-mount) : on ne refetch plus à l'ouverture.
    // Le composant n'est monté QUE si `open === true`, donc les hooks démarrent
    // leur fetch à neuf à chaque ouverture (cache hit si staleTime valide).
    // Les `refetch*` restent disponibles pour des invalidations manuelles
    // (ex. après `handleContributionSaved`).

    //  Activer les milestones au chargement/changement de projet.
    //  Pattern "adjust state during render" via clé de synchro :
    //  - On calcule une key qui change UNIQUEMENT quand le project ou
    //    forcedMilestoneId change (pas à chaque render).
    //  - On compare avec la dernière key syncée ; si différente, on met à
    //    jour activeMilestones + hasClickedFirstMilestone.
    {
        const milestoneIds = activeProjectMilestones.map((m) => m.milestoneId);
        const milestoneSyncKey = `${milestoneIds.join("|")}::${forcedMilestoneId ?? ""}`;
        if (milestoneSyncKey !== lastMilestoneSyncKey) {
            const hasForcedMatch = !!forcedMilestoneId && milestoneIds.includes(forcedMilestoneId);
            const targetIds = hasForcedMatch ? [forcedMilestoneId!] : milestoneIds;
            setActiveMilestones(new Set(targetIds));
            setHasClickedFirstMilestone(hasForcedMatch);
            setLastMilestoneSyncKey(milestoneSyncKey);
        }
    }

    // Extraire les données de cagnotte du projet (montants convertis en int avant somme)
    const projectCagnotteTotalAmount = useMemo(() => {
        const milestonesTotal = activeProjectMilestones.reduce(
            (sum, milestone) => sum + toSafeInt(milestone.currentFunding),
            0
        );

        if (activeProjectMilestones.length > 0) {
            return milestonesTotal;
        }

        return toSafeInt(selectedProject?.cagnotteTotalAmount);
    }, [activeProjectMilestones, selectedProject]);

    const projectCagnotteTargetAmount = useMemo(() => {
        const milestonesTarget = activeProjectMilestones.reduce(
            (sum, milestone) => sum + toSafeInt(milestone.price),
            0
        );

        if (activeProjectMilestones.length > 0) {
            return milestonesTarget;
        }

        return toSafeInt(selectedProject?.cagnotteTargetAmount);
    }, [activeProjectMilestones, selectedProject]);
    // `projectProgressPercentage` est désormais calculé en interne par `CagnotteProjectProgressCard`.
    const remainingToFinanceAmount = Math.max(projectCagnotteTargetAmount - projectCagnotteTotalAmount, 0);
    const maxContributionAmount = remainingToFinanceAmount;

    // Vérifier si le projet sélectionné est déjà le projectModalId
    // Lecture: d'abord dans data.preferences (draft), puis dans _serverData.preferences (server)
    const draftPreferencesData = readEntityPreferences(entity, "data");
    const serverPreferencesData = readEntityPreferences(entity, "serverData");

    const currentProjectModalId = optimisticProjectModalId
        || normalizeIdOrNull(draftPreferencesData?.projectModalId)
        || normalizeIdOrNull(serverPreferencesData?.projectModalId);
    const isCurrentProjectModalId = !!selectedProjectId && !!currentProjectModalId && selectedProjectId === currentProjectModalId;

    const predefinedAmounts = [10, 20, 30, 50];

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
        const crossedMilestone = milestones.find(
            m => previousAmount < m.target && totalAmount >= m.target
        );

        if (crossedMilestone) {
            setMilestoneReached(crossedMilestone);
            //fireCelebration();

            // Special milestone toast
            showSuccessToast("CagnotteDialog.toasts.milestoneReached.title", t, {
                amount: formatNumber(crossedMilestone.target),
            });

            // Clear milestone celebration after delay
            setTimeout(() => {
                setMilestoneReached(null);
            }, 5000);
        }

        previousAmountRef.current = totalAmount;
    }, [totalAmount, t]);

    const handleOpenPaymentConfig = () => {
        const amount = getSelectedAmount();

        if (!selectedProjectId) {
            showErrorToast(
                new Error(String(t("CagnotteDialog.toasts.projectRequired.description"))),
                "CagnotteDialog.toasts.projectRequired.title",
                t,
            );
            return;
        }

        if (activeMilestones.size === 0) {
            showErrorToast(
                new Error(String(t("CagnotteDialog.toasts.milestoneRequired.description"))),
                "CagnotteDialog.toasts.milestoneRequired.title",
                t,
            );
            return;
        }

        if (amount <= 0) {
            showErrorToast(
                new Error(String(t("CagnotteDialog.toasts.invalidAmount.description"))),
                "CagnotteDialog.toasts.invalidAmount.title",
                t,
            );
            return;
        }

        setPendingContributionAmount(amount);
        setShowPaymentConfig(true);
    };

    const handleContributionSaved = useCallback(async () => {
        await Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX() }),
            queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.ORGANIZATION_PROJECTS_WITH_ANSWERS_PREFIX() }),
            queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.PROJECT_MODAL_CAGNOTTE_PREFIX() }),
            Promise.resolve(onRefresh?.()),
        ]);
    }, [queryClient, onRefresh]);

    const handlePaymentConfigSuccess = () => {
        // Le flux de fermeture/redirection est géré dans PaymentConfigPage.
        setShowPaymentConfig(false);
        setPendingContributionAmount(null);
    };

    const isContributionEnabled = getSelectedAmount() > 0 && activeMilestones.size > 0 && !!selectedProjectId;

    // Hook qui encapsule la logique save (BDD + toasts via useMutationWithToast).
    const { save: saveProjectModal, isSaving: isSavingProjectModal } = useProjectModalPreference(entity ?? null);

    const handleSaveProjectModal = async () => {
        const success = await saveProjectModal(selectedProjectId);
        if (success) {
            setOptimisticProjectModalId(normalizeIdOrNull(selectedProjectId));
        }
    };

    //  Gérer le click sur un milestone
    const handleMilestoneClick = (milestoneId: string) => {
        if (lockMilestoneSelection) {
            return;
        }

        if (!hasClickedFirstMilestone) {
            // Premier click: désélectionner tous et activer seulement celui-ci
            setActiveMilestones(new Set([milestoneId]));
            setHasClickedFirstMilestone(true);
        } else {
            // Clicks suivants: toggle normal
            const newActiveMilestones = new Set(activeMilestones);
            if (newActiveMilestones.has(milestoneId)) {
                newActiveMilestones.delete(milestoneId);
            } else {
                newActiveMilestones.add(milestoneId);
            }
            setActiveMilestones(newActiveMilestones);
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
            <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-2xl">
                                <PiggyBank className="w-6 h-6 text-primary" />
                                {t("CagnotteDialog.title")}
                            </DialogTitle>
                            <DialogDescription>
                                {t("CagnotteDialog.description")}
                            </DialogDescription>
                        </DialogHeader>

                        {paymentSuccess ? (
                            <CagnotteSuccessScreen milestoneReached={milestoneReached} />
                        ) : showPaymentConfig && pendingContributionAmount ? (
                            <Suspense fallback={
                                <div className="flex items-center justify-center py-12 text-muted-foreground">
                                    {t("CagnotteDialog.loadingPayment", "Chargement du paiement…")}
                                </div>
                            }>
                                <PaymentConfigPage
                                    projectName={selectedProjectName}
                                    projectId={selectedProjectId}
                                    projectImage={typeof projectImage === "string" ? projectImage : undefined}
                                    amount={pendingContributionAmount}
                                    milestones={activeProjectMilestones}
                                    activeMilestoneIds={activeMilestones}
                                    answerId={selectedProjectAnswerId} //  Passer l'answerId pour enregistrer les financements
                                    onBack={() => setShowPaymentConfig(false)}
                                    onPaymentSuccess={handlePaymentConfigSuccess}
                                    onContributionSaved={handleContributionSaved}
                                    onClose={() => setOpen(false)} //  Fermer la modale après paiement réussi
                                    currentUser={null}
                                />
                            </Suspense>
                        ) : (
                            <div className="space-y-6 py-4">
                                {/* Sélection du projet */}
                                <CagnotteProjectSelector
                                    hasEntity={!!entity}
                                    isLoading={allProjectsLoading}
                                    projects={allProjects}
                                    selectedProject={selectedProject}
                                    selectedProjectId={selectedProjectId}
                                    onSelectedProjectIdChange={setSelectedProjectId}
                                    hideProjectSelect={hideProjectSelect}
                                    fundingByProjectId={fundingByProjectId}
                                    // Le bouton 💾 (cagnotte principale) est caché si le projet est déjà
                                    // marqué comme principal, OU si l'utilisateur n'est pas admin de l'orga.
                                    isCurrentProjectModalId={isCurrentProjectModalId || !cagnottePerms.isAdmin}
                                    isSavingProjectModal={isSavingProjectModal}
                                    onSaveProjectModal={handleSaveProjectModal}
                                />

                                {selectedProject ? (
                                    <CagnotteProjectProgressCard
                                        totalAmount={projectCagnotteTotalAmount}
                                        targetAmount={projectCagnotteTargetAmount}
                                    />
                                ) : null}

                                {/* Milestones */}
                                <CagnotteMilestoneList
                                    milestones={visibleProjectMilestones.map((m) => ({
                                        milestoneId: m.milestoneId,
                                        name: m.name,
                                        description: m.description,
                                        price: typeof m.price === "number" ? m.price : Number(m.price) || 0,
                                        currentFunding:
                                            typeof m.currentFunding === "number"
                                                ? m.currentFunding
                                                : Number(m.currentFunding) || 0,
                                        status: m.status,
                                    }))}
                                    activeMilestoneIds={activeMilestones}
                                    onMilestoneClick={handleMilestoneClick}
                                />

                                <div className="space-y-3 text-sm text-muted-foreground">
                                    <div className="flex items-start gap-3">
                                        <Heart className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                                        <p>{t("CagnotteDialog.labels.infoText1")}</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Heart className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                                        <p>{t("CagnotteDialog.labels.infoText2")}</p>
                                    </div>
                                </div>

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
