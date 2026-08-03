/**
 * Écran de confirmation affiché après tout paiement réel — qu'il s'agisse
 * du règlement de promesses existantes (PledgePaymentPage) ou d'un
 * financement direct par carte/HelloAsso (CagnotteDialog). Le palier
 * `objectiveReached`, s'il est fourni, s'affiche en plus de la confirmation.
 */
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { formatNumber } from "@/modules/cagnotte/utils/format";
import type { Objective } from "@/modules/cagnotte/types.ts";
import { useState } from "react";

interface PaymentReceivedScreenProps {
    amount: number;
    itemCount?: number;
    objectiveReached?: Objective | null;
    onClose: () => void;
    closeLabel?: string;
}

export function PaymentReceivedScreen({
                                          amount,
                                          itemCount,
                                          objectiveReached,
                                          onClose,
                                          closeLabel,
                                      }: PaymentReceivedScreenProps) {
    const t = useT("modules/cagnotte");
    // amount ET itemCount sont figés au premier rendu : le refresh React Query
    // déclenché après paiement vide la sélection (amount->0, count->0/undefined),
    // ce qui ferait basculer l'écran de « Vos 3 promesses » à « Votre… ».
    //
    // useState plutôt que useRef : l'initialiseur ne s'exécute qu'au montage, ce
    // qui fige la valeur tout autant, mais la LECTURE reste pure. Lire un ref
    // pendant le rendu est interdit par les règles React Compiler, et pour cause
    // — rien ne garantit qu'un rendu concurrent voie la même valeur. Aucun
    // setter n'est exposé : ces deux valeurs ne changent jamais après le montage.
    const [initialAmount] = useState(amount);
    const [frozenItemCount] = useState(itemCount);
    const formattedAmount = formatNumber(initialAmount);

    return (
        <div className="py-10 text-center space-y-4 animate-fade-in flex-1 overflow-y-auto">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="w-10 h-10 text-primary" />
            </div>

            <h3 className="text-2xl font-bold text-foreground">
                {t("PaymentReceivedScreen.title")}
            </h3>
            <p className="text-muted-foreground">
                {frozenItemCount && frozenItemCount > 1
                    ? t("PaymentReceivedScreen.subtitleMultiple", undefined, { count: frozenItemCount, amount: formattedAmount })
                    : t("PaymentReceivedScreen.subtitleSingle", undefined, { amount: formattedAmount })}
            </p>

            {objectiveReached && (
                <div className="mx-auto max-w-sm rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 flex items-center gap-3">
                    <objectiveReached.icon className="w-6 h-6 text-primary shrink-0" />
                    <div className="text-left">
                        <p className="text-sm font-semibold text-primary">
                            {t("PaymentReceivedScreen.objectiveReached.label")}
                        </p>
                        <p className="text-sm text-foreground">{objectiveReached.label}</p>
                    </div>
                </div>
            )}

            <Button onClick={onClose} variant="outline">
                {closeLabel ?? t("PaymentReceivedScreen.closeButton")}
            </Button>
        </div>
    );
}

export default PaymentReceivedScreen;