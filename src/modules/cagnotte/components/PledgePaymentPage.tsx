import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    CreditCard,
    ArrowLeft,
    ExternalLink,
    Info,
    ChevronDown,
} from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { formatNumber } from "@/modules/cagnotte/utils/format";
import type { UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";
import { availablePaymentChoices, type PaymentChoice } from "@/modules/cagnotte/utils/paymentMethods";
import { readFundingEnvelopeResponse } from "@/modules/cagnotte/services/fundingEnvelopeResponse";
import { getStripePublicKey } from "@/modules/cagnotte/services/stripeService";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";
import {
    useHelloAssoCheckout,
    type HelloAssoAction,
    type HelloAssoPayment,
} from "@/modules/cagnotte/hooks/useHelloAssoCheckout";
import {
    montantARegler,
    promessesReglables,
    useSaveCagnotteContribution,
} from "@/modules/cagnotte/hooks/useSaveCagnotteContribution";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { launchConfettiBurst } from "@/lib/confetti";
import StripePaymentForm from "./StripePaymentForm";
import { Pledge } from "@/modules/cagnotte/types";
import PaymentReceivedScreen from "@/modules/cagnotte/components/PaymentReceivedScreen.tsx";

interface PledgePaymentPageProps {
    pledges: Pledge[];
    onBack: () => void;
    onClose: () => void;
    onContributionSaved?: () => void | Promise<void>;
    onPaymentSuccess?: (paymentData: Record<string, unknown>) => void;
}

interface PaymentDataPayload extends Record<string, unknown> {
    method?: string;
    transactionId?: string;
}

type PaymentMethod = PaymentChoice | null;

function normalizeFundingContextType(type: string | undefined): string {
    const lowered = (type || "").toLowerCase();
    if (lowered.includes("organization")) return "organizations";
    if (lowered.includes("project")) return "projects";
    if (lowered.includes("citoyen") || lowered.includes("user")) return "citoyens";
    return lowered;
}

export function PledgePaymentPage({ pledges, onBack, onClose, onContributionSaved, onPaymentSuccess }: PledgePaymentPageProps) {
    const navigate = useNavigate();
    const { entity, me, api, contextId, contextType } = useCocolight();
    const queryClient = useQueryClient();
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
    /** Montant et nombre de promesses réglés, affichés une fois le paiement enregistré. */
    const [paidSummary, setPaidSummary] = useState<{ amount: number; count: number } | null>(null);
    const [isPledgesExpanded, setIsPledgesExpanded] = useState(false);
    useLoadNamespace("modules/cagnotte");
    const t = useT("modules/cagnotte");
    const fundingEnvelopeQuery = useFundingEnvelope();
    const fundingPaymentMethods = fundingEnvelopeQuery.data?.paymentMethods ?? fundingEnvelopeQuery.data?.selectedProject?.paymentMethods ?? null;

    const stripePublicKey = fundingPaymentMethods?.stripePublicKey || getStripePublicKey();
    const stripePromise = useMemo(
        () => (stripePublicKey ? loadStripe(stripePublicKey) : null),
        [stripePublicKey]
    );

    // Seuls les moyens configurés pour l'entité sont proposés.
    const isLoadingPaymentMethods = fundingEnvelopeQuery.isLoading;
    const paymentChoices = availablePaymentChoices(fundingPaymentMethods, { stripePublicKey });

    // Désélectionne un moyen retiré, choisit d'office un moyen unique.
    if (!isLoadingPaymentMethods) {
        if (paymentMethod && !paymentChoices.includes(paymentMethod)) {
            setPaymentMethod(null);
        } else if (!paymentMethod && paymentChoices.length === 1) {
            setPaymentMethod(paymentChoices[0]);
        }
    }

    // Montant facturé : solde des promesses réglables, comme dans `payContribution`.
    const payablePledges = useMemo(() => promessesReglables(pledges), [pledges]);
    const amount = payablePledges.reduce((sum, p) => sum + montantARegler(p), 0);

    const { payContribution } = useSaveCagnotteContribution();

    const refreshAfterContributionSave = useCallback(async () => {
        await Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX() }),
            queryClient.invalidateQueries({ queryKey: CAGNOTTE_QUERY_KEYS.ORGANIZATION_PROJECTS_WITH_ANSWERS_PREFIX() }),
            Promise.resolve(onContributionSaved?.()),
        ]);
    }, [queryClient, onContributionSaved]);

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
        action: "stripePay" | HelloAssoAction,
        payload: Record<string, unknown>
    ): Promise<UnknownRecord> => {
        if (!entity || typeof entity.fundingEnvelope !== "function") {
            throw new Error(String(t("PaymentConfigPage.errors.fundingEnvelopeUnavailable")));
        }

        const effectiveContextId = contextId || entity.id;
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

        return readFundingEnvelopeResponse(rawResponse, String(t("PaymentConfigPage.errors.paymentRejected")));
    }, [entity, contextId, contextType, t]);

    const completePayment = useCallback(async (
        paymentData: PaymentDataPayload,
        paidPledges: Pledge[],
    ) => {
        try {
            if (!api) throw new Error(String(t("PaymentConfigPage.errors.noApiClient")));
            const { method, transactionId } = paymentData;
            const saved = await payContribution(paidPledges, method, transactionId);
            if (!saved) throw new Error(String(t("PaymentConfigPage.errors.saveFailed")));
            setPaidSummary({
                amount: paidPledges.reduce((sum, p) => sum + montantARegler(p), 0),
                count: paidPledges.length,
            });
            if(onPaymentSuccess) {
                onPaymentSuccess(paymentData);
            }
            launchConfettiBurst({ originY: 0.34, spread: 84, count: 40 });
        } catch (error) {
            console.error('Erreur completePayment:', error);
            showErrorToast(error, "PaymentConfigPage.toasts.paymentAcceptedIncomplete.title", t);
        } finally {
            await refreshAfterContributionSave();
        }
    }, [api, onPaymentSuccess, payContribution, t, refreshAfterContributionSave]);

    // Règle les promesses figées au clic, une fois le paiement HelloAsso confirmé.
    const handleHelloAssoPaid = ({ checkoutIntentId, orderId }: HelloAssoPayment, paidPledges: Pledge[]) => {
        void completePayment({ method: "helloasso", transactionId: orderId ?? checkoutIntentId }, paidPledges);
    };

    const helloAsso = useHelloAssoCheckout<Pledge[]>({ submit: submitFundingEnvelopeAction, onPaid: handleHelloAssoPaid });

    const isFormComplete = Boolean(paymentMethod) && amount > 0;

    const handleStripePaymentSuccess = async (stripeData: Record<string, unknown>) => {
        try {
            await submitFundingEnvelopeAction("stripePay", {
                amount,
                payment_method_id: String(
                    stripeData.stripePaymentMethodId ||
                    stripeData.paymentMethodId ||
                    stripeData.payment_method_id ||
                    ""
                ),
                email: me?.serverData?.email,
            });

            const finalPayload = {
                method: "stripe",
                transactionId: String(stripeData.transactionId || `stripe_${Date.now()}`)
            };
            completePayment(finalPayload, payablePledges);
        } catch (error) {
            console.error("Erreur financement Stripe via fundingEnvelope:", error);
            showErrorToast(error, "PaymentConfigPage.toasts.stripeError.title", t);
        }
    };

    // Synchrone jusqu'à `start` : la popup doit s'ouvrir pendant le clic.
    const handleHelloAssoPayment = () => {
        if (!isFormComplete) return;
        void helloAsso.start(amount, payablePledges);
    };

    if (paidSummary) {
        return (
            <PaymentReceivedScreen
                amount={paidSummary.amount}
                itemCount={paidSummary.count}
                closeLabel={t("PaymentReceivedScreen.returnHomeButton")}  // "Retour à l'accueil" — cohérent avec redirectToHome
                onClose={() => redirectToHome(false)}
            />
        );
    }

    if (helloAsso.phase === "waiting") {
        return (
            <div className="py-10 text-center space-y-4 animate-fade-in flex-1 overflow-y-auto">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">{t("PaymentConfigPage.waiting.title")}</h3>
                <p className="text-muted-foreground">{t("PaymentConfigPage.waiting.subtitle")}</p>
                <p className="text-xs text-muted-foreground">{t("PaymentConfigPage.waiting.hint")}</p>
                {helloAsso.lastError && (
                    <p className="text-xs text-destructive">{helloAsso.lastError}</p>
                )}
                <Button onClick={helloAsso.cancel} variant="outline">{t("PaymentConfigPage.waiting.cancel")}</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 flex-1 overflow-y-auto h-full w-full">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">{t("PaymentConfigPage.title")}</h2>
                <Button onClick={onBack} variant="ghost" size="icon" aria-label={String(t("a11y.back"))} disabled={helloAsso.phase !== "idle"}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
            </div>

            <div className="bg-linear-to-r from-primary/20 to-accent/20 rounded-xl p-6 space-y-4">
                <div className="flex items-start gap-4">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground">Total:</h3>
                        <p className="text-3xl font-bold text-primary">{formatNumber(amount)} €</p>
                    </div>
                </div>

                {payablePledges.length > 0 && (
                    <div className="space-y-2 border-t border-border/50 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsPledgesExpanded(!isPledgesExpanded)}
                            aria-expanded={isPledgesExpanded}
                            className="flex items-center justify-between w-full group"
                        >
                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                {payablePledges.length} {String(t("Pledges.payform.selectedPledge", undefined, { count: payablePledges.length }))}
                            </span>
                            <ChevronDown 
                                className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${
                                    isPledgesExpanded ? "rotate-180" : ""
                                }`} 
                            />
                        </button>
                        
                        <div
                            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                                isPledgesExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                            }`}
                        >
                            <div className="overflow-hidden">
                                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-2 mt-2 pt-1 pb-1">
                                    {payablePledges.map((i, index) => (
                                        <div key={i.id || `${i.depenseIndex}-${i.fundingIndex}-${index}`} className="bg-background/50 rounded-lg p-3">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-sm truncate mr-2" title={i.depenseName}>
                                                    {i.depenseName}
                                                </span>
                                                <Badge variant="outline" className="shrink-0">
                                                    {formatNumber(montantARegler(i))} €
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">{t("PaymentConfigPage.paymentMethodLabel")}</p>

                {isLoadingPaymentMethods ? (
                    <div
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                        role="status"
                        aria-label={String(t("PaymentConfigPage.paymentMethodsLoading"))}
                    >
                        <Skeleton className="h-16 rounded-lg" />
                        <Skeleton className="h-16 rounded-lg" />
                    </div>
                ) : paymentChoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg border border-border/50">
                        {t("PaymentConfigPage.noPaymentMethod")}
                    </p>
                ) : (
                    <ToggleGroup
                        type="single"
                        value={paymentMethod ?? ""}
                        onValueChange={(value) => {
                            const choice = paymentChoices.find((c) => c === value);
                            if (choice) setPaymentMethod(choice);
                        }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                        {paymentChoices.includes("stripe") && (
                            <ToggleGroupItem
                                value="stripe"
                                aria-label={String(t("PaymentConfigPage.stripe.title"))}
                                className="p-4 rounded-lg border-2 transition-all text-left h-auto justify-start data-[state=on]:bg-primary/20 data-[state=on]:border-primary bg-background border-border hover:border-primary/50"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-info/20 flex items-center justify-center shrink-0">
                                        <CreditCard className="w-5 h-5 text-info" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{t("PaymentConfigPage.stripe.title")}</p>
                                        <p className="text-xs text-muted-foreground">{t("PaymentConfigPage.stripe.description")}</p>
                                    </div>
                                </div>
                            </ToggleGroupItem>
                        )}

                        {paymentChoices.includes("helloasso") && (
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
                        )}
                    </ToggleGroup>
                )}
            </div>

            <div className="space-y-3 pt-4 border-t border-border/50 pb-8">
                {paymentMethod === "stripe" && isFormComplete && (
                    <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                        <p className="text-sm font-medium text-foreground">{t("PaymentConfigPage.stripe.formLabel")}</p>
                        <Elements stripe={stripePromise}>
                            <StripePaymentForm
                                amount={amount}
                                onSuccess={handleStripePaymentSuccess}
                                onError={() => undefined}
                            />
                        </Elements>
                    </div>
                )}

                {paymentMethod === "helloasso" && (
                    <Button
                        onClick={handleHelloAssoPayment}
                        disabled={!isFormComplete || helloAsso.phase !== "idle"}
                        size="lg"
                        className="w-full h-12 bg-success hover:bg-success/90 text-success-foreground"
                    >
                        <ExternalLink className="w-5 h-5 mr-2" />
                        {helloAsso.phase === "opening"
                            ? t("PaymentConfigPage.helloasso.buttonLoading")
                            : t("PaymentConfigPage.helloasso.button", undefined, { amount: formatNumber(amount) })}
                    </Button>
                )}

                {!paymentMethod && paymentChoices.length > 0 && (
                    <Button disabled size="lg" className="w-full h-12">
                        <CreditCard className="w-5 h-5 mr-2" />
                        {t("PaymentConfigPage.selectMethodPlaceholder")}
                    </Button>
                )}
            </div>

            {paymentMethod === "helloasso" && (
                <div className="text-xs text-muted-foreground space-y-2 p-3 bg-muted/30 rounded-md border border-border/50 mb-8">
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

export default PledgePaymentPage;