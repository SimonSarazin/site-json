/** Rappel du déroulé d'un paiement HelloAsso, affiché sous le bouton de paiement. */
import { Info } from "lucide-react";
import { useT } from "@/hooks/useT";

const ITEMS = ["li1", "li2", "li3", "li4", "li5"] as const;

export function HelloAssoInfo({ className = "" }: { className?: string }) {
  const t = useT("modules/cagnotte");

  return (
    <div className={`text-xs text-muted-foreground space-y-2 p-3 bg-muted/30 rounded-md border border-border/50 ${className}`}>
      <p className="font-semibold flex items-center gap-2">
        <Info className="w-3.5 h-3.5" />
        {t("PaymentConfigPage.helloasso.info.title")}
      </p>
      <ul className="space-y-1 ml-3 list-disc">
        {ITEMS.map((item) => (
          <li key={item}>{t(`PaymentConfigPage.helloasso.info.${item}`)}</li>
        ))}
      </ul>
    </div>
  );
}
