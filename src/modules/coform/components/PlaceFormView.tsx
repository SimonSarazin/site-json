import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Helmet } from "@dr.pogodin/react-helmet";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import { Button } from "@/components/ui/button";
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
import { SmartCoForm } from "./SmartCoForm";
import { getSharedFinderInfo } from "../utils/formParser";
import { useElementSummary } from "../hooks/useElementSummary";
import type { CoFormData, CoFormAccessInfo, AllStepsData } from "../types";

interface PlaceFormViewProps {
  formData: CoFormData;
  access: CoFormAccessInfo | null;
  formId: string;
  placeId: string;
  /**
   * Retour à la liste des lieux. Par défaut on NAVIGUE vers `/coform/:formId/place`
   * (usage page) ; un appelant qui monte cette vue en MODALE fournit ce callback
   * pour revenir à l'étape précédente sans quitter la page. La garde « formulaire
   * modifié » (confirmation avant abandon) s'applique dans les deux cas.
   */
  onBackToList?: () => void;
}

/**
 * Vue détail "par lieu" : pré-remplit le finder partagé avec le lieu sélectionné,
 * verrouille ce champ, et délègue l'édition / readonly à `SmartCoForm` selon le
 * `canAnswer` calculé par le backend.
 */
export function PlaceFormView({ formData, access, formId, placeId, onBackToList }: PlaceFormViewProps) {
  const t = useT("modules/coform");
  const navigate = useNavigate();

  const sharedFinderInfo = useMemo(() => getSharedFinderInfo(formData), [formData]);

  // Résout le résumé du lieu (nom pour la chip + le titre) via le hook entity
  // partagé. La clé RQ est mutualisée avec la résolution d'image de la chip
  // finder (cf. useElementSummary / useFinderElementImages) → un seul fetch
  // pour ce lieu, pas le double appel d'avant (un ici + un dans le finder).
  const { summary: placeSummary, isLoading: placeLoading } = useElementSummary(
    placeId,
    sharedFinderInfo?.type ?? null,
  );
  const placeName = placeSummary?.name ?? null;

  // Pré-remplit le finder en fusionnant proprement avec l'`existingAnswer` du
  // serveur s'il existe (mode édition). On ne pose QUE `{id, name, type}` — la
  // chip résout son image live (l'`img` serait de toute façon stripée au parse).
  const defaultValues = useMemo<AllStepsData | undefined>(() => {
    if (!sharedFinderInfo) return access?.existingAnswer ?? undefined;

    const finderValue = {
      [placeId]: { id: placeId, name: placeName ?? placeId, type: sharedFinderInfo.type },
    };

    const existing = (access?.existingAnswer ?? {}) as Record<string, Record<string, unknown>>;
    const existingSubForm = existing[sharedFinderInfo.subFormId] ?? {};

    const merged: Record<string, Record<string, unknown>> = {
      ...existing,
      [sharedFinderInfo.subFormId]: {
        ...existingSubForm,
        [sharedFinderInfo.fieldName]: finderValue,
      },
    };
    return merged as unknown as AllStepsData;
  }, [sharedFinderInfo, placeName, access?.existingAnswer, placeId]);

  // Tracking de l'état "modifié" du form pour l'intercepter avant navigation.
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  const performBackToList = useCallback(() => {
    if (onBackToList) {
      onBackToList();
      return;
    }
    navigate(`/coform/${formId}/place`);
  }, [onBackToList, navigate, formId]);

  const handleBackToList = useCallback(() => {
    if (isFormDirty) {
      setConfirmLeaveOpen(true);
      return;
    }
    performBackToList();
  }, [isFormDirty, performBackToList]);

  // Après une soumission réussie, le formulaire est sauvegardé donc on peut
  // naviguer sans confirmation — bypass du flow dirty.
  const handleAfterSubmit = useCallback(() => {
    setIsFormDirty(false);
    performBackToList();
  }, [performBackToList]);

  // Pas de finder partagé → form mal configuré pour la vue par lieu.
  if (!sharedFinderInfo) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto p-6">
        <Button variant="ghost" size="sm" onClick={handleBackToList} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          {t("coform.placeView.actions.back")}
        </Button>
        <p className="text-sm text-muted-foreground italic">
          {t("coform.placeView.empty.notApplicable")}
        </p>
      </div>
    );
  }

  // Access KO : le serveur a refusé (pas autorisé pour ce lieu).
  if (access && !access.canAnswer && !access.existingAnswerId) {
    const reasonKey =
      access.reason === "not_authorized"
        ? "coform.placeView.guard.notAuthorized"
        : "coform.placeView.guard.pendingValidation";
    return (
      <div className="space-y-4 max-w-3xl mx-auto p-6">
        <Button variant="ghost" size="sm" onClick={handleBackToList} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          {t("coform.placeView.actions.back")}
        </Button>
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{t(reasonKey)}</p>
        </div>
      </div>
    );
  }

  if (placeLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Mode lecture seule si réponse existante mais pas de droit d'édition.
  const readOnly = !!access?.existingAnswerId && !access.canAnswer;

  const formName = formData?.name ?? "";
  const documentTitle = placeName ? `${formName} — ${placeName}` : formName;

  return (
    <div className="space-y-4 max-w-5xl mx-auto p-6">
      {documentTitle && (
        <Helmet>
          <title>{documentTitle}</title>
        </Helmet>
      )}

      <Button variant="ghost" size="sm" onClick={handleBackToList} className="gap-1 -ml-2">
        <ChevronLeft className="h-4 w-4" />
        {t("coform.placeView.actions.back")}
      </Button>

      <SmartCoForm
        formId={formId}
        formData={formData}
        defaultValues={defaultValues}
        answerId={access?.existingAnswerId ?? undefined}
        lockedFields={[sharedFinderInfo.fieldName]}
        readOnly={readOnly}
        existingAnswerMeta={access?.existingAnswerMeta ?? null}
        onDirtyChange={setIsFormDirty}
        onAfterSubmit={handleAfterSubmit}
      />

      {/* Confirm dialog pour quitter avec des modifications non sauvegardées.
          Aligné sur le pattern de CoFormModal (close avec dirty). */}
      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("coform.placeView.confirmLeave.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("coform.placeView.confirmLeave.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("coform.placeView.confirmLeave.stay")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeaveOpen(false);
                performBackToList();
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t("coform.placeView.confirmLeave.leave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
