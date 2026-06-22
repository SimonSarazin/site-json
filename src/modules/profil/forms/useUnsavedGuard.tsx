/**
 * Garde GÉNÉRIQUE « modifications non enregistrées » pour les modales de formulaire (config-driven OU
 * descripteur). Réutilise le `ConfirmDialog` (AlertDialog) partagé.
 *
 * Usage dans un hôte modale :
 *   const guard = useUnsavedGuard(onOpenChange);
 *   <Dialog open={open} onOpenChange={guard.guardedOpenChange}>
 *     …<GenericForm onDirtyChange={guard.setDirty} onCancel={() => guard.guardedOpenChange(false)} />…
 *   </Dialog>
 *   {guard.confirmDialog}
 *
 * → fermer (×, Échap, clic extérieur, Annuler) un form RENSEIGNÉ mais non sauvé ouvre une alerte.
 */
import { useCallback, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useT } from "@/hooks/useT";

export function useUnsavedGuard(onOpenChange: (open: boolean) => void): {
  setDirty: (dirty: boolean) => void;
  guardedOpenChange: (open: boolean) => void;
  confirmDialog: ReactNode;
} {
  const t = useT("modules/profil");
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Fermeture (open=false) d'un form dirty → on intercepte et on demande confirmation.
  const guardedOpenChange = useCallback(
    (open: boolean) => {
      if (!open && dirty) {
        setConfirmOpen(true);
        return;
      }
      onOpenChange(open);
    },
    [dirty, onOpenChange],
  );

  const confirmDialog = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      onConfirm={() => {
        setConfirmOpen(false);
        setDirty(false);
        onOpenChange(false);
      }}
      title={t("UnsavedChanges.title")}
      description={t("UnsavedChanges.description")}
      confirmLabel={t("UnsavedChanges.confirm")}
      cancelLabel={t("UnsavedChanges.cancel")}
      isDestructive
    />
  );

  return { setDirty, guardedOpenChange, confirmDialog };
}
