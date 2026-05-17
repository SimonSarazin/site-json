/**
 * Écran de succès après un paiement réussi de la cagnotte.
 *
 * Affiche soit une célébration de milestone atteint, soit un simple message
 * de remerciement.
 *
 * Extrait de `CagnotteDialog.tsx` pour réduire la longueur du fichier
 * principal.
 */
import { Check, PartyPopper, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/useT";
import { formatNumber } from "@/modules/cagnotte/utils/format";

export interface MilestoneReached {
  target: number;
  label: string;
  description: string;
}

export interface CagnotteSuccessScreenProps {
  milestoneReached: MilestoneReached | null;
}

export function CagnotteSuccessScreen({ milestoneReached }: CagnotteSuccessScreenProps) {
  const t = useT("modules/cagnotte");

  return (
    <div className="py-12 text-center space-y-4 animate-fade-in">
      {milestoneReached ? (
        <>
          <div className="relative">
            <div className="w-24 h-24 mx-auto rounded-full bg-linear-to-br from-primary/30 to-accent/30 flex items-center justify-center animate-pulse">
              <PartyPopper className="w-12 h-12 text-primary" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8">
              <Sparkles className="w-8 h-8 text-accent animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <Badge className="bg-linear-to-r from-primary to-accent text-primary-foreground text-sm px-4 py-1">
              {t("CagnotteDialog.milestoneCelebration.badge")}
            </Badge>
            <h3 className="text-2xl font-bold text-primary">
              {t("CagnotteDialog.milestoneCelebration.amountReached", undefined, {
                amount: formatNumber(milestoneReached.target),
              })}
            </h3>
            <p className="text-muted-foreground max-w-xs mx-auto">
              {milestoneReached.description}
            </p>
          </div>
          <p className="text-sm text-foreground/80">
            {t("CagnotteDialog.milestoneCelebration.thankYou")}
          </p>
        </>
      ) : (
        <>
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
            <Check className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground">
            {t("CagnotteDialog.successScreen.title")}
          </h3>
          <p className="text-muted-foreground">
            {t("CagnotteDialog.successScreen.subtitle")}
          </p>
        </>
      )}
    </div>
  );
}
