/**
 * Sélecteur de montant pour la contribution à la cagnotte.
 *
 * Combine un ToggleGroup pour les montants prédéfinis et un Input pour un
 * montant personnalisé.
 *
 * Extrait de `CagnotteDialog.tsx` pour réduire la longueur du fichier
 * principal.
 */
import type { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useT } from "@/hooks/useT";
import { formatNumber } from "@/modules/cagnotte/utils/format";

export type SelectedAmountType = "predefined" | "custom" | null;

export interface CagnotteAmountPickerProps {
  predefinedAmounts: number[];
  selectedAmountType: SelectedAmountType;
  selectedPredefinedAmount: number | null;
  customAmount: string;
  maxContributionAmount: number;
  remainingToFinanceAmount: number;
  isProcessing: boolean;
  onPredefinedAmountClick: (amount: number) => void;
  onCustomAmountChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function CagnotteAmountPicker({
  predefinedAmounts,
  selectedAmountType,
  selectedPredefinedAmount,
  customAmount,
  maxContributionAmount,
  remainingToFinanceAmount,
  isProcessing,
  onPredefinedAmountClick,
  onCustomAmountChange,
}: CagnotteAmountPickerProps) {
  const t = useT("modules/cagnotte");

  return (
    <>
      {/* Predefined Amounts - Radio Button Style */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          {t("CagnotteDialog.labels.amountSection")}
        </p>
        {remainingToFinanceAmount > 0 && (
          <div className="bg-accent/20 border border-accent/50 rounded-lg p-3">
            <p className="text-sm text-foreground font-medium">
              {t("CagnotteDialog.labels.remainingToFinance")}{" "}
              <span className="text-lg font-bold text-accent">
                {formatNumber(remainingToFinanceAmount)}€
              </span>
            </p>
          </div>
        )}
        <ToggleGroup
          type="single"
          value={
            selectedAmountType === "predefined" && selectedPredefinedAmount != null
              ? String(selectedPredefinedAmount)
              : ""
          }
          onValueChange={(value) => {
            if (!value) return;
            const numericValue = Number(value);
            if (Number.isFinite(numericValue)) {
              onPredefinedAmountClick(numericValue);
            }
          }}
          className="grid grid-cols-4 gap-3"
        >
          {predefinedAmounts.map((amount) => {
            const isDisabled = amount > maxContributionAmount || isProcessing;
            return (
              <ToggleGroupItem
                key={amount}
                value={String(amount)}
                disabled={isDisabled}
                aria-label={`${amount}€`}
                className={`h-14 text-lg font-semibold rounded-md transition-all border-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary bg-background border-border hover:border-primary hover:text-primary ${
                  isDisabled
                    ? "opacity-50 cursor-not-allowed hover:border-border hover:text-foreground"
                    : ""
                }`}
              >
                {amount}€
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      {/* Custom Amount */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          {t("CagnotteDialog.labels.customAmountSection")}
        </p>
        <div className="relative">
          <Input
            type="number"
            placeholder={String(t("CagnotteDialog.labels.customAmountPlaceholder"))}
            value={customAmount}
            onChange={onCustomAmountChange}
            className="pr-8 h-12 text-lg"
            min="1"
            max={Math.max(maxContributionAmount, 0)}
            disabled={isProcessing || maxContributionAmount <= 0}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            €
          </span>
        </div>
      </div>
    </>
  );
}
