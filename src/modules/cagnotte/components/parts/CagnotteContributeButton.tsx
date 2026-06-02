/**
 * Bouton "Contribuer" du `CagnotteDialog`. Affiche le montant courant et un spinner
 * pendant le traitement. Sous-composant présentationnel.
 */
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";

export interface CagnotteContributeButtonProps {
  /** `null` quand aucun montant n'est sélectionné — le bouton ne doit alors pas s'afficher. */
  selectedAmountType: "predefined" | "custom" | null;
  selectedPredefinedAmount: number | null;
  customAmount: string;
  isProcessing: boolean;
  /** `true` si tous les pré-requis (projet, milestones, montant > 0) sont satisfaits. */
  isContributionEnabled: boolean;
  onClick: () => void;
}

export function CagnotteContributeButton({
  selectedAmountType,
  selectedPredefinedAmount,
  customAmount,
  isProcessing,
  isContributionEnabled,
  onClick,
}: CagnotteContributeButtonProps) {
  const t = useT("modules/cagnotte");

  if (selectedAmountType !== "predefined" && selectedAmountType !== "custom") {
    return null;
  }

  const amountLabel =
    selectedAmountType === "predefined" && selectedPredefinedAmount !== null
      ? `${selectedPredefinedAmount}€`
      : selectedAmountType === "custom" && customAmount
        ? `${customAmount}€`
        : "";

  return (
    <div className="flex justify-center">
      <Button
        onClick={onClick}
        disabled={isProcessing || !isContributionEnabled}
        className="h-12 px-8"
        size="lg"
      >
        {isProcessing ? (
          <>
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
            {t("CagnotteDialog.labels.processing")}
          </>
        ) : (
          <>
            {t("CagnotteDialog.labels.contribute")} {amountLabel}
          </>
        )}
      </Button>
    </div>
  );
}
