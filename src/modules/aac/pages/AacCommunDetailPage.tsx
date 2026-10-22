import { ReactNode, Suspense, useEffect } from "react";
import { Link } from "react-router";
import { AlertCircle, Home } from "lucide-react";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { allEmbedded } from "@/lib/variants";
import { useT } from "@/hooks/useT";
import { CoFormModal } from "@/modules/coform/components/CoFormModal";
import { CommunActionDialogs } from "../components/pageDetail/CommunActionDialogs.tsx";
import { CommunMilestoneDialogs } from "../components/pageDetail/CommunMilestoneDialogs.tsx";
import { AAC_DETAIL_VARIANTS } from "../components/pageDetail/variants/registry";
import { useCommunDetailController } from "../hooks/useCommunDetailController";
import { AacSeo, type AacSeoProps } from "../AacSeo";
// Enregistre le bundle i18n "modules/aac". Les SECTIONS le font déjà ; sans cet
// import, une arrivée DIRECTE sur la route (lien partagé, F5) rendait la page
// avant tout enregistrement — et `t()` retournait les clés brutes.
import "../i18n";

/**
 * Coquille de la fiche d'un commun, commune à toutes les interfaces : chrome, SEO (dans tous
 * les états), gardes et overlays sans position. La fiche prête est rendue par l'interface
 * choisie (`AAC_DETAIL_VARIANTS`).
 */
export default function AacCommunDetailPage() {
    const vm = useCommunDetailController();
    const t = useT("modules/aac");

    // Précharge l'interface pendant le chargement des données (sans effet pour `default`).
    useEffect(() => {
        void AAC_DETAIL_VARIANTS.preload(vm.pageVariant);
    }, [vm.pageVariant]);

    switch (vm.status) {
        case "missing-answer":
            return <PageShell seo={vm.seo}><ErrorCard title={String(t("page.communDetail"))} description={String(t("page.missingAnswer"))} /></PageShell>;
        case "loading":
            return <PageShell seo={vm.seo}><LoadingCard label={String(t("page.loading"))} /></PageShell>;
        case "error":
            if (vm.kind === "data") return <PageShell seo={vm.seo}><ErrorCard title={String(t("page.error"))} description={String(t("page.errorMessage"))} /></PageShell>;
            if (vm.kind === "config") return <PageShell seo={vm.seo}><ErrorCard title={String(t("page.error"))} description={String(t("page.configErrorMessage"))} /></PageShell>;
            return <PageShell seo={vm.seo}><ErrorCard title={String(t("page.notFound"))} description={String(t("page.notFoundMessage"))} /></PageShell>;
    }

    const View = AAC_DETAIL_VARIANTS.get(vm.pageVariant);
    // eslint-disable-next-line react-hooks/static-components -- `View` vient d'un registre, il n'est pas créé ici.
    const view = <View vm={vm} />;

    return (
        <PageShell seo={vm.seo}>
            {/* Frontière pour une interface code-splittée seulement ; repli identique au chargement. */}
            {allEmbedded(View) ? (
                view
            ) : (
                <Suspense fallback={<LoadingCard label={String(t("page.loading"))} />}>{view}</Suspense>
            )}

            <CommunMilestoneDialogs ctrl={vm.overlays.milestones} />
            <CommunActionDialogs ctrl={vm.overlays.milestones} />

            {vm.overlays.edit && <CoFormModal {...vm.overlays.edit} />}
        </PageShell>
    );
}

/** Le chrome de la page — et son SEO, présent dans TOUS les états (squelette, erreur, fiche). */
function PageShell({ seo, children }: { seo: AacSeoProps; children: ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <AacSeo {...seo} />
            <SiteHeader />
            <main className="flex-1 py-8">
                <div className="container mx-auto">{children}</div>
            </main>
            <SiteFooter />
        </div>
    );
}

function LoadingCard({ label }: { label: string }) {
    return (
        <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center text-center">
            <div className="mb-6 rounded-full bg-muted/50 p-6 ring-1 ring-border shadow-sm">
                <Spinner className="h-12 w-12 text-primary" label={label} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground" aria-hidden="true">{label}</p>
        </div>
    );
}

function ErrorCard({ title, description }: { title: string; description: string }) {
    // Le namespace est déjà chargé par la page ; `useT` seul suffit ici.
    const t = useT("modules/aac");
    return (
        <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center text-center">
            <div className="mb-6 rounded-full bg-muted/50 p-6 ring-1 ring-border shadow-sm">
                <AlertCircle className="h-12 w-12 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
            <div className="mt-6">
                <Button asChild variant="outline" className="gap-2">
                    <Link to="/">
                        <Home className="h-4 w-4" />
                        {String(t("page.backHome"))}
                    </Link>
                </Button>
            </div>
        </div>
    );
}
