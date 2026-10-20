/** Choix du moyen de paiement, avec squelette au chargement et message s'il n'y en a aucun. */
import { Clock, CreditCard, ExternalLink, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useT } from "@/hooks/useT";
import type { PaymentChoice } from "@/modules/cagnotte/utils/paymentMethods";

const CARDS: Record<PaymentChoice, { icon: LucideIcon; iconBox: string; iconColor: string }> = {
  stripe: { icon: CreditCard, iconBox: "bg-info/20", iconColor: "text-info" },
  helloasso: { icon: ExternalLink, iconBox: "bg-success/20", iconColor: "text-success" },
  pledge: { icon: Clock, iconBox: "bg-success/20", iconColor: "text-success" },
};

interface PaymentMethodPickerProps {
  choices: PaymentChoice[];
  value: PaymentChoice | null;
  onChange: (choice: PaymentChoice) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function PaymentMethodPicker({ choices, value, onChange, isLoading, disabled }: PaymentMethodPickerProps) {
  const t = useT("modules/cagnotte");

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{t("PaymentConfigPage.paymentMethodLabel")}</p>
      {isLoading ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          role="status"
          aria-label={String(t("PaymentConfigPage.paymentMethodsLoading"))}
        >
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      ) : choices.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg border border-border/50">
          {t("PaymentConfigPage.noPaymentMethod")}
        </p>
      ) : (
        <ToggleGroup
          type="single"
          value={value ?? ""}
          onValueChange={(next) => {
            const choice = choices.find((c) => c === next);
            if (choice) onChange(choice);
          }}
          disabled={disabled}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {choices.map((choice) => {
            const { icon: Icon, iconBox, iconColor } = CARDS[choice];
            return (
              <ToggleGroupItem
                key={choice}
                value={choice}
                aria-label={String(t(`PaymentConfigPage.${choice}.title`))}
                className="p-4 rounded-lg border-2 transition-all text-left h-auto justify-start data-[state=on]:bg-primary/20 data-[state=on]:border-primary bg-background border-border hover:border-primary/50"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${iconBox} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{t(`PaymentConfigPage.${choice}.title`)}</p>
                    <p className="text-xs text-muted-foreground">{t(`PaymentConfigPage.${choice}.description`)}</p>
                  </div>
                </div>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      )}
    </div>
  );
}
