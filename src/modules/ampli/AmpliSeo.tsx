import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useLocalization } from "@/hooks/useLocalization";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { Helmet } from "@dr.pogodin/react-helmet";

interface AmpliSeoProps {
    isLoading: boolean;
    activeTab?: string;
}

export function AmpliSeo({ isLoading, activeTab = 'home' }: AmpliSeoProps) {
    const { config } = useSite();
    const { currentLocale, t: tLocale } = useLocalization();
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");

    /**
     * Obtenir le label i18n d'un tab
     */
    const getTabLabel = (tab: string): string => {
        const tabKeys: Record<string, string> = {
            home: "AmpliTemplateDefault.tabs.home",
            message: "AmpliTemplateDefault.tabs.message",
            community: "AmpliTemplateDefault.tabs.network",
            dashboard: "AmpliTemplateDefault.tabs.dashboard",
            news: "AmpliTemplateDefault.tabs.news",
        };
        return tabKeys[tab] ? t(tabKeys[tab]) : "";
    };

    // Pendant le chargement ou si pas d'entité, afficher un titre par défaut
    if (isLoading) {
        const defaultTitle = (config.meta?.title && typeof config.meta.title === 'string')
            ? tLocale(config.meta.title)
            : "Profil";
        return (
            <Helmet htmlAttributes={{ lang: currentLocale }}>
                <title>{defaultTitle}</title>
            </Helmet>
        );
    }

    const canonicalUrl = typeof window !== 'undefined'
        ? activeTab !== 'home'
            ? `${window.location.href}/${activeTab}`
            : `${window.location.href}`
        : "";

    const pageTitle = activeTab !== "home" ? `${getTabLabel(activeTab)} - Ampli` : "Ampli";
    const description = getTabLabel(activeTab);

    return (
        <Helmet htmlAttributes={{ lang: currentLocale }}>
            {/* Titre */}
            <title>{pageTitle}</title>

            {/* Meta description */}
            {
                description.length > 0 && <meta name="description" content={description} />
            }

            {/* Open Graph */}
            <meta property="og:type" content="website" />
            <meta property="og:title" content={pageTitle} />
            {
                canonicalUrl.length > 0 && <meta property="og:url" content={canonicalUrl} />
            }
            <meta property="og:locale" content={currentLocale} />

            {/* Twitter Card */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={pageTitle} />
            {description.length > 0 && (
                <meta name="twitter:description" content={description.substring(0, 160)} />
            )}

            {/* Canonical */}
            {canonicalUrl.length > 0 && <link rel="canonical" href={canonicalUrl} />}
        </Helmet>
    )

}