import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PiggyBank, Heart, Target, Anchor, Ship, Trophy, Loader, Save, CheckCircle2, Check, PartyPopper, Sparkles, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationProjectsWithAnswers } from "@/modules/profil/hooks/useOrganizationProjectsWithAnswers";
import { useCocolight } from "@/hooks/useCocolight";
import { useQueryClient } from "@tanstack/react-query";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import PaymentConfigPage from "./PaymentConfigPage";
import { updatePathValue } from "@/lib/updatePathValue";
//import confetti from "canvas-confetti";

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
    { target: 1000, label: "Premier palier", description: "Lancement d'une campagne de sensibilisation", icon: Anchor },
    { target: 3000, label: "Deuxième palier", description: "Financement d'une étude participative", icon: Target },
    { target: 5000, label: "Troisième palier", description: "Soutien à 3 projets communautaires", icon: Ship },
    { target: 10000, label: "Objectif final", description: "Création d'un programme de protection marine", icon: Trophy },
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

const CagnotteDialog = ({ totalAmount, children, defaultProjectId, onRefresh, openContext }: CagnotteDialogProps) => {
    const [open, setOpen] = useState(false);
    const [customAmount, setCustomAmount] = useState("");
    const [selectedAmountType, setSelectedAmountType] = useState<"predefined" | "custom" | null>(null);
    const [selectedPredefinedAmount, setSelectedPredefinedAmount] = useState<number | null>(null);
    const [pendingContributionAmount, setPendingContributionAmount] = useState<number | null>(null);
    const [milestoneReached, setMilestoneReached] = useState<Milestone | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState<string>("");
    const [isSavingProjectModal, setIsSavingProjectModal] = useState(false);
    const [showPaymentConfig, setShowPaymentConfig] = useState(false);
    const [paymentSuccess] = useState(false);
    const [isProcessing] = useState(false);
    const [optimisticProjectModalId, setOptimisticProjectModalId] = useState<string | null>(null);
    //  États pour les milestones activables
    const [activeMilestones, setActiveMilestones] = useState<Set<string>>(new Set());
    const [hasClickedFirstMilestone, setHasClickedFirstMilestone] = useState(false);
    const previousAmountRef = useRef(totalAmount);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const normalizeId = (value: unknown): string | null => {
        if (typeof value !== "string") return null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    };

    const forcedProjectId = normalizeId(openContext?.projectId);
    const forcedMilestoneId = normalizeId(openContext?.milestoneId);
    const hideProjectSelect = !!openContext?.hideProjectSelect;
    const hideOtherMilestones = !!openContext?.hideOtherMilestones;
    const lockMilestoneSelection = hideOtherMilestones && !!forcedMilestoneId;

    const toSafeInt = (value: unknown): number => {
        if (typeof value === "number" && Number.isFinite(value)) {
            return Math.trunc(value);
        }

        if (typeof value === "string") {
            const normalized = value.replace(/\s/g, "").replace(",", ".").trim();
            if (!normalized) return 0;
            const parsed = Number.parseInt(normalized, 10);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        return 0;
    };

    // Récupérer l'entité et le type depuis le contexte
    const { entity, contextType } = useCocolight();
    const entityType = contextType || "";

    // Récupérer TOUS les projets pour le SELECT
    // Note: on précharge même si la modale est fermée pour avoir les données prêtes
    const { projects: allProjectsData = [], isLoading: allProjectsLoading, error: projectsError } = useOrganizationProjectsWithAnswers({
        entity: entity || null,
        entityType,
        enabled: !!entity,  //  Précharger dès que l'entité est disponible
    });

    const allProjects = useMemo(() => (Array.isArray(allProjectsData) ? allProjectsData : []) as unknown[], [allProjectsData]);

    const draftPreferences = (entity as { data?: { preferences?: Record<string, unknown> } } | null)?.data?.preferences;
    const serverPreferences = (entity as { _serverData?: { preferences?: Record<string, unknown> } } | null)?._serverData?.preferences;

    // Sélectionner le projet avec priorité au contexte d'ouverture
    useEffect(() => {
        if (!Array.isArray(allProjects) || allProjects.length === 0) {
            return;
        }

        const allProjectIds = allProjects
            .map((p: unknown) => {
                const project = p as Record<string, unknown>;
                const id = (project?._serverData as Record<string, unknown>)?._id as Record<string, unknown>;
                return (id?._str as string | undefined) || (project?.id as string | undefined) || "";
            })
            .filter((projectId) => !!projectId);

        const preferredProjectId = forcedProjectId || defaultProjectId;
        if (preferredProjectId && allProjectIds.includes(preferredProjectId) && selectedProjectId !== preferredProjectId) {
            setSelectedProjectId(preferredProjectId);
            return;
        }

        const selectedIsValid = selectedProjectId && allProjectIds.includes(selectedProjectId);
        if (!selectedIsValid) {
            setSelectedProjectId(allProjectIds[0] || "");
        }
    }, [allProjects, selectedProjectId, defaultProjectId, forcedProjectId]);

    // Récupérer les données du projet sélectionné
    const selectedProject = Array.isArray(allProjects)
        ? allProjects.find((p: unknown) => {
            const project = p as Record<string, unknown>;
            const id = (project?._serverData as Record<string, unknown>)?._id as Record<string, unknown>;
            const projectId = (id?._str as string | undefined) || (project?.id as string | undefined);
            return projectId === selectedProjectId;
        })
        : undefined;

    const selectedProjectData = selectedProject as Record<string, unknown> | undefined;

    const projectMilestones = useMemo(
        () => (((selectedProjectData?.milestones as unknown[]) || []) as ProjectMilestone[]),
        [selectedProjectData]
    );

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

    const selectedProjectName = ((selectedProjectData?._serverData as Record<string, unknown> | undefined)?.name as string | undefined)
        || (selectedProjectData?.name as string | undefined)
        || "Projet sans titre";
    const projectImage = selectedProjectData?.profilImageUrl || selectedProjectData?.profilThumbImageUrl;

    //  Récupérer l'answerId depuis le projet sélectionné
    const selectedProjectAnswerId = ((selectedProjectData?._serverData as Record<string, unknown> | undefined)?.answer as string | undefined)
        || (selectedProjectData?.answer as string | undefined);

    //  Activer les milestones au chargement/changement de projet
    useEffect(() => {
        if (activeProjectMilestones.length > 0) {
            if (forcedMilestoneId && activeProjectMilestones.some((m) => m.milestoneId === forcedMilestoneId)) {
                setActiveMilestones(new Set([forcedMilestoneId]));
                setHasClickedFirstMilestone(true);
                return;
            }

            const milestoneIds = activeProjectMilestones.map((m) => m.milestoneId);
            setActiveMilestones(new Set(milestoneIds));
            setHasClickedFirstMilestone(false);
        } else {
            setActiveMilestones(new Set());
            setHasClickedFirstMilestone(false);
        }
    }, [activeProjectMilestones, forcedMilestoneId]);

    // Extraire les données de cagnotte du projet (montants convertis en int avant somme)
    const projectCagnotteTotalAmount = useMemo(() => {
        const milestonesTotal = activeProjectMilestones.reduce(
            (sum, milestone) => sum + toSafeInt(milestone.currentFunding),
            0
        );

        if (activeProjectMilestones.length > 0) {
            return milestonesTotal;
        }

        return toSafeInt(selectedProjectData?.cagnotteTotalAmount);
    }, [activeProjectMilestones, selectedProjectData]);

    const projectCagnotteTargetAmount = useMemo(() => {
        const milestonesTarget = activeProjectMilestones.reduce(
            (sum, milestone) => sum + toSafeInt(milestone.price),
            0
        );

        if (activeProjectMilestones.length > 0) {
            return milestonesTarget;
        }

        return toSafeInt(selectedProjectData?.cagnotteTargetAmount);
    }, [activeProjectMilestones, selectedProjectData]);
    const projectProgressPercentage = projectCagnotteTargetAmount > 0
        ? Math.min((projectCagnotteTotalAmount / projectCagnotteTargetAmount) * 100, 100)
        : 0;
    const remainingToFinanceAmount = Math.max(projectCagnotteTargetAmount - projectCagnotteTotalAmount, 0);
    const maxContributionAmount = remainingToFinanceAmount;

    // Vérifier si le projet sélectionné est déjà le projectModalId
    // Lecture: d'abord dans data.preferences (draft), puis dans _serverData.preferences (server)
    const draftPreferencesData = (entity as { data?: { preferences?: Record<string, unknown> } } | null)?.data?.preferences;
    const serverPreferencesData = (entity as { _serverData?: { preferences?: Record<string, unknown> } } | null)?._serverData?.preferences;

    const currentProjectModalId = optimisticProjectModalId
        || normalizeId(draftPreferencesData?.projectModalId)
        || normalizeId(serverPreferencesData?.projectModalId);
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

    useEffect(() => {
        if (selectedAmountType === "predefined" && selectedPredefinedAmount !== null && selectedPredefinedAmount > maxContributionAmount) {
            setSelectedAmountType(null);
            setSelectedPredefinedAmount(null);
        }

        if (selectedAmountType === "custom" && customAmount) {
            const parsed = parseFloat(customAmount);
            if (Number.isFinite(parsed) && parsed > maxContributionAmount) {
                const cappedValue = maxContributionAmount > 0 ? String(maxContributionAmount) : "";
                setCustomAmount(cappedValue);
                if (maxContributionAmount <= 0) {
                    setSelectedAmountType(null);
                }
            }
        }
    }, [maxContributionAmount, selectedAmountType, selectedPredefinedAmount, customAmount]);

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
            toast({
                title: `🎉 Palier atteint : ${crossedMilestone.target.toLocaleString('fr-FR')} € !`,
                description: crossedMilestone.description,
                duration: 6000,
            });

            // Clear milestone celebration after delay
            setTimeout(() => {
                setMilestoneReached(null);
            }, 5000);
        }

        previousAmountRef.current = totalAmount;
    }, [totalAmount, toast]);

    const handleOpenPaymentConfig = () => {
        const amount = getSelectedAmount();

        if (!selectedProjectId) {
            toast({
                title: "Projet requis",
                description: "Veuillez sélectionner un projet.",
                variant: "destructive",
            });
            return;
        }

        if (activeMilestones.size === 0) {
            toast({
                title: "Objectif requis",
                description: "Veuillez sélectionner au moins un milestone.",
                variant: "destructive",
            });
            return;
        }

        if (amount <= 0) {
            toast({
                title: "Montant invalide",
                description: "Veuillez choisir ou saisir un montant valide.",
                variant: "destructive",
            });
            return;
        }

        setPendingContributionAmount(amount);
        setShowPaymentConfig(true);
    };

    const handleContributionSaved = useCallback(async () => {
        await Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: ["funding-envelope"] }),
            queryClient.invalidateQueries({ queryKey: ["organization-projects-with-answers"] }),
            Promise.resolve(onRefresh?.()),
        ]);
    }, [queryClient, onRefresh]);

    const handlePaymentConfigSuccess = (paymentData: { amount?: number }) => {
        const amount = Number(paymentData?.amount ?? pendingContributionAmount ?? 0);
        // Le flux de fermeture/redirection est géré dans PaymentConfigPage.
        setShowPaymentConfig(false);
        setPendingContributionAmount(null);
    };

    const isContributionEnabled = getSelectedAmount() > 0 && activeMilestones.size > 0 && !!selectedProjectId;

    //  Sauvegarder le projectModalId dans localStorage
    const saveProjectModalIdToStorage = (projectId: string) => {
        try {
            if (typeof window !== 'undefined' && window.localStorage && entity?.id) {
                const storageKey = `projectModalId_${entity.id}`;
                localStorage.setItem(storageKey, projectId);
            }
        } catch (error) {
            console.warn('⚠️ Impossible de sauvegarder dans localStorage:', error);
            throw error;
        }
    };

    //  Sauvegarde distante (BDD) avec updatePathValue sur preferences
    const saveProjectModalIdToDatabase = async (projectId: string) => {
        if (!entity?.id) {
            throw new Error("Entité indisponible pour la sauvegarde distante.");
        }

        const draftPrefs = (entity as { data?: { preferences?: Record<string, unknown> } }).data?.preferences || {};
        const serverPrefs = (entity as { _serverData?: { preferences?: Record<string, unknown> } })._serverData?.preferences || {};
        const mergedPreferences = {
            ...serverPrefs,
            ...draftPrefs,
            projectModalId: projectId,
        };

        await updatePathValue(entity, {
            id: entity.id,
            collection: "organizations",
            path: "preferences",
            value: mergedPreferences,
        });

        // Refresh non bloquant pour resynchroniser les données locales
        try {
            if (typeof (entity as { get?: () => Promise<unknown> }).get === "function") {
                await (entity as { get: () => Promise<unknown> }).get();
            }
        } catch (refreshError) {
            console.warn("⚠️ Sauvegarde BDD OK mais refresh impossible:", refreshError);
        }
    };

    const handleSaveProjectModal = async () => {
        if (!selectedProjectId || !entity) {
            toast({
                title: "Erreur",
                description: "Veuillez sélectionner un projet.",
                variant: "destructive",
            });
            return;
        }

        setIsSavingProjectModal(true);

        try {
            // 1) Sauvegarde distante prioritaire
            await saveProjectModalIdToDatabase(selectedProjectId);

            // 2) Backup local
            saveProjectModalIdToStorage(selectedProjectId);

            //  Mettre à jour l'état optimiste immédiatement pour cacher le bouton
            setOptimisticProjectModalId(normalizeId(selectedProjectId));

            toast({
                title: " Succès",
                description: "Projet principal enregistré dans la base de données.",
            });
        } catch (dbError) {
            console.error('❌ Erreur sauvegarde BDD:', dbError);

            // Fallback localStorage
            try {
                saveProjectModalIdToStorage(selectedProjectId);
                toast({
                    title: "⚠️ Sauvegarde partielle",
                    description: "Sauvegarde en base impossible. Le projet est conservé localement sur ce navigateur.",
                });
            } catch (localError) {
                console.error('❌ Erreur fallback localStorage:', localError);
                toast({
                    title: "Erreur de sauvegarde",
                    description: dbError instanceof Error
                        ? `Base: ${dbError.message}`
                        : "Impossible de sauvegarder le projet (base et local).",
                    variant: "destructive",
                });
            }
        } finally {
            setIsSavingProjectModal(false);
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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl bg-card border-border max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <PiggyBank className="w-6 h-6 text-primary" />
                        Cagnotte Participative
                    </DialogTitle>
                    <DialogDescription>
                        Soutenez les projets océaniques et la plateforme communautaire
                    </DialogDescription>
                </DialogHeader>

                {paymentSuccess ? (
                    <div className="py-12 text-center space-y-4 animate-fade-in">
                        {milestoneReached ? (
                            <>
                                <div className="relative">
                                    <div className="w-24 h-24 mx-auto rounded-full bg-linear-to-br from-primary/30 to-accent/30 flex items-center justify-center animate-pulse">
                                        <PartyPopper className="w-12 h-12 text-primary" />
                                    </div>
                                    <div className="absolute -top-2 -right-2 w-8 h-8">
                                        <Sparkles className="w-8 h-8 text-accent animate-pulse" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Badge className="bg-linear-to-r from-primary to-accent text-primary-foreground text-sm px-4 py-1">
                                        🎉 Nouveau palier débloqué !
                                    </Badge>
                                    <h3 className="text-2xl font-bold text-primary">
                                        {milestoneReached.target.toLocaleString('fr-FR')} € atteints !
                                    </h3>
                                    <p className="text-muted-foreground max-w-xs mx-auto">
                                        {milestoneReached.description}
                                    </p>
                                </div>
                                <p className="text-sm text-foreground/80">
                                    Merci pour votre contribution ! 🌊
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                                    <Check className="w-10 h-10 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground">Paiement réussi !</h3>
                                <p className="text-muted-foreground">
                                    Merci pour votre générosité envers l'océan 🌊
                                </p>
                            </>
                        )}
                    </div>
                ) : showPaymentConfig && pendingContributionAmount ? (
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
                ) : (
                    <div className="space-y-6 py-4">
                        {/* Sélection du projet */}
                        <div className="space-y-3 border-t pt-6">
                            <div className="flex items-center gap-2">
                                <Briefcase className="w-5 h-5 text-primary" />
                                <label className="text-sm font-medium text-foreground">
                                    {hideProjectSelect ? "Projet soutenu" : "Sélectionner un projet à soutenir"}
                                </label>
                            </div>
                            {!entity ? (
                                <div className="py-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                                    <p>Aucune organisation sélectionnée</p>
                                </div>
                            ) : allProjectsLoading ? (
                                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                                    <Loader className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">Chargement des projets...</span>
                                </div>
                            ) : allProjects && allProjects.length > 0 ? (
                                hideProjectSelect ? (
                                    <div className="h-10 rounded-md border bg-muted/20 px-3 flex items-center gap-2">
                                        {typeof projectImage === "string" && projectImage ? (
                                            <img
                                                src={projectImage}
                                                alt={selectedProjectName}
                                                className="w-5 h-5 rounded object-cover"
                                            />
                                        ) : null}
                                        <span className="text-sm font-medium truncate">{selectedProjectName}</span>
                                    </div>
                                ) : (
                                <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                                            <SelectTrigger className="h-10">
                                                {selectedProjectId ? (
                                                    (() => {
                                                        const selectedProj = allProjects.find((p: unknown) => {
                                                            const proj = p as Record<string, unknown>;
                                                            const id = (proj?._serverData as Record<string, unknown>)?._id as Record<string, unknown>;
                                                            const projectId = (id?._str as string) || (proj?.id as string);
                                                            return projectId === selectedProjectId;
                                                        });
                                                        if (selectedProj) {
                                                            const proj = selectedProj as Record<string, unknown>;
                                                            const projectData = (proj._serverData as Record<string, unknown>) || proj;
                                                            const projectName = (projectData.name as string) || "Projet sans titre";
                                                            const projectImage = (projectData.profilImageUrl as string) || (projectData.profilThumbImageUrl as string);
                                                            return (
                                                                <div className="flex items-center gap-2">
                                                                    {projectImage && (
                                                                        <img
                                                                            src={projectImage}
                                                                            alt={projectName}
                                                                            className="w-5 h-5 rounded object-cover"
                                                                        />
                                                                    )}
                                                                    <span>{projectName}</span>
                                                                </div>
                                                            );
                                                        }
                                                        return <SelectValue placeholder="Sélectionner un projet..." />;
                                                    })()
                                                ) : (
                                                    <SelectValue placeholder="Sélectionner un projet..." />
                                                )}
                                            </SelectTrigger>
                                            <SelectContent>
                                                {allProjects.map((project: unknown, index: number) => {
                                                    const proj = project as Record<string, unknown>;

                                                    // Accéder aux données via serverData si c'est une entité sérialisée
                                                    const projectData = (proj._serverData as Record<string, unknown>) || proj;
                                                    const idObj = (projectData._id as Record<string, unknown>) || (proj._id as Record<string, unknown>);
                                                    const projectId = (idObj._str as string) || (proj._id as string);
                                                    const projectName = (projectData.name as string) || "Projet sans titre";
                                                    const projectImage = (projectData.profilImageUrl as string) || (projectData.profilThumbImageUrl as string);

                                                    // Récupérer les montants du projet
                                                    const cagnotteTotalAmount = (proj?.cagnotteTotalAmount as number) || 0;
                                                    const cagnotteTargetAmount = (proj?.cagnotteTargetAmount as number) || 0;

                                                    // Vérifier que projectId n'est pas vide
                                                    if (!projectId) {
                                                        console.warn(`❌ Projet ${index} sans ID - ignoré`);
                                                        return null;
                                                    }

                                                    return (
                                                        <SelectItem key={projectId} value={projectId}>
                                                            <div className="flex items-center justify-between gap-3 w-full">
                                                                <div className="flex items-center gap-2">
                                                                    {projectImage && (
                                                                        <img
                                                                            src={projectImage}
                                                                            alt={projectName}
                                                                            className="w-5 h-5 rounded object-cover"
                                                                        />
                                                                    )}
                                                                    <span>{projectName}</span>
                                                                </div>
                                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                                    {cagnotteTotalAmount}€ / {cagnotteTargetAmount}€
                                                                </span>
                                                            </div>
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Bouton pour définir comme cagnotte principale - seulement icône avec tooltip */}
                                    {selectedProjectId && !isCurrentProjectModalId && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        onClick={handleSaveProjectModal}
                                                        disabled={isSavingProjectModal}
                                                        variant="secondary"
                                                        size="icon"
                                                        className="h-10 w-10"
                                                    >
                                                        {isSavingProjectModal ? (
                                                            <Loader className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Save className="w-4 h-4" />
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Définir comme cagnotte principale</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </div>
                                )
                            ) : (
                                <div className="py-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                                    <p>Aucun projet disponible pour cette organisation</p>
                                </div>
                            )}
                        </div>

                        {/* Current Total & Progress */}
                        {selectedProject ? (
                            <div className="bg-linear-to-r from-primary/20 to-accent/20 rounded-xl p-6 space-y-4">
                                <div className="text-center">
                                    <p className="text-sm text-muted-foreground mb-2">Cagnotte du projet</p>
                                    <p className="text-4xl font-bold text-primary">{projectCagnotteTotalAmount.toLocaleString('fr-FR')} €</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        sur {projectCagnotteTargetAmount.toLocaleString('fr-FR')} € objectif
                                    </p>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Progression</span>
                                        <span>{projectCagnotteTotalAmount.toLocaleString('fr-FR')} € / {projectCagnotteTargetAmount.toLocaleString('fr-FR')} €</span>
                                    </div>
                                    <Progress value={projectProgressPercentage} className="h-3" />
                                </div>
                            </div>
                        ) : null}

                        {/* Milestones */}
                        <div className="space-y-3">
                            <p className="text-sm font-medium text-foreground">Objectifs de la cagnotte</p>
                            {visibleProjectMilestones && visibleProjectMilestones.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {visibleProjectMilestones.map((milestone) => {
                                        const isActive = activeMilestones.has(milestone.milestoneId);
                                        return (
                                            <div
                                                key={milestone.milestoneId}
                                                onClick={() => handleMilestoneClick(milestone.milestoneId)}
                                                className={`p-4 rounded-lg cursor-pointer transition-all space-y-2 ${
                                                    isActive
                                                        ? 'bg-primary/20 border-primary/50 border-2'
                                                        : 'bg-muted/30 border border-border/50 hover:border-border/80'
                                                }`}
                                            >
                                                <div className="flex items-start gap-2">
                                                    {/*  Checkbox pour activer/désactiver */}
                                                    <div className="flex items-center justify-center w-6 h-6 rounded border-2 mt-0.5 shrink-0 transition-colors"
                                                        style={{
                                                            borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                                                            backgroundColor: isActive ? 'var(--primary)' : 'transparent'
                                                        }}
                                                    >
                                                        {isActive && (
                                                            <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                                                            {milestone.name}
                                                        </h4>
                                                        {milestone.description && (
                                                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                                                {milestone.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Financement et progression */}
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-muted-foreground">Financement</span>
                                                        <span className="font-semibold text-foreground">
                                                            {milestone.currentFunding}€ / {milestone.price}€
                                                        </span>
                                                    </div>
                                                    <Progress
                                                        value={milestone.price > 0 ? (milestone.currentFunding / milestone.price) * 100 : 0}
                                                        className="h-2"
                                                    />
                                                </div>

                                                {/* Status */}
                                                {milestone.status && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {milestone.status as string}
                                                    </Badge>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>

                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex items-start gap-3">
                                <Heart className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                                <p>Chaque euro récolté soutient directement les projets de protection marine et le fonctionnement de la plateforme.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <Heart className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                                <p>Les fonds sont répartis équitablement entre les projets sélectionnés par la communauté et les frais de maintenance.</p>
                            </div>
                        </div>

                        {/* Predefined Amounts - Radio Button Style */}
                        <div className="space-y-3">
                            <p className="text-sm font-medium text-foreground">Choisissez un montant</p>
                            {/* Line 1: Remaining to Finance */}
                            {remainingToFinanceAmount > 0 && (
                                <div className="bg-accent/20 border border-accent/50 rounded-lg p-3">
                                    <p className="text-sm text-foreground font-medium">
                                        Reste à financer: <span className="text-lg font-bold text-accent">{remainingToFinanceAmount.toLocaleString('fr-FR')}€</span>
                                    </p>
                                </div>
                            )}
                            <div className="grid grid-cols-4 gap-3">
                                {predefinedAmounts.map((amount) => {
                                    const isDisabled = amount > maxContributionAmount || isProcessing;
                                    return (
                                        <button
                                            key={amount}
                                            onClick={() => handlePredefinedAmountClick(amount)}
                                            className={`h-14 text-lg font-semibold rounded-md transition-all border-2 ${
                                                selectedPredefinedAmount === amount && selectedAmountType === "predefined"
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'bg-background border-border hover:border-primary hover:text-primary'
                                            } ${isDisabled ? 'opacity-50 cursor-not-allowed hover:border-border hover:text-foreground' : ''}`}
                                            disabled={isDisabled}
                                        >
                                            {amount}€
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Custom Amount */}
                        <div className="space-y-3">
                            <p className="text-sm font-medium text-foreground">Ou entrez un montant libre</p>
                            <div className="relative">
                                <Input
                                    type="number"
                                    placeholder="Montant"
                                    value={customAmount}
                                    onChange={handleCustomAmountChange}
                                    className="pr-8 h-12 text-lg"
                                    min="1"
                                    max={Math.max(maxContributionAmount, 0)}
                                    disabled={isProcessing || maxContributionAmount <= 0}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                            </div>
                        </div>

                        {/* Bouton Contribuer Unique - Pour Radio ET Input */}
                        {(selectedAmountType === "predefined" || selectedAmountType === "custom") && (
                            <div className="flex justify-center">
                                <Button
                                    onClick={handleOpenPaymentConfig}
                                    disabled={isProcessing || !isContributionEnabled}
                                    className="h-12 px-8"
                                    size="lg"
                                >
                                    {isProcessing ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                                            Traitement...
                                        </>
                                    ) : (
                                        <>
                                            Contribuer {selectedAmountType === "predefined" && selectedPredefinedAmount !== null
                                                ? `${selectedPredefinedAmount}€`
                                                : selectedAmountType === "custom" && customAmount
                                                    ? `${customAmount}€`
                                                    : ''}
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default CagnotteDialog;
