import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
    Info,
} from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { useCocolight } from "@/hooks/useCocolight";
import { useDebounce } from "@/hooks/useDebounce";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { formatNumber } from "@/modules/cagnotte/utils/format";
import { asRecord, type UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { isUser } from "@/lib/getTypedEntity";
import {
    buildHelloAssoPaymentData,
    validateHelloAssoConfig,
} from "@/modules/cagnotte/services/helloAssoService";
import { openHelloAssoPaymentWithCheckout } from "@/modules/cagnotte/services/helloAssoCheckoutIntent";
import { verifyHelloAssoCheckoutStatus } from "@/modules/cagnotte/services/helloAssoVerification";
import { getStripePublicKey } from "@/modules/cagnotte/services/stripeService";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";
import { useUserAdminOrganizations } from "@/modules/cagnotte/hooks/useUserAdminOrganizations";
import { useSaveCagnotteContribution } from "@/modules/cagnotte/hooks/useSaveCagnotteContribution";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
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
    const { entity, me, api, apiClient, contextId, contextType } = useCocolight();
    const queryClient = useQueryClient();
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
    const [contributorType, setContributorType] = useState<ContributorType>("citoyens");
    const [contributorId, setContributorId] = useState<string>(me?.serverData?.id || "");
    const [contributorName, setContributorName] = useState<string>(me?.serverData?.name || "");
    const [searchOrgQuery, setSearchOrgQuery] = useState("");
    const [isHelloAssoProcessing, setIsHelloAssoProcessing] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [helloAssoPaymentId, setHelloAssoPaymentId] = useState<string | null>(null);
    const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
    const [isWaitingHelloAssoCallback, setIsWaitingHelloAssoCallback] = useState(false);
    useLoadNamespace("modules/cagnotte");
    const t = useT("modules/cagnotte");
    const fundingEnvelopeQuery = useFundingEnvelope(projectId);
    const fundingPaymentMethods = fundingEnvelopeQuery.data?.paymentMethods ?? fundingEnvelopeQuery.data?.selectedProject?.paymentMethods ?? null;

    const stripePublicKey = fundingPaymentMethods?.stripePublicKey || getStripePublicKey();
    const stripePromise = useMemo(
        () => (stripePublicKey ? loadStripe(stripePublicKey) : null),
        [stripePublicKey]
    );

    const stripeUnavailableReason = !stripePublicKey
        ? String(t("PaymentConfigPage.errors.stripeUnavailable"))
        : null;

    // Hook pour sauvegarder les contributions (dual-strategy: updatePathValue + fallback save)
    const { saveContribution } = useSaveCagnotteContribution(null, api);

    const refreshAfterContributionSave = useCallback(async () => {
        // `invalidateQueries` déclenche déjà le refetch des queries actives et await
        // jusqu'à leur résolution — pas besoin d'un `refetchFundingEnvelope()` supplémentaire.
        await Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX() }),
            queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.ORGANIZATION_PROJECTS_WITH_ANSWERS_PREFIX() }),
            Promise.resolve(onContributionSaved?.()),
        ]);
    }, [queryClient, onContributionSaved]);

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
            console.warn('navigate(/) a échoué, fallback window.location sera utilisé', error);
        }

        onClose();

        if (showToast) {
            showSuccessToast("PaymentConfigPage.toasts.thankYou.title", t);
        }

        if (!didNavigate && typeof window !== 'undefined') {
            window.location.assign('/');
        }
    }, [navigate, onClose, t]);

    const submitFundingEnvelopeAction = useCallback(async (
        action: "stripePay" | "helloassoPay",
        payload: Record<string, unknown>
    ) => {
        if (!entity || typeof entity.fundingEnvelope !== "function") {
            throw new Error(String(t("PaymentConfigPage.errors.fundingEnvelopeUnavailable")));
        }

        const effectiveContextId = contextId || entity.id || projectId;
        const effectiveContextType = normalizeFundingContextType(contextType || entity.getEntityType?.()) || "projects";

        if (!effectiveContextId) {
            throw new Error(String(t("PaymentConfigPage.errors.noContextId")));
        }

        const rawResponse = await entity.fundingEnvelope({
            contextId: effectiveContextId,
            contextType: effectiveContextType,
            action,
            ...payload,
        } as Parameters<typeof entity.fundingEnvelope>[0]);

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
                    me?.serverData?.id || ""
                );

                if (!saved) {
                    throw new Error(String(t("PaymentConfigPage.errors.saveFailed")));
                }
            } else {
                console.warn('Pas d\'answerId ou apiClient - skip sauvegarde BDD');
            }

            //  Continuer le flux normal
            setPaymentSuccess(true);
            onPaymentSuccess(paymentData);
            launchConfettiBurst({ originY: 0.34, spread: 84, count: 40 });

            // Fermer la modale et rediriger après affichage court de l'écran succès.
            //scheduleRedirectToHome(3000, true);
            await refreshAfterContributionSave();
        } catch (error) {
            console.error('Erreur completePayment:', error);
            showErrorToast(error, "PaymentConfigPage.toasts.paymentAcceptedIncomplete.title", t);

            // Continuer malgré l'erreur pour ne pas bloquer l'utilisateur
            setPaymentSuccess(true);
            onPaymentSuccess(paymentData);

            //scheduleRedirectToHome(3000, false);
            await refreshAfterContributionSave();
        }
    }, [answerId, apiClient, me, contributorType, contributorName, contributorId, t, onPaymentSuccess, saveContribution, refreshAfterContributionSave]);

    // Récupérer les organisations où l'utilisateur courant est admin (recherche server-side)
    const currentUserEntity = (me && isUser(me) ? me : null) as User | null;
    const debouncedSearchOrgQuery = useDebounce(searchOrgQuery, 300);
    const userAdminOrganizations = useUserAdminOrganizations(currentUserEntity, {
        search: debouncedSearchOrgQuery,
    });

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
                showErrorToast(
                    new Error(String(t("PaymentConfigPage.toasts.paymentInterrupted.description"))),
                    "PaymentConfigPage.toasts.paymentInterrupted.title",
                    t,
                );
                return;
            }

            // Démarre la vérification réelle côté API HelloAsso avant toute sauvegarde.
            setIsVerifyingPayment(true);
        };

        window.addEventListener("message", handleHelloAssoCallback);
        return () => window.removeEventListener("message", handleHelloAssoCallback);
    }, [helloAssoPaymentId, t]);

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
                console.error("Paiement HelloAsso échoué");
                clearInterval(verifyInterval);
                setIsVerifyingPayment(false);
                setIsHelloAssoProcessing(false);
                showErrorToast(
                    new Error(verification.error || String(t("PaymentConfigPage.toasts.paymentFailed.fallbackDescription"))),
                    "PaymentConfigPage.toasts.paymentFailed.title",
                    t,
                );
            }
            // Si status === "pending" ou "error", continuer à vérifier
        }, 5000);

        return () => clearInterval(verifyInterval);
    }, [isVerifyingPayment, helloAssoPaymentId, amount, projectName, projectId, activeMilestoneIds, contributorType, contributorId, t, completePayment, milestoneFunding]);


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
            console.error("Erreur financement Stripe via fundingEnvelope:", error);
            showErrorToast(error, "PaymentConfigPage.toasts.stripeError.title", t);
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

            // Valider la configuration (codes d'erreur traduits côté UI)
            const validation = validateHelloAssoConfig(helloAssoConfig);
            if (!validation.valid) {
                const messages = validation.errors.map((code) =>
                    String(t(`PaymentConfigPage.helloAssoConfigErrors.${code}`))
                );
                throw new Error(messages.join(" | "));
            }

            const fundingEnvelopeResponse = await submitFundingEnvelopeAction("helloassoPay", {
                amount,
                email: me?.serverData?.email,
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
                throw new Error(String(t("PaymentConfigPage.errors.noRedirectUrl")));
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

                showSuccessToast("PaymentConfigPage.toasts.paymentInProgress.title", t);
            } else {
                throw new Error(String(t("PaymentConfigPage.errors.popupFailed")));
            }
        } catch (error) {
            console.error("Erreur HelloAsso:", error);
            showErrorToast(error, "PaymentConfigPage.toasts.paymentError.title", t);
            setIsHelloAssoProcessing(false);
        }
    };

    if (paymentSuccess) {
        return (
            <div className="py-10 text-center space-y-4 animate-fade-in">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">{t("PaymentConfigPage.successScreen.title")}</h3>
                <p className="text-muted-foreground">{t("PaymentConfigPage.successScreen.subtitle")}</p>
                <Button onClick={() => redirectToHome(false)} variant="outline">{t("PaymentConfigPage.successScreen.returnButton")}</Button>
            </div>
        );
    }

    if (isVerifyingPayment) {
        return (
            <div className="py-10 text-center space-y-4 animate-fade-in">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">{t("PaymentConfigPage.verifying.title")}</h3>
                <p className="text-muted-foreground">{t("PaymentConfigPage.verifying.subtitle")}</p>
                <p className="text-xs text-muted-foreground">{t("PaymentConfigPage.verifying.hint")}</p>
            </div>
        );
    }

    if (isWaitingHelloAssoCallback) {
        return (
            <div className="py-10 text-center space-y-4 animate-fade-in">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">{t("PaymentConfigPage.waiting.title")}</h3>
                <p className="text-muted-foreground">{t("PaymentConfigPage.waiting.subtitle")}</p>
                <p className="text-xs text-muted-foreground">{t("PaymentConfigPage.waiting.hint")}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">{t("PaymentConfigPage.title")}</h2>
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
                        <p className="text-sm font-medium text-foreground">{t("PaymentConfigPage.milestonesLabel")}</p>
                        <div className="grid grid-cols-1 gap-2">
                            {activeMilestones.map((m) => {
                                const allocation = milestoneFunding.find(mf => mf.milestoneId === m.milestoneId);
                                const allocatedAmount = allocation?.amount || 0;
                                return (
                                    <div key={m.milestoneId} className="bg-background/50 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-sm">{m.name}</span>
                                            <Badge variant="outline">{formatNumber(allocatedAmount)}€</Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">{t("PaymentConfigPage.contributorTypeLabel")}</p>
                <ToggleGroup
                    type="single"
                    value={contributorType}
                    onValueChange={(value) => {
                        if (!value) return;
                        if (value === "citoyens") {
                            setContributorType("citoyens");
                            setContributorId(currentUserEntity?.serverData?.id || "");
                            setContributorName(currentUserEntity?.serverData?.name || "");
                        } else if (value === "organizations") {
                            setContributorType("organizations");
                        }
                    }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                    <ToggleGroupItem
                        value="citoyens"
                        aria-label={String(t("PaymentConfigPage.contributorOptions.person"))}
                        className="p-4 rounded-lg border-2 transition-all text-left h-auto justify-start data-[state=on]:bg-primary/20 data-[state=on]:border-primary bg-background border-border hover:border-primary/50"
                    >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Users className="w-4 h-4" /> {t("PaymentConfigPage.contributorOptions.person")}
                        </div>
                    </ToggleGroupItem>

                    <ToggleGroupItem
                        value="organizations"
                        aria-label={String(t("PaymentConfigPage.contributorOptions.organization"))}
                        className="p-4 rounded-lg border-2 transition-all text-left h-auto justify-start data-[state=on]:bg-primary/20 data-[state=on]:border-primary bg-background border-border hover:border-primary/50"
                    >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Users className="w-4 h-4" /> {t("PaymentConfigPage.contributorOptions.organization")}
                        </div>
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            {contributorType === "organizations" && (
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder={String(t("PaymentConfigPage.orgPicker.searchPlaceholder"))}
                            value={searchOrgQuery}
                            onChange={(e) => setSearchOrgQuery(e.target.value)}
                            className="h-10 pl-10"
                        />
                    </div>

                    {userAdminOrganizations.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                            <p>{t("PaymentConfigPage.orgPicker.notAdminTitle")}</p>
                            <p className="text-xs mt-2">
                                {t("PaymentConfigPage.orgPicker.notAdminHelp")}
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
                                <SelectValue placeholder={String(t("PaymentConfigPage.orgPicker.selectPlaceholder"))} />
                            </SelectTrigger>
                            <SelectContent>
                                {userAdminOrganizations.map((org) => (
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
                <p className="text-sm font-medium text-foreground">{t("PaymentConfigPage.paymentMethodLabel")}</p>
                <ToggleGroup
                    type="single"
                    value={paymentMethod ?? ""}
                    onValueChange={(value) => {
                        if (!value) return;
                        if (value === "stripe") {
                            if (!stripePromise) {
                                showErrorToast(
                                    new Error(stripeUnavailableReason || String(t("PaymentConfigPage.toasts.stripeMissing.fallbackDescription"))),
                                    "PaymentConfigPage.toasts.stripeMissing.title",
                                    t,
                                );
                                return;
                            }
                            setPaymentMethod("stripe");
                        } else if (value === "helloasso") {
                            setPaymentMethod("helloasso");
                        }
                    }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                    <ToggleGroupItem
                        value="stripe"
                        disabled={!stripePromise}
                        aria-label={String(t("PaymentConfigPage.stripe.title"))}
                        className={`p-4 rounded-lg border-2 transition-all text-left h-auto justify-start data-[state=on]:bg-primary/20 data-[state=on]:border-primary bg-background border-border hover:border-primary/50 ${!stripePromise ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-info/20 flex items-center justify-center shrink-0">
                                <CreditCard className="w-5 h-5 text-info" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-sm">{t("PaymentConfigPage.stripe.title")}</p>
                                <p className="text-xs text-muted-foreground">{t("PaymentConfigPage.stripe.description")}</p>
                                {!stripePromise && (
                                    <p className="text-xs text-destructive mt-1">{t("PaymentConfigPage.stripe.missingConfig")}</p>
                                )}
                            </div>
                        </div>
                    </ToggleGroupItem>

                    <ToggleGroupItem
                        value="helloasso"
                        aria-label={String(t("PaymentConfigPage.helloasso.title"))}
                        className="p-4 rounded-lg border-2 transition-all text-left h-auto justify-start data-[state=on]:bg-primary/20 data-[state=on]:border-primary bg-background border-border hover:border-primary/50"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
                                <ExternalLink className="w-5 h-5 text-success" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-sm">{t("PaymentConfigPage.helloasso.title")}</p>
                                <p className="text-xs text-muted-foreground">{t("PaymentConfigPage.helloasso.description")}</p>
                            </div>
                        </div>
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            <div className="space-y-3 pt-4 border-t border-border/50">
                {paymentMethod === "stripe" && isFormComplete && (
                    <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                        <p className="text-sm font-medium text-foreground">{t("PaymentConfigPage.stripe.formLabel")}</p>
                        {!stripePromise ? (
                            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-3">
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
                        className="w-full h-12 bg-success hover:bg-success/90 text-success-foreground"
                    >
                        <ExternalLink className="w-5 h-5 mr-2" />
                        {isHelloAssoProcessing
                            ? t("PaymentConfigPage.helloasso.buttonLoading")
                            : t("PaymentConfigPage.helloasso.button", undefined, { amount })}
                    </Button>
                )}

                {!paymentMethod && (
                    <Button disabled size="lg" className="w-full h-12">
                        <CreditCard className="w-5 h-5 mr-2" />
                        {t("PaymentConfigPage.selectMethodPlaceholder")}
                    </Button>
                )}
            </div>

            {/* Information supplémentaire pour HelloAsso */}
            {paymentMethod === "helloasso" && (
                <div className="text-xs text-muted-foreground space-y-2 p-3 bg-muted/30 rounded-md border border-border/50">
                    <p className="font-semibold flex items-center gap-2"><Info className="w-3.5 h-3.5" />{t("PaymentConfigPage.helloasso.info.title")}</p>
                    <ul className="space-y-1 ml-3 list-disc">
                        <li>{t("PaymentConfigPage.helloasso.info.li1")}</li>
                        <li>{t("PaymentConfigPage.helloasso.info.li2")}</li>
                        <li>{t("PaymentConfigPage.helloasso.info.li3")}</li>
                        <li>{t("PaymentConfigPage.helloasso.info.li4")}</li>
                        <li>{t("PaymentConfigPage.helloasso.info.li5")}</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default PaymentConfigPage;

