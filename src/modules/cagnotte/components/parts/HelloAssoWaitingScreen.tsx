/** Écran d'attente du paiement HelloAsso, popup ouverte. */
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";

interface HelloAssoWaitingScreenProps {
  /** Dernière vérification avant l'arrêt : annulation désactivée. */
  checking: boolean;
  lastError: string | null;
  onCancel: () => void;
  className?: string;
}

export function HelloAssoWaitingScreen({ checking, lastError, onCancel, className = "" }: HelloAssoWaitingScreenProps) {
  const t = useT("modules/cagnotte");

  return (
    <div className={`py-10 text-center space-y-4 animate-fade-in ${className}`}>
      <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <h3 className="text-2xl font-bold text-foreground">
        {checking ? t("PaymentConfigPage.waiting.checking") : t("PaymentConfigPage.waiting.title")}
      </h3>
      {!checking && (
        <>
          <p className="text-muted-foreground">{t("PaymentConfigPage.waiting.subtitle")}</p>
          <p className="text-xs text-muted-foreground">{t("PaymentConfigPage.waiting.hint")}</p>
        </>
      )}
      {lastError && <p className="text-xs text-destructive">{lastError}</p>}
      <Button onClick={onCancel} variant="outline" disabled={checking}>
        {t("PaymentConfigPage.waiting.cancel")}
      </Button>
    </div>
  );
}
