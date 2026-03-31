import { Link, useLoaderData, useLocation } from "react-router";
import { AmpliSeo } from "../AmpliSeo";
import { AmpliProvider } from "../contexts/AmpliProvider";
import { AmpliRenderer } from "../AmpliRenderer";
import { useSite } from "@/hooks/useSite";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AlertCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";


export default function AmpliPage() {
    const location = useLocation();
    const loaderData = useLoaderData() as { slug: string, activeTab?: string } | null;
    const { config: siteConfig } = useSite();

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const activeTab = loaderData?.activeTab || (pathSegments.length > 2 ? pathSegments[pathSegments.length - 1] : 'home');
    const slug = loaderData?.slug || (pathSegments.length > 2 ? pathSegments[pathSegments.length - 2] : (pathSegments.length == 2 ? pathSegments[pathSegments.length - 1] : undefined));
    if (!slug) {
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
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">Ampli non trouvé</h1>

                            <p className="text-lg text-muted-foreground leading-relaxed">La configuration pour l'ampli "{slug}" est introuvable.</p>
                        </div>
                        <div className="pt-4">
                            <Button asChild variant="outline" className="gap-2">
                                <Link to="/">
                                    <Home className="w-4 h-4" />
                                    Retour à l'accueil
                                </Link>
                            </Button>
                        </div>
                    </div>
                </main>
                <SiteFooter />
            </div>
        );
    }

    const ampliConfig = siteConfig.ampli?.find((ampli) => ampli.slug === slug) || undefined;

    if (!ampliConfig) {
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
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">Ampli non trouvé</h1>

                            <p className="text-lg text-muted-foreground leading-relaxed">La configuration pour l'ampli "{slug}" est introuvable.</p>
                        </div>
                        <div className="pt-4">
                            <Button asChild variant="outline" className="gap-2">
                                <Link to="/">
                                    <Home className="w-4 h-4" />
                                    Retour à l'accueil
                                </Link>
                            </Button>
                        </div>
                    </div>
                </main>
                <SiteFooter />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <AmpliSeo isLoading={false} activeTab={activeTab} />
            <SiteHeader />
            <main className="flex-1">
                <div className={ampliConfig.layout === 'fullwidth' ? 'mx-auto' : 'container mx-auto'}>
                    <AmpliProvider config={ampliConfig} >
                        <AmpliRenderer activeTab={activeTab} />
                    </AmpliProvider>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}