/**
 * Paiement sans issue confirmée : `unrecorded` (encaissé, non enregistré) rejoue l'enregistrement de la
 * facture ; `unconfirmed` (débit Stripe sans réponse) rejoue la même requête.
 */
import { AlertTriangle, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";

interface PaymentRecordingScreenProps {
  variant?: "unrecorded" | "unconfirmed";
  reference?: string | null;
  error: string | null;
  /** Un autre appel enregistre la facture, ou le débit n'est pas encore confirmé. */
  inProgress?: boolean;
  retrying: boolean;
  onRetry: () => void;
  onClose: () => void;
  className?: string;
}

export function PaymentRecordingScreen({
  variant = "unrecorded",
  reference = null,
  error,
  inProgress,
  retrying,
  onRetry,
  onClose,
  className = "",
}: PaymentRecordingScreenProps) {
  const t = useT("modules/cagnotte");
  const keys = variant === "unconfirmed" ? "PaymentConfigPage.paymentUnconfirmed" : "PaymentConfigPage.recordingFailed";

  return (
    <div className={`py-10 text-center space-y-4 animate-fade-in ${className}`}>
      <div className="w-20 h-20 mx-auto rounded-full bg-destructive/15 flex items-center justify-center">
        <AlertTriangle className="w-10 h-10 text-destructive" />
      </div>
      <h3 className="text-2xl font-bold text-foreground">{t(`${keys}.title`)}</h3>
      <p className="text-muted-foreground">
        {t(`${keys}.description`, undefined, { reference: reference ?? "—" })}
      </p>
      {inProgress && <p className="text-xs text-muted-foreground">{t(`${keys}.inProgress`)}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Button onClick={onRetry} disabled={retrying}>
          {retrying && <Loader className="w-4 h-4 mr-2 animate-spin" />}
          {t(`${keys}.retry`)}
        </Button>
        <Button onClick={onClose} variant="outline" disabled={retrying}>
          {t(`${keys}.close`)}
        </Button>
      </div>
    </div>
  );
}
