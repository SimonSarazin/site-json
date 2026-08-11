import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCoFormQuery } from "@/modules/coform/hooks/useCoFormQuery";
import { PlacesListView } from "@/modules/coform/components/PlacesListView";
import { PlaceFormView } from "@/modules/coform/components/PlaceFormView";
import { TOOLS_CATALOG_QUERY_KEYS } from "../constants/queryKeys";

interface ToolsAnswerDialogProps {
  /** Form d'usage auquel on répond (celui du catalogue). */
  formId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Réponse au formulaire d'usage EN MODALE — même parcours que la page
 * `/coform/:formId/place` (choix du lieu puis réponse partagée du lieu), mais sans
 * quitter le catalogue.
 *
 * Réutilise les deux vues de la page via leurs échappatoires de navigation
 * (`onOpenPlace` / `onBackToList`) : la logique métier (lieux éligibles, adhésion,
 * pré-remplissage et verrouillage du finder, garde « formulaire modifié ») n'est
 * pas dupliquée. La garde interne des vues ne couvre que LEUR bouton retour : les
 * voies de fermeture du Dialog (Échap, clic overlay) sont interceptées ici via
 * `onDirtyChange`, comme le fait `CoFormModal`.
 */
export default function ToolsAnswerDialog({ formId, open, onOpenChange }: ToolsAnswerDialogProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/toolsCatalog");
  const tc = useT("modules/coform");
  const queryClient = useQueryClient();
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  // Le detail d'un lieu demande l'access PORTANT SUR LA RÉPONSE PARTAGÉE (mode
  // élément), d'où elementId/elementType — comme `CoFormPlacePage`.
  const { formData, access, isLoading, error } = useCoFormQuery({
    formId,
    enabled: open,
    elementId: placeId ?? undefined,
    elementType: placeId ? "organizations" : undefined,
  });

  const handleOpenChange = (next: boolean) => {
    if (!next && formDirty) {
      setConfirmClose(true);
      return;
    }
    if (!next) {
      setPlaceId(null); // repartir de la liste à la réouverture
      setFormDirty(false);
    }
    onOpenChange(next);
  };

  const handleConfirmDiscard = () => {
    setConfirmClose(false);
    setFormDirty(false);
    setPlaceId(null);
    onOpenChange(false);
  };

  const handleBackToList = () => {
    setPlaceId(null);
    setFormDirty(false); // le form est démonté, son dirty ne doit pas survivre
  };

  // La mutation coform (SmartCoForm) n'invalide que les clés coform : on fait ici
  // le pont vers les caches du catalogue, sinon compteurs d'usage et listes
  // d'utilisateurs d'outils restent périmés jusqu'à un rechargement complet.
  const handleAfterSubmit = () => {
    queryClient.invalidateQueries({ queryKey: TOOLS_CATALOG_QUERY_KEYS.LIST_PREFIX });
    queryClient.invalidateQueries({ queryKey: TOOLS_CATALOG_QUERY_KEYS.TOOL_USERS_PREFIX });
  };

  return (
    <>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc("coform.placeView.confirmLeave.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tc("coform.placeView.confirmLeave.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("coform.placeView.confirmLeave.stay")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDiscard}
              className="bg-destructive hover:bg-destructive/90"
            >
              {tc("coform.placeView.confirmLeave.leave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("answerButton")}</DialogTitle>
            <DialogDescription className="sr-only">{t("answerDialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="-mx-6 flex-1 overflow-y-auto px-6">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error || !formData ? (
              <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">
                  {(error as Error | null)?.message || tc("coform.errors.formNotFound")}
                </p>
              </div>
            ) : placeId ? (
              <PlaceFormView
                formData={formData}
                access={access}
                formId={formId}
                placeId={placeId}
                onBackToList={handleBackToList}
                onDirtyChange={setFormDirty}
                onAfterSubmit={handleAfterSubmit}
                hidePageChrome
              />
            ) : (
              <PlacesListView
                formData={formData}
                formId={formId}
                onOpenPlace={setPlaceId}
                hidePageChrome
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
