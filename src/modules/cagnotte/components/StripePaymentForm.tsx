import { useState } from "react";
import type { StripeCardElementChangeEvent } from "@stripe/stripe-js";
import {
    CardElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader, CreditCard, AlertCircle } from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { getStripeErrorMessageKey } from "@/modules/cagnotte/services/stripeService";

interface StripePaymentFormProps {
    amount: number;
    onSuccess: (paymentData: Record<string, unknown>) => void;
    onError: (error: Error) => void;
}

const cardElementOptions = {
    style: {
        base: {
            color: "#6b7280",
            fontSize: "16px",
            fontFamily: '"system-ui", "Segoe UI", "Roboto"',
            "::placeholder": {
                color: "#cbd5e1",
            },
        },
        invalid: {
            color: "#dc2626",
            iconColor: "#dc2626",
        },
    },
};

const StripePaymentForm = ({ amount, onSuccess, onError }: StripePaymentFormProps) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [cardError, setCardError] = useState<string | null>(null);
    const [isCardComplete, setIsCardComplete] = useState(false);
    useLoadNamespace("modules/cagnotte");
    const t = useT("modules/cagnotte");

    const handleCardChange = (event: StripeCardElementChangeEvent) => {
        if (event.error) {
            const errorMessage = String(t(getStripeErrorMessageKey(event.error.code))) || event.error.message;
            setCardError(errorMessage);
            console.warn("Erreur carte Stripe:", event.error.code, "-", errorMessage);
        } else {
            setCardError(null);
        }
        setIsCardComplete(event.complete || false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            setCardError(String(t("StripePaymentForm.errors.notLoaded")));
            return;
        }

        if (!isCardComplete) {
            setCardError(String(t("StripePaymentForm.errors.incompleteCard")));
            return;
        }

        setIsProcessing(true);
        setCardError(null);

        try {
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) {
                throw new Error(String(t("StripePaymentForm.errors.cardElementMissing")));
            }

            // Crée un moyen de paiement Stripe (mode test) avec la carte saisie.
            const { error, paymentMethod } = await stripe.createPaymentMethod({
                type: "card",
                card: cardElement,
            });

            if (error) {
                console.error("Erreur Stripe:", {
                    code: error.code,
                    type: error.type,
                    message: error.message,
                });
                const errorMessage = String(t(getStripeErrorMessageKey(error.code || ""))) || error.message;
                throw new Error(errorMessage || String(t("StripePaymentForm.errors.cardValidationFailed")));
            }

            if (!paymentMethod) {
                throw new Error(String(t("StripePaymentForm.errors.paymentMethodFailed")));
            }

            const paymentData = {
                transactionId: `stripe_sim_${Date.now()}`,
                stripePaymentMethodId: paymentMethod.id,
                stripeCardBrand: paymentMethod.card?.brand || "unknown",
                stripeCardLast4: paymentMethod.card?.last4 || "****",
                method: "stripe",
                amount,
                status: "succeeded",
                timestamp: new Date().toISOString(),
            };

            showSuccessToast("StripePaymentForm.toasts.stripeValidated.title", t, {
                brand: paymentMethod.card?.brand || "bancaire",
                last4: paymentMethod.card?.last4 || "****",
            });
            onSuccess(paymentData);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(t("StripePaymentForm.errors.paymentFallback"));
            console.error("Erreur paiement:", errorMsg);

            setCardError(errorMsg);

            showErrorToast(err, "StripePaymentForm.toasts.paymentError.title", t);

            onError(err instanceof Error ? err : new Error(errorMsg));
        } finally {
            setIsProcessing(false);
        }
    };

    const isButtonDisabled = !stripe || isProcessing || !isCardComplete;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Formulaire carte */}
            <div className={`rounded-md border-2 transition-colors ${
                cardError
                    ? 'border-destructive bg-destructive/10'
                    : isCardComplete
                    ? 'border-success bg-success/10'
                    : 'border-border bg-background'
            } px-3 py-4`}>
                <CardElement
                    options={cardElementOptions}
                    onChange={handleCardChange}
                />
            </div>

            {/* Message d'erreur */}
            {cardError && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                    <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive">{cardError}</p>
                </div>
            )}

            {/* Message de succès */}
            {isCardComplete && !cardError && (
                <div className="flex items-start gap-2 p-3 bg-success/10 border border-success/30 rounded-md">
                    <CreditCard className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <p className="text-sm text-success">{t("StripePaymentForm.cardValid")}</p>
                </div>
            )}

            {/* Bouton de soumission */}
            <Button
                type="submit"
                disabled={isButtonDisabled}
                size="lg"
                className="w-full h-12"
            >
                {isProcessing ? (
                    <>
                        <Loader className="w-5 h-5 animate-spin mr-2" />
                        {t("StripePaymentForm.actions.processing")}
                    </>
                ) : (
                    <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        {t("StripePaymentForm.actions.pay", undefined, { amount })}
                    </>
                )}
            </Button>
        </form>
    );
};

export default StripePaymentForm;
