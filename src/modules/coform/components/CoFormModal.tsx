import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { SmartCoForm } from "./SmartCoForm";
import type { AllStepsData } from "../types";

export interface CoFormModalProps {
  /** ID du formulaire à charger */
  formId: string;
  /** Contrôle l'ouverture du modal */
  open: boolean;
  /** Callback de fermeture */
  onOpenChange: (open: boolean) => void;
  /** Titre affiché dans le header du modal (optionnel) */
  title?: string;
  /** Clé d'une étape à afficher en mode standalone */
  stepKey?: string;
  /** Clé d'un champ unique à afficher (requiert stepKey) */
  inputKey?: string;
  /** ID de la réponse existante à éditer */
  answerId?: string;
  /** Valeurs par défaut pour pré-remplir (mode édition) */
  defaultValues?: AllStepsData;
  /** Mode lecture seule */
  readOnly?: boolean;
  /** Callback exécuté après soumission réussie (avant fermeture automatique) */
  onAfterSubmit?: () => void | Promise<void>;
  /** Fermer automatiquement le modal après soumission (défaut: true) */
  closeOnSubmit?: boolean;
  /** Classe CSS additionnelle pour le contenu du modal */
  className?: string;
  /** Liste de clés d'inputs verrouillés (non modifiables dans le modal) */
  lockedFields?: string[];
  /**
   * ID de l'élément lié au form (lieu, projet, événement…). Active le mode
   * "par élément" backend : `Coform::getFormAccessInfo` calcule alors
   * `access.restrictedFields` à partir de `placeAdminOnlyFields` /
   * `placeMemberOnlyFields`. Requis avec `elementType`.
   */
  elementId?: string;
  /** Type de l'élément (collection MongoDB). Requis si `elementId` fourni. */
  elementType?: "organizations" | "projects" | "events" | "poi" | "citoyens";
}

/**
 * Modal générique pour afficher un formulaire CoForm.
 * Encapsule SmartCoForm dans un Dialog avec gestion de la fermeture automatique.
 */
export function CoFormModal({
  formId,
  open,
  onOpenChange,
  title,
  stepKey,
  inputKey,
  answerId,
  defaultValues,
  readOnly = false,
  onAfterSubmit,
  closeOnSubmit = !inputKey,
  className,
  lockedFields,
  elementId,
  elementType,
}: CoFormModalProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const submitRef = useRef<(() => void) | null>(null);

  // Réinitialise isDirty à la fermeture (propre pour la prochaine ouverture)
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && isDirty && !isSubmitting) {
      setConfirmClose(true);
      return;
    }
    if (!nextOpen) {
      setIsDirty(false);
    }
    onOpenChange(nextOpen);
  }, [isDirty, isSubmitting, onOpenChange]);

  const handleAfterSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onAfterSubmit?.();
    } finally {
      setIsSubmitting(false);
      setIsDirty(false);
      if (closeOnSubmit) {
        onOpenChange(false);
      }
    }
  }, [onAfterSubmit, closeOnSubmit, onOpenChange]);

  const handleConfirmDiscard = useCallback(() => {
    setConfirmClose(false);
    setIsDirty(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleConfirmSave = useCallback(() => {
    setConfirmClose(false);
    submitRef.current?.();
  }, []);

  return (
    <>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{String(t("coform.modal.unsavedTitle"))}</AlertDialogTitle>
            <AlertDialogDescription>
              {String(t("coform.modal.unsavedDescription"))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{String(t("coform.modal.continueEditing"))}</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirmDiscard}>
              {String(t("coform.modal.discardChanges"))}
            </Button>
            <AlertDialogAction onClick={handleConfirmSave}>
              {String(t("coform.modal.save"))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-w-[calc(100%-2rem)] sm:max-w-6xl max-h-[90vh] overflow-y-auto p-0 gap-0"
          onInteractOutside={(e) => {
            if (isSubmitting) e.preventDefault();
          }}
        >
          {title && (
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
          )}
          {!title && (
            <DialogHeader className="sr-only">
              <DialogTitle>{String(t("coform.modal.ariaTitleFallback"))}</DialogTitle>
            </DialogHeader>
          )}

          <div className={className ?? "px-6 pb-6 pt-2"}>
            <SmartCoForm
              formId={formId}
              stepKey={stepKey}
              inputKey={inputKey}
              answerId={answerId}
              defaultValues={defaultValues}
              readOnly={readOnly}
              onAfterSubmit={handleAfterSubmit}
              onDirtyChange={setIsDirty}
              submitRef={submitRef}
              lockedFields={lockedFields}
              elementId={elementId}
              elementType={elementType}
              inModal
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
