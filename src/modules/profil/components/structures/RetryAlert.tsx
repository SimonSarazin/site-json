import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";

import { TOUCH_BUTTON } from "./constants";

interface RetryAlertProps {
  /** Ce qui n'a pas pu être chargé. */
  message: string;
  onRetry: () => void;
  /** Nom accessible du bouton quand « Réessayer » seul serait ambigu (plusieurs alertes à l'écran). */
  retryLabel?: string;
}

/**
 * Échec de chargement dans l'onglet « Structures » : le dire, et proposer de réessayer — liste des
 * structures, créneaux d'une structure, créneaux déposés ailleurs. `role="alert"` : l'échec survient
 * sans action de l'utilisateur, il doit être annoncé.
 */
export function RetryAlert({ message, onRetry, retryLabel }: RetryAlertProps) {
  const t = useT("modules/profil");
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      {message}
      <Button variant="outline" size="sm" className={TOUCH_BUTTON} onClick={onRetry} aria-label={retryLabel}>
        {t("StructuresTab.retry")}
      </Button>
    </div>
  );
}
