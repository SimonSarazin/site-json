import { isRouteErrorResponse } from "react-router";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, SearchX } from "lucide-react";

/**
 * Composant interne sans hooks pour afficher l'erreur
 */
function ProfileErrorContent({ is404 }: { is404: boolean }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {is404 ? (
          <>
            <SearchX className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">
              Profil introuvable
            </h1>
            <p className="text-muted-foreground mb-6">
              Ce profil n'existe pas ou a été supprimé.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto text-muted-foreground mb-4 text-4xl">
              ⚠️
            </div>
            <h1 className="text-2xl font-bold mb-2">
              Une erreur est survenue
            </h1>
            <p className="text-muted-foreground mb-6">
              Impossible de charger ce profil. Veuillez réessayer.
            </p>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <Button onClick={() => window.location.href = "/"}>
            <Home className="w-4 h-4 mr-2" />
            Accueil
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Error boundary pour les routes du module profil
 * Gère les erreurs 404 et autres erreurs de chargement
 *
 * Note: Cette fonction n'utilise pas de hooks React pour éviter
 * les problèmes de contexte lors du rendu initial des routes
 */
export function ProfileErrorBoundary({ error }: { error?: unknown }) {
  const is404 = error ? isRouteErrorResponse(error) && error.status === 404 : true;
  return <ProfileErrorContent is404={is404} />;
}
