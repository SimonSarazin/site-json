import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCoFormQuery } from "@/modules/coform/hooks/useCoFormQuery";
import { PlacesListView } from "@/modules/coform/components/PlacesListView";
import { PlaceFormView } from "@/modules/coform/components/PlaceFormView";

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
 * pas dupliquée.
 */
export default function ToolsAnswerDialog({ formId, open, onOpenChange }: ToolsAnswerDialogProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/toolsCatalog");
  const tc = useT("modules/coform");
  const [placeId, setPlaceId] = useState<string | null>(null);

  // Le detail d'un lieu demande l'access PORTANT SUR LA RÉPONSE PARTAGÉE (mode
  // élément), d'où elementId/elementType — comme `CoFormPlacePage`.
  const { formData, access, isLoading, error } = useCoFormQuery({
    formId,
    enabled: open,
    elementId: placeId ?? undefined,
    elementType: placeId ? "organizations" : undefined,
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) setPlaceId(null); // repartir de la liste à la réouverture
    onOpenChange(next);
  };

  return (
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
              onBackToList={() => setPlaceId(null)}
            />
          ) : (
            <PlacesListView formData={formData} formId={formId} onOpenPlace={setPlaceId} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
