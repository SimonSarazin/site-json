/**
 * Le fallback `Suspense` des routes AAC, pendant le téléchargement du chunk de page.
 *
 * Fichier à part, qui n'importe rien de la fiche : `routes.tsx` l'importe statiquement, et le
 * faire venir de `AacCommunDetailPage` annulerait le `lazy()` qui garde la page hors du bundle
 * des sites sans AAC.
 */
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/hooks/useT";

export function AacRouteFallback() {
    // `useT` seul, sans `useLoadNamespace` : ce composant n'est monté que le temps d'un
    // chargement de chunk et doit rester sans effet ni requête.
    const t = useT("modules/aac");
    const label = String(t("page.loading", "Chargement…"));

    return (
        <div
            className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center text-center"
            aria-busy="true"
        >
            <div className="mb-6 rounded-full bg-muted/50 p-6 ring-1 ring-border shadow-sm">
                <Spinner className="h-12 w-12 text-primary" label={label} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground" aria-hidden="true">
                {label}
            </p>
        </div>
    );
}
