import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    CreditCard,
    ArrowLeft,
    ExternalLink,
    ChevronDown,
} from "lucide-react";
import { showSuccessToast } from "@/lib/toastUtils";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { formatNumber } from "@/modules/cagnotte/utils/format";
import { availablePaymentChoices } from "@/modules/cagnotte/utils/paymentMethods";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";
import { useFundingEnvelopeAction } from "@/modules/cagnotte/hooks/useFundingEnvelopeAction";
import { useHelloAssoCheckout } from "@/modules/cagnotte/hooks/useHelloAssoCheckout";
import { usePaymentChoice } from "@/modules/cagnotte/hooks/usePaymentChoice";
import { usePaymentSettlement } from "@/modules/cagnotte/hooks/usePaymentSettlement";
import { useStripeCharge } from "@/modules/cagnotte/hooks/useStripeCharge";
import {
    ligneReglement,
    montantARegler,
    promessesReglables,
    totalARegler,
} from "@/modules/cagnotte/utils/commande";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { launchConfettiBurst } from "@/lib/confetti";
import StripePaymentForm from "./StripePaymentForm";
import { PaymentMethodPicker } from "./parts/PaymentMethodPicker";
import { HelloAssoWaitingScreen } from "./parts/HelloAssoWaitingScreen";
import { PaymentRecordingScreen } from "./parts/PaymentRecordingScreen";
import { HelloAssoInfo } from "./parts/HelloAssoInfo";
import { Pledge } from "@/modules/cagnotte/types";
import PaymentReceivedScreen from "@/modules/cagnotte/components/PaymentReceivedScreen.tsx";

interface PledgePaymentPageProps {
    pledges: Pledge[];
    onBack: () => void;
    onClose: () => void;
    onContributionSaved?: () => void | Promise<void>;
    onPaymentSuccess?: (paymentData: Record<string, unknown>) => void;
}

/** Règlement figé au lancement du paiement, affiché une fois enregistré. */
type PaidSummary = { amount: number; count: number; method: "stripe" | "helloasso" };

export function PledgePaymentPage({ pledges, onBack, onClose, onContributionSaved, onPaymentSuccess }: PledgePaymentPageProps) {
    const navigate = useNavigate();
    const { me } = useCocolight();
    const queryClient = useQueryClient();
    /** Montant et nombre de promesses réglés, affichés une fois le paiement enregistré. */
    const [paidSummary, setPaidSummary] = useState<PaidSummary | null>(null);
    const [isPledgesExpanded, setIsPledgesExpanded] = useState(false);
    useLoadNamespace("modules/cagnotte");
    const t = useT("modules/cagnotte");
    const fundingEnvelopeQuery = useFundingEnvelope();
    const fundingPaymentMethods = fundingEnvelopeQuery.data?.paymentMethods ?? fundingEnvelopeQuery.data?.selectedProject?.paymentMethods ?? null;
    const submit = useFundingEnvelopeAction();

    // Clé publique de l'entité : même compte Stripe que le débit serveur.
    const stripePublicKey = fundingPaymentMethods?.stripePublicKey || "";
    const stripePromise = useMemo(
        () => (stripePublicKey ? loadStripe(stripePublicKey) : null),
        [stripePublicKey]
    );

    // Seuls les moyens configurés pour l'entité sont proposés.
    const isLoadingPaymentMethods = fundingEnvelopeQuery.isLoading;
    const paymentChoices = isLoadingPaymentMethods ? [] : availablePaymentChoices(fundingPaymentMethods, { stripePublicKey });
    const [paymentMethod, setPaymentMethod] = usePaymentChoice(paymentChoices);

    const payablePledges = useMemo(() => promessesReglables(pledges), [pledges]);
    const amount = totalARegler(payablePledges);

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

    // Issue de l'enregistrement serveur d'un paiement encaissé.
    const settlement = usePaymentSettlement<PaidSummary>({
        submit,
        onRecorded: (summary, { reference }) => {
            setPaidSummary(summary);
            onPaymentSuccess?.({ method: summary.method, amount: summary.amount, transactionId: reference ?? undefined });
            launchConfettiBurst({ originY: 0.34, spread: 84, count: 40 });
            void refreshAfterContributionSave();
        },
    });

    const helloAsso = useHelloAssoCheckout<PaidSummary>({ submit, onSettled: settlement.settled });
    // Tentative Stripe non confirmée, gardée par utilisateur.
    const userId = me?.serverData?.id;
    const stripeCharge = useStripeCharge<PaidSummary>({
        submit,
        stripe: stripePromise,
        storageKey: userId ? `cagnotte.stripe.${userId}.pledges` : undefined,
        onSettled: settlement.settled,
    });
    const busy = helloAsso.phase !== "idle" || stripeCharge.phase !== "idle";

    const isFormComplete = Boolean(paymentMethod) && amount > 0;

    /** Commande envoyée au serveur : une ligne par promesse réglée. */
    const buildOrder = () => ({ pledges: payablePledges.map(ligneReglement) });
    const summaryOf = (method: PaidSummary["method"]): PaidSummary => ({ amount, count: payablePledges.length, method });

    // Le serveur débite puis enregistre la commande dans la même requête.
    const handleStripePaymentSuccess = (stripeData: Record<string, unknown>) =>
        stripeCharge.charge(
            {
                amount,
                payment_method_id: String(
                    stripeData.stripePaymentMethodId ||
                    stripeData.paymentMethodId ||
                    stripeData.payment_method_id ||
                    ""
                ),
                email: me?.serverData?.email,
                order: buildOrder(),
            },
            summaryOf("stripe"),
        );

    // Synchrone jusqu'à `start` : la popup doit s'ouvrir pendant le clic.
    const handleHelloAssoPayment = () => {
        if (!isFormComplete || busy) return;
        void helloAsso.start(amount, buildOrder(), summaryOf("helloasso"));
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

    if (settlement.status === "failed" && settlement.settlement) {
        return (
            <PaymentRecordingScreen
                className="flex-1 overflow-y-auto"
                reference={settlement.settlement.reference}
                error={settlement.settlement.error}
                inProgress={settlement.settlement.inProgress}
                retrying={settlement.retrying}
                onRetry={() => void settlement.retry()}
                onClose={onClose}
            />
        );
    }

    if (stripeCharge.phase === "unconfirmed") {
        return (
            <PaymentRecordingScreen
                className="flex-1 overflow-y-auto"
                variant="unconfirmed"
                error={stripeCharge.lastError}
                inProgress={stripeCharge.inProgress}
                retrying={stripeCharge.retrying}
                onRetry={() => void stripeCharge.verify()}
                onClose={onClose}
            />
        );
    }

    if (helloAsso.phase === "waiting" || helloAsso.phase === "checking") {
        return (
            <HelloAssoWaitingScreen
                className="flex-1 overflow-y-auto"
                checking={helloAsso.phase === "checking"}
                lastError={helloAsso.lastError}
                onCancel={helloAsso.cancel}
            />
        );
    }

    return (
        <div className="space-y-6 p-6 flex-1 overflow-y-auto h-full w-full">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">{t("PaymentConfigPage.title")}</h2>
                <Button onClick={onBack} variant="ghost" size="icon" aria-label={String(t("a11y.back"))} disabled={busy}>
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

            <PaymentMethodPicker
                choices={paymentChoices}
                value={paymentMethod}
                onChange={setPaymentMethod}
                isLoading={isLoadingPaymentMethods}
                disabled={busy}
            />

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
                        disabled={!isFormComplete || busy}
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

            {paymentMethod === "helloasso" && <HelloAssoInfo className="mb-8" />}
        </div>
    );
};

export default PledgePaymentPage;
