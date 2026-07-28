import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { asRecord, toSafeInt, type UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";
import { openHelloAssoPaymentWithCheckout } from "@/modules/cagnotte/services/helloAssoCheckoutIntent";
import { verifyHelloAssoCheckoutStatus } from "@/modules/cagnotte/services/helloAssoVerification";
import { getStripePublicKey } from "@/modules/cagnotte/services/stripeService";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";
import { useSaveCagnotteContribution } from "@/modules/cagnotte/hooks/useSaveCagnotteContribution";
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

type PaymentMethod = "stripe" | "helloasso" | null;

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

export function PledgePaymentPage({ pledges, onBack, onClose, onContributionSaved, onPaymentSuccess }: PledgePaymentPageProps) {
    const navigate = useNavigate();
    const { entity, me, api, contextId, contextType } = useCocolight();
    const queryClient = useQueryClient();
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
    const [isHelloAssoProcessing, setIsHelloAssoProcessing] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [helloAssoPaymentId, setHelloAssoPaymentId] = useState<string | null>(null);
    const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
    const [isWaitingHelloAssoCallback, setIsWaitingHelloAssoCallback] = useState(false);
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

    const amount = pledges.reduce((sum, p) => sum + toSafeInt(p.fundingAmount), 0);

    const stripeUnavailableReason = !stripePublicKey
        ? String(t("PaymentConfigPage.errors.stripeUnavailable"))
        : null;

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
        action: "stripePay" | "helloassoPay" ,
        payload: Record<string, unknown>
    ) => {
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

        const response = normalizeFundingEnvelopeResponse(rawResponse);

        if (typeof response.error === "string" && response.error) {
            throw new Error(response.error);
        }

        if (typeof response.message === "string" && response.message.toLowerCase().includes("error")) {
            throw new Error(response.message);
        }

        return response;
    }, [entity, contextId, contextType, t]);

    const completePayment = useCallback(async (
        paymentData: PaymentDataPayload
    ) => {
        try {
            if (!api) throw new Error(String(t("PaymentConfigPage.errors.noApiClient")));
            const { method, transactionId } = paymentData;
            const saved = await payContribution(pledges, method, transactionId);
            if (!saved) throw new Error(String(t("PaymentConfigPage.errors.saveFailed")));
            setPaymentSuccess(true);
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
    }, [api, onPaymentSuccess, payContribution, pledges, t, refreshAfterContributionSave]);

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

            setIsVerifyingPayment(true);
        };

        window.addEventListener("message", handleHelloAssoCallback);
        return () => window.removeEventListener("message", handleHelloAssoCallback);
    }, [helloAssoPaymentId, t]);

    useEffect(() => {
        if (!isVerifyingPayment || !helloAssoPaymentId) return;

        const verifyInterval = setInterval(async () => {
            const verification = await verifyHelloAssoCheckoutStatus(helloAssoPaymentId);

            if (verification.isValid) {
                clearInterval(verifyInterval);
                setIsVerifyingPayment(false);
                setIsHelloAssoProcessing(false);

                const finalPayload = {
                    method: "helloasso",
                    transactionId: helloAssoPaymentId
                };
                completePayment(finalPayload);
            } else if (verification.status === "failed") {
                clearInterval(verifyInterval);
                setIsVerifyingPayment(false);
                setIsHelloAssoProcessing(false);
                showErrorToast(
                    new Error(verification.error || String(t("PaymentConfigPage.toasts.paymentFailed.fallbackDescription"))),
                    "PaymentConfigPage.toasts.paymentFailed.title",
                    t,
                );
            }
        }, 5000);

        return () => clearInterval(verifyInterval);
    }, [isVerifyingPayment, helloAssoPaymentId, amount, t, completePayment]);

    const isFormComplete = Boolean(paymentMethod);

    const handleStripePaymentSuccess = async (stripeData: Record<string, unknown>) => {
        try {
            await submitFundingEnvelopeAction("stripePay", {
                amount,
                payment_method_id: String(
                    stripeData.stripePaymentMethodId ||
                    stripeData.paymentMethodId ||
                    stripeData.payment_method_id ||
                    ""
                )
            });

            const finalPayload = {
                method: "stripe",
                transactionId: String(stripeData.transactionId || `stripe_${Date.now()}`)
            };
            completePayment(finalPayload);
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
            <PaymentReceivedScreen
                amount={amount}
                itemCount={pledges.length}
                closeLabel={t("PaymentReceivedScreen.returnHomeButton")}  // "Retour à l'accueil" — cohérent avec redirectToHome
                onClose={() => redirectToHome(false)}
            />
        );
    }

    if (isVerifyingPayment) {
        return (
            <div className="py-10 text-center space-y-4 animate-fade-in flex-1 overflow-y-auto">
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
            <div className="py-10 text-center space-y-4 animate-fade-in flex-1 overflow-y-auto">
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
        <div className="space-y-6 p-6 flex-1 overflow-y-auto h-full w-full">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">{t("PaymentConfigPage.title")}</h2>
                <Button onClick={onBack} variant="ghost" size="icon" aria-label={String(t("a11y.back"))} disabled={isHelloAssoProcessing}>
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

                {pledges.length > 0 && (
                    <div className="space-y-2 border-t border-border/50 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsPledgesExpanded(!isPledgesExpanded)}
                            aria-expanded={isPledgesExpanded}
                            className="flex items-center justify-between w-full group"
                        >
                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                {pledges.length} {String(t("Pledges.payform.selectedPledge", undefined, { count: pledges.length }))}
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
                                    {pledges.map((i, index) => (
                                        <div key={i.id || `${i.depenseIndex}-${i.fundingIndex}-${index}`} className="bg-background/50 rounded-lg p-3">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-sm truncate mr-2" title={i.depenseName}>
                                                    {i.depenseName}
                                                </span>
                                                <Badge variant="outline" className="shrink-0">
                                                    {formatNumber(i.fundingAmount)} €
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

            <div className="space-y-3 pt-4 border-t border-border/50 pb-8">
                {paymentMethod === "stripe" && (
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
                            : t("PaymentConfigPage.helloasso.button", undefined, { amount: formatNumber(amount) })}
                    </Button>
                )}

                {!paymentMethod && (
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