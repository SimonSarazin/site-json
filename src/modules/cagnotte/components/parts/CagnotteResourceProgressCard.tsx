/**
 * Carte de progression cagnotte d'un projet — affiche le total financé sur la cible
 * + une barre de progression. Sous-composant présentationnel de `CagnotteDialog`.
 */
import { Progress } from "@/components/ui/progress";
import { useT } from "@/hooks/useT";
import { formatNumber } from "@/modules/cagnotte/utils/format";
import { CagnotteTypeConfig } from "../../types";

export interface CagnotteResourceProgressCardProps {
  /** Montant total financé sur le projet (en euros, entier). */
  totalAmount: number;
  /** Cible totale à atteindre (en euros, entier). */
  targetAmount: number;
  /** Configuration de la cagnotte */
  cagnotteConfig: CagnotteTypeConfig;
  /** Pour personalisation des textes à afficher pour certain groupe d'organisation */
  context: string;
}

export function CagnotteResourceProgressCard({
  totalAmount,
  targetAmount,
  cagnotteConfig,
  context
}: CagnotteResourceProgressCardProps) {
  const t = useT("modules/cagnotte");
  const progressPercentage =
    targetAmount > 0 ? Math.min((totalAmount / targetAmount) * 100, 100) : 0;

  return (
    <div className="bg-linear-to-r from-primary/20 to-accent/20 rounded-xl p-6 space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-2">
          {t("CagnotteDialog.labels.resourceCagnotte", undefined, { context: cagnotteConfig.selectorType+context })}
        </p>
        <p className="text-4xl font-bold text-primary">{formatNumber(totalAmount)} €</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t("CagnotteDialog.labels.targetSuffix", undefined, {
            target: formatNumber(targetAmount),
            context: cagnotteConfig.selectorType+context
          })}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{t("common.progress")}</span>
          <span>
            {formatNumber(totalAmount)} € / {formatNumber(targetAmount)} €
          </span>
        </div>
        <Progress value={progressPercentage} className="h-3" />
      </div>
    </div>
  );
}
