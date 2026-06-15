import { useParams } from "react-router";
import { Loader2, AlertCircle } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCoFormQuery } from "../hooks/useCoFormQuery";
import { PlacesListView } from "../components/PlacesListView";
import { PlaceFormView } from "../components/PlaceFormView";
import "../i18n/i18n";

/**
 * Page de la vue collaborative "par lieu" :
 * - `/coform/:formId/place`              → liste des lieux du user
 * - `/coform/:formId/place/:placeId`     → vue détail / édition pour le lieu
 *
 * Pour la vue détail, on appelle `useCoFormQuery` avec elementId+elementType
 * pour que le serveur retourne l'access portant sur la réponse partagée du lieu
 * plutôt que la réponse personnelle du user.
 */
export default function CoFormPlacePage() {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const params = useParams();
  const formId = params.formId;
  const placeId = params.placeId;

  const { formData, access, isLoading, error } = useCoFormQuery({
    formId: formId ?? "",
    enabled: !!formId,
    elementId: placeId,
    elementType: placeId ? "organizations" : undefined,
  });

  return (
    <>
      <SiteHeader />
      <main className="min-h-[60vh]">
        {!formId ? (
          <ErrorBanner message={t("coform.errors.formNotFound")} />
        ) : isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <ErrorBanner message={(error as Error).message} />
        ) : !formData ? (
          <ErrorBanner message={t("coform.errors.formNotFound")} />
        ) : placeId ? (
          <PlaceFormView formData={formData} access={access} formId={formId} placeId={placeId} />
        ) : (
          <PlacesListView formData={formData} formId={formId} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <p className="text-sm text-destructive">{message}</p>
      </div>
    </div>
  );
}
