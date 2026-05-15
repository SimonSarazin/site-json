import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    CreditCard,
    Users,
    ArrowLeft,
    Check,
    ExternalLink,
    Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCocolight } from "@/hooks/useCocolight";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";
import {
    buildHelloAssoPaymentData,
    validateHelloAssoConfig,
} from "@/utils/payment/helloAssoService";
import { openHelloAssoPaymentWithCheckout } from "@/utils/payment/helloAssoCheckoutIntent";
import { verifyHelloAssoCheckoutStatus } from "@/utils/payment/helloAssoVerification";
import { getStripePublicKey } from "@/utils/payment/stripeService";
import { useFundingEnvelope } from "@/hooks/useFundingEnvelope";
import { useUserAdminOrganizations } from "@/modules/cagnotte/hooks/useUserAdminOrganizations";
import { useSaveCagnotteContribution } from "@/modules/cagnotte/hooks/useSaveCagnotteContribution";
import { useQueryClient } from "@tanstack/react-query";
import { launchConfettiBurst } from "@/lib/confetti";
import StripePaymentForm from "./StripePaymentForm";

interface ProjectMilestone {
    milestoneId: string;
    name: string;
    description?: string;
    price: number;
    currentFunding: number;
}

interface PaymentConfigPageProps {
    projectName: string;
    projectId: string;
    projectImage?: string;
    amount: number;
    milestones: ProjectMilestone[];
    activeMilestoneIds: Set<string>;
    answerId?: string; //  ID de l'Answer associée au projet
    onBack: () => void;
    onPaymentSuccess: (paymentData: Record<string, unknown>) => void;
    onContributionSaved?: () => void | Promise<void>;
    onClose: () => void;
    currentUser: EntityTypes | null;
}

type PaymentMethod = "stripe" | "helloasso" | null;
type ContributorType = "citoyens" | "organizations";
type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
    return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function normalizeFundingEnvelopeResponse(value: unknown): UnknownRecord {
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value) as unknown;
            return asRecord(parsed);
        } catch {
            return {};
        }
    }
    return asRecord(value);
}

function normalizeFundingContextType(type: string | undefined): string {
    const lowered = (type || "").toLowerCase();
    if (lowered.includes("organization")) return "organizations";
    if (lowered.includes("project")) return "projects";
    if (lowered.includes("citoyen") || lowered.includes("user")) return "citoyens";
    return lowered;
}

const PaymentConfigPage = ({
    projectName,
    projectId,
    projectImage,
    amount,
    milestones,
    activeMilestoneIds,
    answerId, //  ID de l'Answer pour enregistrer les financements
    onBack,
    onPaymentSuccess,
    onContributionSaved,
    onClose,
}: PaymentConfigPageProps) => {
    const navigate = useNavigate();
    const { entity, me, apiClient, contextId, contextType } = useCocolight();
    const queryClient = useQueryClient();
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
    const [contributorType, setContributorType] = useState<ContributorType>("citoyens");
    const [contributorId, setContributorId] = useState<string>(me != null ? me.serverData?.id || me._serverData?.id || "" : "");
    const [contributorName, setContributorName] = useState<string>(me != null ? me.serverData?.name || me._serverData?.name || "" : "");
    const [searchOrgQuery, setSearchOrgQuery] = useState("");
    const [isHelloAssoProcessing, setIsHelloAssoProcessing] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [helloAssoPaymentId, setHelloAssoPaymentId] = useState<string | null>(null);
    const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
    const [isWaitingHelloAssoCallback, setIsWaitingHelloAssoCallback] = useState(false);
    const { toast } = useToast();
    const fundingEnvelopeQuery  = useFundingEnvelope(projectId);
    const { refetch: refetchFundingEnvelope } = useFundingEnvelope(projectId);
    const fundingPaymentMethods = fundingEnvelopeQuery.data?.paymentMethods ?? fundingEnvelopeQuery.data?.selectedProject?.paymentMethods ?? null;

    const stripePublicKey = fundingPaymentMethods?.stripePublicKey || getStripePublicKey();
    const stripePromise = useMemo(
        () => (stripePublicKey ? loadStripe(stripePublicKey) : null),
        [stripePublicKey]
    );

    const stripeUnavailableReason = !stripePublicKey
        ? "Stripe indisponible: configurez VITE_STRIPE_PUBLIC_KEY"
        : null;

    // Hook pour sauvegarder les contributions (dual-strategy: updatePathValue + fallback save)
    const { saveContribution } = useSaveCagnotteContribution(null, apiClient);

    const refreshAfterContributionSave = useCallback(async () => {
        await Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: ["funding-envelope"] }),
            queryClient.invalidateQueries({ queryKey: ["organization-projects-with-answers"] }),
            Promise.resolve(onContributionSaved?.()),
        ]);
        await refetchFundingEnvelope();
    }, [queryClient, onContributionSaved, refetchFundingEnvelope]);

    const activeMilestones = useMemo(
        () => milestones.filter((m) => activeMilestoneIds.has(m.milestoneId)),
        [milestones, activeMilestoneIds]
    );

    // Allouer le montant saisi du premier au dernier milestone actif
    const milestoneFunding = useMemo(() => {
        let remainingAmount = amount;

        return activeMilestones.map((milestone) => {
            const currentFunding = Number(milestone.currentFunding || 0);
            const targetAmount = Number(milestone.price || 0);
            const remainingToTarget = Math.max(targetAmount - currentFunding, 0);
            const allocatedAmount = Math.max(Math.min(remainingAmount, remainingToTarget), 0);

            remainingAmount -= allocatedAmount;

            return {
                milestoneId: milestone.milestoneId,
                amount: allocatedAmount,
            };
        });
    }, [activeMilestones, amount]);

    const redirectToHome = useCallback((showToast = false) => {
        let didNavigate = false;

        try {
            navigate('/', { replace: true });
            didNavigate = true;
        } catch (error) {
            console.warn('⚠️ navigate(/) a échoué, fallback window.location sera utilisé', error);
        }

        onClose();

        if (showToast) {
            toast({
                title: " Merci pour votre contribution!",
                description: "Retour à la page d'accueil...",
                duration: 3000,
            });
        }

        if (!didNavigate && typeof window !== 'undefined') {
            window.location.assign('/');
        }
    }, [navigate, onClose, toast]);

    const submitFundingEnvelopeAction = useCallback(async (
        action: "stripePay" | "helloassoPay",
        payload: Record<string, unknown>
    ) => {
        const entityRecord = entity as unknown as UnknownRecord;
        const fundingEnvelopeMethod = entityRecord.fundingEnvelope;

        if (typeof fundingEnvelopeMethod !== "function") {
            throw new Error("entity.fundingEnvelope est indisponible");
        }

        const effectiveContextId = contextId || entity?.id || projectId;
        const effectiveContextType = normalizeFundingContextType(contextType || entity?.getEntityType?.()) || "projects";

        if (!effectiveContextId) {
            throw new Error("contextId introuvable pour fundingEnvelope");
        }

        const rawResponse = await (fundingEnvelopeMethod as (request: UnknownRecord) => Promise<unknown>).call(entity, {
            contextId: effectiveContextId,
            contextType: effectiveContextType,
            action,
            ...payload,
        });

        const response = normalizeFundingEnvelopeResponse(rawResponse);

        if (typeof response.error === "string" && response.error) {
            throw new Error(response.error);
        }

        if (typeof response.message === "string" && response.message.toLowerCase().includes("error")) {
            throw new Error(response.message);
        }

        return response;
    }, [entity, contextId, contextType, projectId]);

    // Envelopper completePayment dans useCallback pour éviter les dépendances changeantes
    const completePayment = useCallback(async (
        paymentData: Record<string, unknown>,
        fundingData: Array<{ milestoneId: string; amount: number }>
    ) => {
        try {
            //  Enregistrer les financements dans Answer (si answerId disponible)
            if (answerId && apiClient) {
                // Préparer les données structurées pour le hook
                const milestoneFundingData = fundingData.map((f) => ({
                    milestoneId: f.milestoneId,
                    milestoneIndex: 0, // Sera calculé dans le hook
                    amount: f.amount,
                }));

                //  Récupérer les données actuelles de l'answer via apiClient
                const currentAnswerResponse = await (apiClient as unknown as {
                    callEndpoint: (endpoint: string, payload: Record<string, unknown>) => Promise<{ data?: Record<string, unknown> }>;
                }).callEndpoint('COFORM_ANSWERS_BY_ID', {
                    answerId,
                    fields: ['answers', 'project', 'id', '_id', 'formId', 'form_id', 'form', 'links'],
                });
                const responseRecord = asRecord(currentAnswerResponse);
                const responseData = asRecord(responseRecord.data);
                const currentAnswerData = Object.keys(responseData).length > 0 ? responseData : responseRecord;

                // Sécurise les métadonnées minimales pour les fallbacks de sauvegarde.
                if (!currentAnswerData.id && answerId) {
                    currentAnswerData.id = answerId;
                }
                if (!currentAnswerData.formId && typeof currentAnswerData.form_id === 'string') {
                    currentAnswerData.formId = currentAnswerData.form_id;
                }

                const saved = await saveContribution(
                    answerId,
                    milestoneFundingData,
                    currentAnswerData,
                    {
                        type: contributorType,
                        name: contributorName,
                        id: contributorId
                    },
                    me != null
                        ? me.serverData?.id || me._serverData?.id || ""
                        : ""
                );

                if (!saved) {
                    throw new Error("Impossible de sauvegarder les financements");
                }
            } else {
                console.warn('⚠️ Pas d\'answerId ou apiClient - skip sauvegarde BDD');
            }

            //  Continuer le flux normal
            setPaymentSuccess(true);
            onPaymentSuccess(paymentData);
            launchConfettiBurst({ originY: 0.34, spread: 84, count: 40 });

            // Fermer la modale et rediriger après affichage court de l'écran succès.
            //scheduleRedirectToHome(3000, true);
            await refreshAfterContributionSave();
        } catch (error) {
            console.error('❌ Erreur completePayment:', error);
            toast({
                title: "⚠️ Paiement accepté mais enregistrement incomplet",
                description: error instanceof Error ? error.message : "Erreur d'enregistrement des financements",
                variant: "destructive",
            });

            // Continuer malgré l'erreur pour ne pas bloquer l'utilisateur
            setPaymentSuccess(true);
            onPaymentSuccess(paymentData);

            //scheduleRedirectToHome(3000, false);
            await refreshAfterContributionSave();
        }
    }, [answerId, apiClient, me, contributorType, contributorName, contributorId, toast, onPaymentSuccess, saveContribution, refreshAfterContributionSave]);

    // Récupérer les organisations où l'utilisateur courant est admin
    const currentUserEntity = (me && isUser(me) ? me : null) as User | null;
    const userAdminOrganizations = useUserAdminOrganizations(currentUserEntity);

    // Filtrer les organisations selon la recherche
    const filteredOrganizations = useMemo(() => {
        if (!searchOrgQuery) return userAdminOrganizations;
        return userAdminOrganizations.filter((org) =>
            org.name.toLowerCase().includes(searchOrgQuery.toLowerCase())
        );
    }, [userAdminOrganizations, searchOrgQuery]);

    // Callback réel depuis /api/helloasso/callback (popup -> parent)
    useEffect(() => {
        const handleHelloAssoCallback = (event: MessageEvent) => {
            const data = (event.data || {}) as Record<string, unknown>;
            if (data.source !== "helloasso" || data.type !== "HELLOASSO_CALLBACK") return;

            const callbackStatus = String(data.status || "");
            const callbackCheckoutId = String(data.checkoutIntentId || "");

            if (helloAssoPaymentId && callbackCheckoutId && callbackCheckoutId !== helloAssoPaymentId) {
                return;
            }

            setIsWaitingHelloAssoCallback(false);

            if (callbackStatus === "failed" || callbackStatus === "error" || callbackStatus === "cancel") {
                setIsHelloAssoProcessing(false);
                toast({
                    title: "❌ Paiement interrompu",
                    description: "Le paiement HelloAsso n'a pas été confirmé.",
                    variant: "destructive",
                });
                return;
            }

            // Démarre la vérification réelle côté API HelloAsso avant toute sauvegarde.
            setIsVerifyingPayment(true);
        };

        window.addEventListener("message", handleHelloAssoCallback);
        return () => window.removeEventListener("message", handleHelloAssoCallback);
    }, [helloAssoPaymentId, toast]);

    // Vérifier le statut du paiement HelloAsso toutes les 5 secondes quand en attente
    useEffect(() => {
        if (!isVerifyingPayment || !helloAssoPaymentId) return;

        const verifyInterval = setInterval(async () => {
            const verification = await verifyHelloAssoCheckoutStatus(helloAssoPaymentId);

            if (verification.isValid) {
                clearInterval(verifyInterval);
                setIsVerifyingPayment(false);
                setIsHelloAssoProcessing(false);

                // Créer les données finales de paiement
                const paymentData = buildHelloAssoPaymentData(
                    {
                        amount,
                        projectName,
                        projectId,
                        milestoneIds: Array.from(activeMilestoneIds),
                        contributorType: contributorType as "citoyens" | "organizations",
                        organizationId: contributorId || undefined,
                    },
                    helloAssoPaymentId
                );
                completePayment(paymentData, milestoneFunding);
            } else if (verification.status === "failed") {
                console.error("❌ Paiement HelloAsso échoué");
                clearInterval(verifyInterval);
                setIsVerifyingPayment(false);
                setIsHelloAssoProcessing(false);
                toast({
                    title: "❌ Paiement échoué",
                    description: verification.error || "Le paiement a échoué",
                    variant: "destructive",
                });
            }
            // Si status === "pending" ou "error", continuer à vérifier
        }, 5000);

        return () => clearInterval(verifyInterval);
    }, [isVerifyingPayment, helloAssoPaymentId, amount, projectName, projectId, activeMilestoneIds, contributorType, contributorId, toast, completePayment, milestoneFunding]);


    const isFormComplete = Boolean(
        paymentMethod &&
        contributorType &&
        (contributorType === "citoyens" || (contributorType === "organizations" && contributorId))
    );

    const buildPaymentData = (method: "stripe" | "helloasso", transactionId: string) => ({
        transactionId,
        method,
        amount,
        projectName,
        milestones: activeMilestones.map((m) => {
            const allocation = milestoneFunding.find((mf) => mf.milestoneId === m.milestoneId);
            return {
                id: m.milestoneId,
                name: m.name,
                amount: allocation?.amount || 0,
            };
        }),
        contributorType,
        organizationId: contributorId || null,
        timestamp: new Date().toISOString(),
    });

    const handleStripePaymentSuccess = async (stripeData: Record<string, unknown>) => {
        try {
            await submitFundingEnvelopeAction("stripePay", {
                payment_method_id: String(
                    stripeData.stripePaymentMethodId ||
                    stripeData.paymentMethodId ||
                    stripeData.payment_method_id ||
                    ""
                ),
                amount,
            });

            const paymentData = {
                ...buildPaymentData("stripe", String(stripeData.transactionId || `stripe_${Date.now()}`)),
                ...stripeData,
            };
            completePayment(paymentData, milestoneFunding);
        } catch (error) {
            console.error("❌ Erreur financement Stripe via fundingEnvelope:", error);
            toast({
                title: "❌ Erreur",
                description: error instanceof Error ? error.message : "Impossible d'enregistrer le paiement Stripe",
                variant: "destructive",
            });
        }
    };

    const handleHelloAssoPayment = async () => {
        if (!isFormComplete) return;

        setIsHelloAssoProcessing(true);
        setIsWaitingHelloAssoCallback(false);
        setIsVerifyingPayment(false);

        try {
            // Préparer la configuration HelloAsso
            const helloAssoConfig = {
                amount,
                projectName,
                projectId,
                milestoneIds: Array.from(activeMilestoneIds),
                contributorType: contributorType as "citoyens" | "organizations",
                organizationId: contributorId || undefined,
            };

            // Valider la configuration
            const validation = validateHelloAssoConfig(helloAssoConfig);
            if (!validation.valid) {
                throw new Error(validation.errors.join(" | "));
            }

            const fundingEnvelopeResponse = await submitFundingEnvelopeAction("helloassoPay", {
                amount,
                email:
                    (me as unknown as { email?: string } | null)?.email ||
                    ((me as unknown as Record<string, unknown> | null)?.serverData as Record<string, unknown> | undefined)?.email as string | undefined ||
                    ((me as unknown as Record<string, unknown> | null)?._serverData as Record<string, unknown> | undefined)?.email as string | undefined,
            });

            const redirectUrl =
                typeof fundingEnvelopeResponse.redirectUrl === "string"
                    ? fundingEnvelopeResponse.redirectUrl
                    : typeof fundingEnvelopeResponse.checkoutIntentUrl === "string"
                        ? fundingEnvelopeResponse.checkoutIntentUrl
                        : typeof fundingEnvelopeResponse.url === "string"
                            ? fundingEnvelopeResponse.url
                            : undefined;

            if (!redirectUrl) {
                throw new Error("Aucune URL de redirection HelloAsso n'a été renvoyée par fundingEnvelope");
            }

            // 2. Ouvrir la popup avec l'URL officielle du checkout
            const { success, popup } = await openHelloAssoPaymentWithCheckout(
                redirectUrl,
                {
                    width: 680,
                    height: 760,
                    left: 120,
                    top: 60,
                }
            );

            if (success && popup) {
                const rawResponse = fundingEnvelopeResponse;
                setHelloAssoPaymentId(
                    String(rawResponse.checkoutIntentId || rawResponse.checkoutId || rawResponse.id || "")
                );
                setIsWaitingHelloAssoCallback(true);

                toast({
                    title: "⏳ Paiement en cours",
                    description: "Complétez le paiement dans la popup HelloAsso. Validation après callback réel.",
                    duration: 5000,
                });
            } else {
                throw new Error("La popup HelloAsso n'a pas pu être ouverte");
            }
        } catch (error) {
            console.error("❌ Erreur HelloAsso:", error);
            const errorMsg = error instanceof Error ? error.message : "Erreur HelloAsso";

            toast({
                title: "❌ Erreur de paiement",
                description: errorMsg,
                variant: "destructive",
            });
            setIsHelloAssoProcessing(false);
        }
    };

    if (paymentSuccess) {
        return (
            <div className="py-10 text-center space-y-4 animate-fade-in">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Paiement reussi</h3>
                <p className="text-muted-foreground">Retour a la page principale...</p>
                <Button onClick={() => redirectToHome(false)} variant="outline">Retourner maintenant</Button>
            </div>
        );
    }

    if (isVerifyingPayment) {
        return (
            <div className="py-10 text-center space-y-4 animate-fade-in">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Vérification en cours...</h3>
                <p className="text-muted-foreground">Nous confirmemos votre paiement HelloAsso</p>
                <p className="text-xs text-muted-foreground">Cela peut prendre quelques secondes</p>
            </div>
        );
    }

    if (isWaitingHelloAssoCallback) {
        return (
            <div className="py-10 text-center space-y-4 animate-fade-in">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">En attente du retour HelloAsso...</h3>
                <p className="text-muted-foreground">Terminez le paiement dans la popup pour continuer.</p>
                <p className="text-xs text-muted-foreground">Le financement sera enregistré seulement après callback réel.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">Formulaire du paiement</h2>
                <Button onClick={onBack} variant="ghost" size="icon" disabled={isHelloAssoProcessing}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
            </div>

            <div className="bg-linear-to-r from-primary/20 to-accent/20 rounded-xl p-6 space-y-4">
                <div className="flex items-start gap-4">
                    {projectImage && (
                        <img src={projectImage} alt={projectName} className="w-20 h-20 rounded-lg object-cover" />
                    )}
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{projectName}</h3>
                        <p className="text-3xl font-bold text-primary">{amount}€</p>
                        <p className="text-sm text-muted-foreground">
                            {activeMilestones.length} milestone{activeMilestones.length > 1 ? "s" : ""} selectionne{activeMilestones.length > 1 ? "s" : ""}
                        </p>
                    </div>
                </div>

                {activeMilestones.length > 0 && (
                    <div className="space-y-2 border-t border-border/50 pt-4">
                        <p className="text-sm font-medium text-foreground">Milestones finances :</p>
                        <div className="grid grid-cols-1 gap-2">
                            {activeMilestones.map((m) => {
                                const allocation = milestoneFunding.find(mf => mf.milestoneId === m.milestoneId);
                                const allocatedAmount = allocation?.amount || 0;
                                return (
                                    <div key={m.milestoneId} className="bg-background/50 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-sm">{m.name}</span>
                                            <Badge variant="outline">{allocatedAmount.toLocaleString('fr-FR')}€</Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Financer en tant que</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        onClick={() => {
                            setContributorType("citoyens");
                            setContributorId(
                                currentUserEntity != null
                                    ? currentUserEntity.serverData?.id || currentUserEntity._serverData?.id || ""
                                    : ""
                            );
                            setContributorName(
                                currentUserEntity != null
                                    ? currentUserEntity.serverData?.name || currentUserEntity._serverData?.name || ""
                                    : ""
                            );
                        }}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                            contributorType === "citoyens"
                                ? "bg-primary/20 border-primary"
                                : "bg-background border-border hover:border-primary/50"
                        }`}
                    >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Users className="w-4 h-4" /> Personne
                        </div>
                    </button>

                    <button
                        onClick={() => setContributorType("organizations")}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                            contributorType === "organizations"
                                ? "bg-primary/20 border-primary"
                                : "bg-background border-border hover:border-primary/50"
                        }`}
                    >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Users className="w-4 h-4" /> Organisation
                        </div>
                    </button>
                </div>
            </div>

            {contributorType === "organizations" && (
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Rechercher une organisation..."
                            value={searchOrgQuery}
                            onChange={(e) => setSearchOrgQuery(e.target.value)}
                            className="h-10 pl-10"
                        />
                    </div>

                    {userAdminOrganizations.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                            <p>Vous n'êtes admin d'aucune organisation</p>
                            <p className="text-xs mt-2">
                                Pour contribuer en tant qu'organisation, vous devez être administrateur
                            </p>
                        </div>
                    ) : (
                        <Select
                            value={contributorId}
                            onValueChange={(value) => {
                                setContributorId(value);
                                const selectedOrg = userAdminOrganizations.find((org) => org.id === value);
                                setContributorName(selectedOrg?.name || "");
                            }}
                        >
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Choisir une organisation..." />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredOrganizations.map((org) => (
                                    <SelectItem key={org.id} value={org.id}>
                                        <div className="flex items-center gap-2">
                                            {org.profilThumbImageUrl && (
                                                <img
                                                    src={org.profilThumbImageUrl}
                                                    alt={org.name}
                                                    className="w-4 h-4 rounded-full object-cover"
                                                />
                                            )}
                                            <span>{org.name}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            )}

            <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Methode de paiement</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        onClick={() => {
                            if (!stripePromise) {
                                toast({
                                    title: "Configuration Stripe manquante",
                                    description: stripeUnavailableReason || "Clé publique Stripe invalide.",
                                    variant: "destructive",
                                });
                                return;
                            }
                            setPaymentMethod("stripe");
                        }}
                        disabled={!stripePromise}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                            paymentMethod === "stripe"
                                ? "bg-primary/20 border-primary"
                                : "bg-background border-border hover:border-primary/50"
                        } ${!stripePromise ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                <CreditCard className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-sm">Stripe</p>
                                <p className="text-xs text-muted-foreground">Saisie carte directement dans la modale</p>
                                {!stripePromise && (
                                    <p className="text-xs text-red-600 mt-1">Configuration manquante</p>
                                )}
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setPaymentMethod("helloasso")}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                            paymentMethod === "helloasso"
                                ? "bg-primary/20 border-primary"
                                : "bg-background border-border hover:border-primary/50"
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                                <ExternalLink className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-sm">HelloAsso</p>
                                <p className="text-xs text-muted-foreground">Ouverture dans une popup</p>
                            </div>
                        </div>
                    </button>
                </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border/50">
                {paymentMethod === "stripe" && isFormComplete && (
                    <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                        <p className="text-sm font-medium text-foreground">Informations carte bancaire (Stripe)</p>
                        {!stripePromise ? (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                                {stripeUnavailableReason}
                            </div>
                        ) : (
                            <Elements stripe={stripePromise}>
                                <StripePaymentForm
                                    amount={amount}
                                    onSuccess={handleStripePaymentSuccess}
                                    onError={() => undefined}
                                />
                            </Elements>
                        )}
                    </div>
                )}

                {paymentMethod === "helloasso" && (
                    <Button
                        onClick={handleHelloAssoPayment}
                        disabled={!isFormComplete || isHelloAssoProcessing}
                        size="lg"
                        className="w-full h-12 bg-green-600 hover:bg-green-700"
                    >
                        <ExternalLink className="w-5 h-5 mr-2" />
                        {isHelloAssoProcessing ? "Ouverture HelloAsso..." : `Valider le paiement (${amount}€)`}
                    </Button>
                )}

                {!paymentMethod && (
                    <Button disabled size="lg" className="w-full h-12">
                        <CreditCard className="w-5 h-5 mr-2" />
                        Selectionnez une methode de paiement
                    </Button>
                )}
            </div>

            {/* Information supplémentaire pour HelloAsso */}
            {paymentMethod === "helloasso" && (
                <div className="text-xs text-muted-foreground space-y-2 p-3 bg-muted/30 rounded-md border border-border/50">
                    <p className="font-semibold">ℹ️ Informations HelloAsso:</p>
                    <ul className="space-y-1 ml-3 list-disc">
                        <li>Vous serez redirigé vers le site HelloAsso</li>
                        <li>Les paiements sont sécurisés via HelloAsso</li>
                        <li>Vous recevrez une confirmation par email</li>
                        <li>Fermez la popup après le paiement pour revenir</li>
                        <li>Le financement est enregistré après confirmation réelle du paiement</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default PaymentConfigPage;

