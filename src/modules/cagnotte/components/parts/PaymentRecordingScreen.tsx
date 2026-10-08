/** Paiement encaissé mais non enregistré : affiche la référence et rejoue l'enregistrement de la facture. */
import { AlertTriangle, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";

interface PaymentRecordingScreenProps {
  reference: string | null;
  error: string | null;
  /** Un autre appel enregistre la facture en ce moment. */
  inProgress?: boolean;
  retrying: boolean;
  onRetry: () => void;
  onClose: () => void;
  className?: string;
}

export function PaymentRecordingScreen({ reference, error, inProgress, retrying, onRetry, onClose, className = "" }: PaymentRecordingScreenProps) {
  const t = useT("modules/cagnotte");

  return (
    <div className={`py-10 text-center space-y-4 animate-fade-in ${className}`}>
      <div className="w-20 h-20 mx-auto rounded-full bg-destructive/15 flex items-center justify-center">
        <AlertTriangle className="w-10 h-10 text-destructive" />
      </div>
      <h3 className="text-2xl font-bold text-foreground">{t("PaymentConfigPage.recordingFailed.title")}</h3>
      <p className="text-muted-foreground">
        {t("PaymentConfigPage.recordingFailed.description", undefined, { reference: reference ?? "—" })}
      </p>
      {inProgress && <p className="text-xs text-muted-foreground">{t("PaymentConfigPage.recordingFailed.inProgress")}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Button onClick={onRetry} disabled={retrying}>
          {retrying && <Loader className="w-4 h-4 mr-2 animate-spin" />}
          {t("PaymentConfigPage.recordingFailed.retry")}
        </Button>
        <Button onClick={onClose} variant="outline" disabled={retrying}>
          {t("PaymentConfigPage.recordingFailed.close")}
        </Button>
      </div>
    </div>
  );
}
