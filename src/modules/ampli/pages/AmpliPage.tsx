import { Link, useLoaderData, useLocation } from "react-router";
import { AmpliSeo } from "../AmpliSeo";
import { AmpliProvider } from "../contexts/AmpliProvider";
import { AmpliRenderer } from "../AmpliRenderer";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AlertCircle, FilePen, Home, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { AmpliTabs } from "../components/AmpliTabs";
import { useAmpli, useAmplis } from "../hooks/useAmplis";
import { ampliTitle } from "../lib/costumAmpli";
import { isConfiguredAmpli } from "../types";

/**
 * Page d'erreur "Ampli non trouvé" — extraite pour éviter la duplication
 * du JSX entre les deux cas (slug absent et ampli inconnu).
 */
function AmpliNotFound({ slug }: { slug?: string }) {
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");
    // La liste n'existe qu'en mode `costum` : en forme de config historique,
    // `/ampli` n'est pas une route.
    const { mode } = useAmplis();
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <SiteHeader />
            <main className="flex-1 flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <div className="flex justify-center">
                        <div className="p-6 rounded-full bg-muted/50 ring-1 ring-border shadow-sm">
                            <AlertCircle className="w-12 h-12 text-muted-foreground" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            {String(t("AmpliPage.notFoundTitle"))}
                        </h1>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            {String(t("AmpliPage.notFoundDescription", undefined, { slug: slug ?? "" }))}
                        </p>
                    </div>
                    <div className="pt-4 flex flex-wrap justify-center gap-3">
                        {mode === "costum" && (
                            <Button asChild className="gap-2">
                                <Link to="/ampli">
                                    <LayoutGrid className="w-4 h-4" />
                                    {String(t("AmpliPage.backToList"))}
                                </Link>
                            </Button>
                        )}
                        <Button asChild variant="outline" className="gap-2">
                            <Link to="/">
                                <Home className="w-4 h-4" />
                                {String(t("AmpliPage.backHome"))}
                            </Link>
                        </Button>
                    </div>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}

/**
 * Ampli déclaré sans formulaire exploitable (`coform` absent ou mal formé).
 * On le DIT, dans le cadre de la page (onglets compris) : rendre les sections
 * les ferait interroger le backend avec un id vide, pour une page muette.
 */
function AmpliNotConfigured({ name }: { name: string }) {
    const t = useT("modules/ampli");
    return (
        <div className="container mx-auto px-4 py-16 sm:py-24 text-center">
            <div className="mx-auto max-w-md space-y-4">
                <div className="flex justify-center">
                    <div className="p-5 rounded-full bg-muted/50 ring-1 ring-border">
                        <FilePen className="w-10 h-10 text-muted-foreground" />
                    </div>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {String(t("AmpliPage.notConfiguredTitle"))}
                </h1>
                <p className="text-muted-foreground leading-relaxed">
                    {String(t("AmpliPage.notConfiguredDescription", undefined, { name }))}
                </p>
            </div>
        </div>
    );
}

export default function AmpliPage() {
    const location = useLocation();
    const loaderData = useLoaderData() as { slug: string; activeTab?: string } | null;

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const activeTab =
        loaderData?.activeTab || (pathSegments.length > 2 ? pathSegments[pathSegments.length - 1] : 'home');
    const slug =
        loaderData?.slug ||
        (pathSegments.length > 2
            ? pathSegments[pathSegments.length - 2]
            : pathSegments.length === 2
                ? pathSegments[pathSegments.length - 1]
                : undefined);

    const ampli = useAmpli(slug);

    if (!slug) {
        return <AmpliNotFound />;
    }

    if (!ampli) {
        return <AmpliNotFound slug={slug} />;
    }

    return (
        <div className="min-h-screen flex flex-col">
            <AmpliSeo isLoading={false} activeTab={activeTab} name={ampli.name} />
            <SiteHeader />
            {/* Hors du conteneur du `main` : la barre d'onglets court sur toute
                la largeur, comme l'en-tête du site au-dessus d'elle. */}
            <AmpliTabs slug={slug} activeTab={activeTab} />
            <main className="flex-1">
                {isConfiguredAmpli(ampli) ? (
                    <div className="mx-auto">
                        <AmpliProvider ampli={ampli}>
                            <AmpliRenderer activeTab={activeTab} />
                        </AmpliProvider>
                    </div>
                ) : (
                    <AmpliNotConfigured name={ampliTitle(ampli)} />
                )}
            </main>
            <SiteFooter />
        </div>
    );
}
