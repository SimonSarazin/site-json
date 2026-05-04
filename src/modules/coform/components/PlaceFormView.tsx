import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import { Button } from "@/components/ui/button";
import { SmartCoForm } from "./SmartCoForm";
import { getSharedFinderInfo } from "../utils/formParser";
import type { CoFormData, CoFormAccessInfo, AllStepsData } from "../types";
import type { Organization } from "@communecter/cocolight-api-client";

interface PlaceFormViewProps {
  formData: CoFormData;
  access: CoFormAccessInfo | null;
  formId: string;
  placeId: string;
}

/**
 * Vue détail "par lieu" : pré-remplit le finder partagé avec le lieu sélectionné,
 * verrouille ce champ, et délègue l'édition / readonly à `SmartCoForm` selon le
 * `canAnswer` calculé par le backend.
 */
export function PlaceFormView({ formData, access, formId, placeId }: PlaceFormViewProps) {
  const t = useT("modules/coform");
  const navigate = useNavigate();
  const { api } = useCocolight();

  // Charge l'organization pour avoir son nom (affiché dans la chip du finder).
  const [place, setPlace] = useState<Organization | null>(null);
  const [placeLoading, setPlaceLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!api || !placeId) {
        setPlaceLoading(false);
        return;
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fetched = await (api as any).organization({ id: placeId });
        if (!cancelled) {
          setPlace(fetched);
          setPlaceLoading(false);
        }
      } catch (err) {
        console.warn("[PlaceFormView] organization fetch failed", err);
        if (!cancelled) setPlaceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, placeId]);

  const sharedFinderInfo = useMemo(() => getSharedFinderInfo(formData), [formData]);

  // Pré-remplit le finder en fusionnant proprement avec l'`existingAnswer` du
  // serveur s'il existe (mode édition).
  const defaultValues = useMemo<AllStepsData | undefined>(() => {
    if (!sharedFinderInfo) return access?.existingAnswer ?? undefined;
    if (!place) return access?.existingAnswer ?? undefined;

    const data = (place as unknown as { serverData?: Record<string, unknown> }).serverData ?? {};
    const placeName =
      (data.name as string) || (place as unknown as { name?: string }).name || placeId;

    const finderValue = {
      [placeId]: { id: placeId, name: placeName, type: sharedFinderInfo.type },
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
  }, [sharedFinderInfo, place, access?.existingAnswer, placeId]);

  const handleBackToList = () => {
    navigate(`/coform/${formId}/place`);
  };

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

  return (
    <div className="space-y-4 max-w-5xl mx-auto p-6">
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
        onAfterSubmit={handleBackToList}
      />
    </div>
  );
}
