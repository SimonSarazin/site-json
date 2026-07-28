import { useMemo, useState, useEffect, useCallback, useRef } from "react";
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
    Clock,
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
import {CagnotteFundableItem, DepenseFunding, CagnotteTypeConfig} from "@/modules/cagnotte/types.ts";

interface PaymentConfigPageProps {

    resourceName: string;
    resourceId: string;
    resourceImage?: string;
    amount: number;
    items: CagnotteFundableItem[] | undefined;
    activeItemsIds: Set<string>;
    itemAnswerId?: string; //  ID de l'Answer associée
    itemProjectId?: string; //  ID de du Projet associée
    onBack: () => void;
    onPaymentSuccess: (paymentData: Record<string, unknown>) => void;
    onContributionSaved?: () => void | Promise<void>;
    onClose: () => void;
    currentUser: EntityTypes | null;
    context: string;
    cagnotteConfig: CagnotteTypeConfig;
}

interface PaymentDataPayload extends Record<string, unknown> {
    method?: string;
    transactionId?: string;
}

type PaymentMethod = "stripe" | "helloasso" | "pledge" | null;
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
                               resourceName,
                               resourceId,
                               resourceImage,
                               amount,
                               items,
                               activeItemsIds,
                               itemAnswerId,
                               itemProjectId,
                               onBack,
                               onPaymentSuccess,
                               onContributionSaved,
                               onClose,
                               context,
                               cagnotteConfig
                           }: PaymentConfigPageProps) => {
    const navigate = useNavigate();
    const { entity, me, api, contextId, contextType } = useCocolight();
    const queryClient = useQueryClient();
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
    const [contributorType, setContributorType] = useState<ContributorType>(cagnotteConfig.allowPersonToFinance ? "citoyens" : "organizations");
    const [contributorId, setContributorId] = useState<string>(cagnotteConfig.allowPersonToFinance ? (me?.serverData?.id || "") : "");
    const [contributorName, setContributorName] = useState<string>(me?.serverData?.name || "");
    const [searchOrgQuery, setSearchOrgQuery] = useState("");
    const [isHelloAssoProcessing, setIsHelloAssoProcessing] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [helloAssoPaymentId, setHelloAssoPaymentId] = useState<string | null>(null);
    const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
    const [isWaitingHelloAssoCallback, setIsWaitingHelloAssoCallback] = useState(false);
    const [acceptPledgeCondition, setAcceptPledgeCondition] = useState(false);
    useLoadNamespace("modules/cagnotte");
    const t = useT("modules/cagnotte");
    const fundingEnvelopeQuery = useFundingEnvelope(resourceId);
    const fundingPaymentMethods = fundingEnvelopeQuery.data?.paymentMethods ?? fundingEnvelopeQuery.data?.selectedProject?.paymentMethods ?? null;

    const stripePublicKey = fundingPaymentMethods?.stripePublicKey || getStripePublicKey();
    const stripePromise = useMemo(
        () => (stripePublicKey ? loadStripe(stripePublicKey) : null),
        [stripePublicKey]
    );

    const acceptCondition = (e: { target: { checked: boolean | ((prevState: boolean) => boolean); }; }) => {setAcceptPledgeCondition(e.target.checked);};

    const stripeUnavailableReason = !stripePublicKey
        ? String(t("PaymentConfigPage.errors.stripeUnavailable"))
        : null;

    // Hook pour sauvegarder les contributions (dual-strategy: Answer.updateField + fallback save)
    const { saveContribution } = useSaveCagnotteContribution();

    const refreshAfterContributionSave = useCallback(async () => {
        // `invalidateQueries` déclenche déjà le refetch des queries actives et await
        // jusqu'à leur résolution — pas besoin d'un `refetchFundingEnvelope()` supplémentaire.
        await Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX() }),
            queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.ORGANIZATION_PROJECTS_WITH_ANSWERS_PREFIX() }),
            Promise.resolve(onContributionSaved?.()),
        ]);
    }, [queryClient, onContributionSaved]);

    const activeItems = useMemo(
        () => (items || []).filter((i) => activeItemsIds.has(i.itemId)),
        [items, activeItemsIds]
    );

    const maxAllocatable = useMemo(
        () => activeItems.reduce((sum, item) => {
            const currentFunding = Number(item.currentFunding || 0);
            const targetAmount = Number(item.price || 0);
            return sum + Math.max(targetAmount - currentFunding, 0);
        }, 0),
        [activeItems]
    );

    const effectiveAmount = Math.min(amount, maxAllocatable);

    // Allouer le montant saisi du premier au dernier depens actif
    const depenseFunding = useMemo(() => {
        let remainingAmount = effectiveAmount;
        const result = activeItems.map((item) => {
            const currentFunding = Number(item.currentFunding || 0);
            const targetAmount = Number(item.price || 0);
            const remainingToTarget = Math.max(targetAmount - currentFunding, 0);
            const allocatedAmount = Math.max(Math.min(remainingAmount, remainingToTarget), 0);

            remainingAmount -= allocatedAmount;

            return {
                depenseIndex: item.depenseIndex,
                amount: allocatedAmount,
            };
        });

        return result;
    }, [activeItems, effectiveAmount]);

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
        action: "stripePay" | "helloassoPay" | "pledge",
        payload: Record<string, unknown>
    ) => {
        if (!entity || typeof entity.fundingEnvelope !== "function") {
            throw new Error(String(t("PaymentConfigPage.errors.fundingEnvelopeUnavailable")));
        }

        const effectiveContextId = contextId || entity.id || itemProjectId;
        const effectiveContextType = normalizeFundingContextType(contextType || entity.getEntityType?.()) || "projects" ;

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
    }, [entity, contextId, contextType, t]);

    // Garde-fou de ré-entrance : `completePayment` enregistre le financement via
    // `answer.updateField(..., {arrayForm:true})` qui AJOUTE une entrée financer à
    // chaque appel. Or le poll HelloAsso (setInterval 5s + fetch awaité) peut déclencher
    // deux ticks concurrents. Sans garde, la contribution serait enregistrée en double.
    // "running"/"done" bloquent tout second appel ; on repasse à "idle" sur erreur pour
    // autoriser une nouvelle tentative.
    const completionStateRef = useRef<"idle" | "running" | "done">("idle");

    // Envelopper completePayment dans useCallback pour éviter les dépendances changeantes
    const completePayment = useCallback(async (
        paymentData: PaymentDataPayload,
        fundingData: DepenseFunding[],
    ) => {
        if (completionStateRef.current !== "idle") return;
        completionStateRef.current = "running";
        try {
            //  Enregistrer les financements dans Answer (si answerId disponible)
            if (itemAnswerId && api) {
                const itemFundingData = fundingData.map((f) => ({
                    depenseIndex: f.depenseIndex,
                    amount: f.amount,
                }));

                // `saveContribution` accepte directement un id — il charge l'Answer
                // via api.answer({id}) en interne et utilise `answer.updateField` pour
                // la mutation atomique de chaque dépense.
                // Si c'est un pledge, method et transactionId seront undefined ici
                const { method, transactionId } = paymentData;

                const saved = await saveContribution(
                    itemAnswerId,
                    itemFundingData,
                    {
                        type: contributorType,
                        name: contributorName,
                        id: contributorId
                    },
                    method,
                    transactionId
                );

                if (!saved) throw new Error(String(t("PaymentConfigPage.errors.saveFailed")));
            }

            completionStateRef.current = "done";
            setPaymentSuccess(true);
            onPaymentSuccess(paymentData);
            launchConfettiBurst({ originY: 0.34, spread: 84, count: 40 });
        } catch (error) {
            // Échec de l'enregistrement : on repasse à "idle" pour permettre une relance.
            completionStateRef.current = "idle";
            console.error('Erreur completePayment:', error);
            showErrorToast(error, "PaymentConfigPage.toasts.paymentAcceptedIncomplete.title", t);
        } finally {
            await refreshAfterContributionSave();
        }
    }, [itemAnswerId, api, contributorType, contributorName, contributorId, t, onPaymentSuccess, saveContribution, refreshAfterContributionSave]);

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

        // Empêche deux ticks de se chevaucher si une vérification dépasse 5 s
        // (le fetch n'a pas de timeout) : sinon deux ticks pourraient tous deux
        // voir isValid et appeler completePayment.
        let polling = false;

        const verifyInterval = setInterval(async () => {
            if (polling) return;
            polling = true;
            try {
                const verification = await verifyHelloAssoCheckoutStatus(helloAssoPaymentId);

                if (verification.isValid) {
                    clearInterval(verifyInterval);
                    setIsVerifyingPayment(false);
                    setIsHelloAssoProcessing(false);

                    // Créer les données finales de paiement
                    const paymentData = buildHelloAssoPaymentData(
                        {
                            amount: effectiveAmount,
                            resourceName,
                            resourceId,
                            itemsIds: Array.from(activeItemsIds),
                            contributorType: contributorType as "citoyens" | "organizations",
                            organizationId: contributorId || undefined,
                        },
                        helloAssoPaymentId
                    );
                    completePayment(paymentData, depenseFunding);
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
            } finally {
                polling = false;
            }
        }, 5000);

        return () => clearInterval(verifyInterval);
    }, [isVerifyingPayment, helloAssoPaymentId, effectiveAmount, resourceName, resourceId, activeItemsIds, contributorType, contributorId, t, completePayment, depenseFunding]);

    const isFormComplete = Boolean(
        paymentMethod &&
        contributorType &&
        (contributorType === "citoyens" || (contributorType === "organizations" && contributorId))
    );

    const buildContributionData = () => ({
        amount: effectiveAmount,
        resourceName,
        items: activeItems.map((i) => {
            const allocation = depenseFunding.find((df) => df.depenseIndex === i.depenseIndex);
            return {
                id: i.itemId,
                name: i.name,
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
                amount: effectiveAmount,
            });

            const contributionData = buildContributionData();

            const finalPayload = {
                ...contributionData,
                method: "stripe",
                transactionId: String(stripeData.transactionId || `stripe_${Date.now()}`)
            };
            const paymentData = {
                ...finalPayload,
                ...stripeData,
            }
            completePayment(paymentData, depenseFunding);
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
                amount: effectiveAmount,
                resourceName,
                resourceId,
                itemsIds: Array.from(activeItemsIds),
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
                amount: effectiveAmount,
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

    const saveContributionAsPromise = async ()  => {
        if (!isFormComplete) return;
        try {
            const paymentData: PaymentDataPayload = {
                ...buildContributionData(),
            };
            await completePayment(paymentData, depenseFunding);
        } catch (error) {
            showErrorToast(error, "PaymentConfigPage.toasts.paymentError.title", t);
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
                <Button onClick={onBack} variant="ghost" size="icon" aria-label={String(t("a11y.back"))} disabled={isHelloAssoProcessing}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
            </div>

            <div className="bg-linear-to-r from-primary/20 to-accent/20 rounded-xl p-6 space-y-4">
                <div className="flex items-start gap-4">
                    {resourceImage && (
                        <img src={resourceImage} alt={resourceName} className="w-20 h-20 rounded-lg object-cover" />
                    )}
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{resourceName}</h3>
                        <p className="text-3xl font-bold text-primary">{effectiveAmount.toLocaleString("fr-FR")} €</p>
                        <p className="text-sm text-muted-foreground">
                            {activeItems.length} {String(t("PaymentConfigPage.pledge.selected", undefined, { count: activeItems.length }))}
                        </p>
                    </div>
                </div>

                {activeItems.length > 0 && (
                    <div className="space-y-2 border-t border-border/50 pt-4">
                        <p className="text-sm font-medium text-foreground">{t("PaymentConfigPage.milestonesLabel")}</p>
                        <div className="grid grid-cols-1 gap-2">
                            {activeItems.map((i) => {
                                const allocation = depenseFunding.find(df => df.depenseIndex === i.depenseIndex);
                                const allocatedAmount = allocation?.amount || 0;
                                return (
                                    <div key={i.depenseIndex} className="bg-background/50 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-sm">{i.name}</span>
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
                <p className="text-sm font-medium text-foreground">{t( "PaymentConfigPage.contributorTypeLabel")}</p>
                { cagnotteConfig.allowPersonToFinance && (
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
                )}
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
                        } else if (value === "pledge") {
                            setPaymentMethod("pledge");
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

                    {cagnotteConfig.allowContributionWithoutPaiement && (
                        <ToggleGroupItem
                            value="pledge"
                            aria-label={String(t("PaymentConfigPage.pledge.title"))}
                            className="p-4 rounded-lg border-2 transition-all text-left h-auto justify-start data-[state=on]:bg-primary/20 data-[state=on]:border-primary bg-background border-border hover:border-primary/50"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
                                    <Clock className="w-5 h-5 text-success" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm">{t("PaymentConfigPage.pledge.title")}</p>
                                    <p className="text-xs text-muted-foreground">{t("PaymentConfigPage.pledge.description")}</p>
                                </div>
                            </div>
                        </ToggleGroupItem>
                    )}
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
                                    amount={effectiveAmount}
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
                            : t("PaymentConfigPage.helloasso.button", undefined, { amount: formatNumber(effectiveAmount) })}
                    </Button>
                )}

                {paymentMethod === "pledge" && (
                    <div className="rounded-xl border bg-[var(--color-surface)] p-4 space-y-4">
                        <h3 className="text-sm font-medium">{String(t("PaymentConfigPage.pledge.pledge"))}</h3>
                        <p className="text-sm text-muted-foreground">
                            {String(t("PaymentConfigPage.pledge.confirm", undefined, { amount: effectiveAmount }))}
                        </p>
                        <label className="flex items-start gap-2 text-sm text-muted-foreground">
                            <input type="checkbox" required className="mt-1 accent-[var(--color-primary)]" onChange={acceptCondition}  />
                            <span>{String(t("PaymentConfigPage.pledge.checkbox"))}</span>
                        </label>
                        <Button
                            onClick={saveContributionAsPromise}
                            disabled={!isFormComplete || !acceptPledgeCondition}
                            size="lg"
                            className="w-full h-12 bg-success hover:bg-success/90 text-success-foreground"
                        >
                            {t("PaymentConfigPage.pledge.button", undefined,
                                {
                                    amount: effectiveAmount,
                                    context: cagnotteConfig.selectorType+context
                                }
                            )}
                        </Button>
                    </div>

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