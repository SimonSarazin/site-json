/**
 * Carte de progression cagnotte d'un projet — affiche le total financé sur la cible
 * + une barre de progression. Sous-composant présentationnel de `CagnotteDialog`.
 */
import { Progress } from "@/components/ui/progress";
import { useT } from "@/hooks/useT";
import { formatNumber } from "@/modules/cagnotte/utils/format";

export interface CagnotteProjectProgressCardProps {
  /** Montant total financé sur le projet (en euros, entier). */
  totalAmount: number;
  /** Cible totale à atteindre (en euros, entier). */
  targetAmount: number;
}

export function CagnotteProjectProgressCard({
  totalAmount,
  targetAmount,
}: CagnotteProjectProgressCardProps) {
  const t = useT("modules/cagnotte");
  const progressPercentage =
    targetAmount > 0 ? Math.min((totalAmount / targetAmount) * 100, 100) : 0;

  return (
    <div className="bg-linear-to-r from-primary/20 to-accent/20 rounded-xl p-6 space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-2">
          {t("CagnotteDialog.labels.projectCagnotte")}
        </p>
        <p className="text-4xl font-bold text-primary">{formatNumber(totalAmount)} €</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t("CagnotteDialog.labels.targetSuffix", undefined, {
            target: formatNumber(targetAmount),
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
