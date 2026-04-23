import { useState, useEffect } from "react";
import type { StripeCardElementChangeEvent } from "@stripe/stripe-js";
import {
    CardElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader, CreditCard, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStripeErrorMessage } from "@/utils/payment/stripeService";

interface StripePaymentFormProps {
    amount: number;
    onSuccess: (paymentData: Record<string, unknown>) => void;
    onError: (error: Error) => void;
}

const cardElementOptions = {
    style: {
        base: {
            color: "#1f2937",
            fontSize: "16px",
            fontFamily: '"system-ui", "Segoe UI", "Roboto"',
            "::placeholder": {
                color: "#9ca3af",
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
    const { toast } = useToast();

    const handleCardChange = (event: StripeCardElementChangeEvent) => {
        if (event.error) {
            const errorMessage = getStripeErrorMessage(event.error.code) || event.error.message;
            setCardError(errorMessage);
            console.warn("⚠️ Erreur carte Stripe:", event.error.code, "-", errorMessage);
        } else {
            setCardError(null);
        }
        setIsCardComplete(event.complete || false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            setCardError("Stripe n'est pas chargé");
            return;
        }

        if (!isCardComplete) {
            setCardError("Veuillez remplir les informations de la carte");
            return;
        }

        setIsProcessing(true);
        setCardError(null);

        try {
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) {
                throw new Error("Formulaire carte indisponible");
            }

            // Crée un moyen de paiement Stripe (mode test) avec la carte saisie.
            const { error, paymentMethod } = await stripe.createPaymentMethod({
                type: "card",
                card: cardElement,
            });

            if (error) {
                console.error("❌ Erreur Stripe:", {
                    code: error.code,
                    type: error.type,
                    message: error.message,
                });
                const errorMessage = getStripeErrorMessage(error.code || "") || error.message;
                throw new Error(errorMessage || "Erreur de validation de la carte");
            }

            if (!paymentMethod) {
                throw new Error("Impossible de créer la méthode de paiement");
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

            toast({
                title: " Paiement Stripe validé",
                description: `Carte ${paymentMethod.card?.brand || "bancaire"} •••• ${paymentMethod.card?.last4 || "****"}`,
                duration: 4000,
            });
            onSuccess(paymentData);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Erreur lors du paiement";
            console.error("❌ Erreur paiement:", errorMsg);

            setCardError(errorMsg);

            toast({
                title: "❌ Erreur de paiement",
                description: errorMsg,
                variant: "destructive",
            });

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
                    ? 'border-red-500 bg-red-50/50' 
                    : isCardComplete 
                    ? 'border-green-500 bg-green-50/30'
                    : 'border-border bg-background'
            } px-3 py-4`}>
                <CardElement
                    options={cardElementOptions}
                    onChange={handleCardChange}
                />
            </div>

            {/* Message d'erreur */}
            {cardError && (
                <div className="flex items-start gap-2 p-3 bg-red-50/80 border border-red-200 rounded-md">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">{cardError}</p>
                </div>
            )}

            {/* Message de succès */}
            {isCardComplete && !cardError && (
                <div className="flex items-start gap-2 p-3 bg-green-50/80 border border-green-200 rounded-md">
                    <CreditCard className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-green-700">Carte valide, prêt à être payée</p>
                </div>
            )}

            {/* Section sécurité PCI DSS
            <div className="flex items-start gap-2 p-3 bg-blue-50/50 rounded-md border border-blue-200/50">
                <Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-xs">
                    <p className="font-semibold text-blue-900">🔐 Paiement 100% sécurisé</p>
                    <p className="text-blue-800 mt-1">Stripe est certifié PCI DSS Level 1. Vos données de carte sont chiffrées et jamais stockées sur nos serveurs.</p>
                </div>
            </div>
            */}


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
                        Traitement du paiement...
                    </>
                ) : (
                    <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Payer {amount}€
                    </>
                )}
            </Button>

            {/* Informations de test
            <div className="space-y-2">
                <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-md border border-border/50">
                    <p className="font-semibold">📝 Cartes de test (Mode Test Stripe):</p>
                    <ul className="space-y-0.5 ml-3">
                        <li>✓ <code className="bg-background px-1 rounded text-xs">4242 4242 4242 4242</code> - Succès</li>
                        <li>✓ <code className="bg-background px-1 rounded text-xs">4000 0025 0000 3155</code> - Authentification</li>
                        <li>✓ <code className="bg-background px-1 rounded text-xs">5555 5555 5555 4444</code> - Mastercard</li>
                        <li>✓ Date: future (ex: 12/25), CVC: n'importe quel 3 chiffres</li>
                    </ul>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 p-3 bg-blue-50/50 rounded-md border border-blue-200/50">
                    <p className="font-semibold text-blue-900">🔐 Sécurité:</p>
                    <p className="text-blue-800">Vos données sont chiffrées et sécurisées par Stripe. Aucune information sensible n'est stockée sur nos serveurs.</p>
                </div>
            </div>
            */}

        </form>
    );
};

export default StripePaymentForm;
