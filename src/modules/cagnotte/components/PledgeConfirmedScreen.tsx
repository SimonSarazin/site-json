/**
 * Écran de confirmation affiché après un engagement SANS paiement immédiat
 * (promesse enregistrée via saveContribution sans `method`). Distinct de
 * PaymentReceivedScreen : ici, aucun argent n'a encore été transféré.
 */
import { Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { formatNumber } from "@/modules/cagnotte/utils/format";

interface PledgeConfirmedScreenProps {
    amount: number;
    itemCount?: number;
    onClose: () => void;
    closeLabel?: string;
}

export function PledgeConfirmedScreen({
                                          amount,
                                          itemCount,
                                          onClose,
                                          closeLabel,
                                      }: PledgeConfirmedScreenProps) {
    const t = useT("modules/cagnotte");
    const formattedAmount = formatNumber(amount);

    return (
        <div className="py-10 text-center space-y-4 animate-fade-in flex-1 overflow-y-auto">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                <Handshake className="w-10 h-10 text-primary" />
            </div>

            <h3 className="text-2xl font-bold text-foreground">
                {t("PledgeConfirmedScreen.title")}
            </h3>
            <p className="text-muted-foreground">
                {itemCount && itemCount > 1
                    ? t("PledgeConfirmedScreen.subtitleMultiple", undefined, { count: itemCount, amount: formattedAmount })
                    : t("PledgeConfirmedScreen.subtitleSingle", undefined, { amount: formattedAmount })}
            </p>
            <p className="text-xs text-muted-foreground">
                {t("PledgeConfirmedScreen.hint")}
            </p>

            <Button onClick={onClose} variant="outline">
                {closeLabel ?? t("PledgeConfirmedScreen.closeButton")}
            </Button>
        </div>
    );
}

export default PledgeConfirmedScreen;