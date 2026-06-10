import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { Outlet } from "react-router";
import { SiteTheme } from "@/components/layout/SiteTheme";
import { IntegrationsLoader } from "@/components/layout/IntegrationsLoader";
import type { SiteConfig } from "@/types/site";
import { I18nBridge } from "@/contexts/I18nBridge";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { Suspense } from "react";
import { lazy } from "vite-preload";
import { CocolightProvider } from "@/contexts/CocolightProvider";
import { getBaseUrl } from "@/lib/constant/common";
import { GoogleFontsLoader } from "@/components/layout/GoogleFontsLoader";
import { SiteProvider } from "@/contexts/SiteProvider";
import { useSite } from "@/hooks/useSite";
import { CommandPaletteProvider } from "@/modules/commandPalette/contexts/CommandPaletteProvider";
import { AuthModalProvider } from "@/modules/auth/context/AuthModalProvider";

// Composants optionnels lazy-loadés : rendus seulement si configurés/activés.
// Évite d'inclure leur code (et leurs dépendances) dans le bundle initial.
const FloatingQRCode = lazy(() => import("@/components/layout/FloatingQRCode"));
const FloatingActionButton = lazy(() => import("@/components/layout/FloatingActionButton"));
const DiscourseGlobalModal = lazy(() => import("@/modules/interop/components/DiscourseGlobalModal"));

const AdminPanel = import.meta.env.DEV
  ? lazy(() => import("@/components/admin/AdminPanel"))
  : null;


function SiteShell() {
  const { config } = useSite();

  return (
    <LocalizationProvider
      defaultLocale={config.meta.defaultLang}
      availableLocales={config.meta.languages}
    >
      <I18nBridge>
        <SiteTheme />
        <GoogleFontsLoader />

        <CommandPaletteProvider>
        <AuthModalProvider>
        <Outlet />
        <IntegrationsLoader />
        <Toaster />
        <DiscourseGlobalModal />

        {AdminPanel && (
          <Suspense fallback={null}>
            <AdminPanel />
          </Suspense>
        )}

        {config.floatingQRCode?.enabled && (
          <FloatingQRCode
            url={config.floatingQRCode.url}
            position={config.floatingQRCode.position}
            size={config.floatingQRCode.size}
            expandedSize={config.floatingQRCode.expandedSize}
            includeFavicon={config.floatingQRCode.includeFavicon}
            bgColor={config.floatingQRCode.bgColor}
            fgColor={config.floatingQRCode.fgColor}
          />
        )}

        {config.floatingActionButton?.enabled && (
          <FloatingActionButton
            modal={config.floatingActionButton.modal}
            label={config.floatingActionButton.label}
            icon={config.floatingActionButton.icon}
            position={config.floatingActionButton.position}
            condition={config.floatingActionButton.condition}
          />
        )}
        </AuthModalProvider>
        </CommandPaletteProvider>
      </I18nBridge>
    </LocalizationProvider>
  );
}

interface Props {
  config: SiteConfig;
}

function RootLayout({ config }: Props) {
  const defaultTheme = config.theme?.defaultMode || "light";

  return (
    <ErrorBoundary fallback={<p>Une erreur est survenue 😢.</p>}>
      <Suspense fallback={<p>loading</p>}>
        <CocolightProvider clientOptions={{ baseURL: getBaseUrl() }}>
          <ThemeProvider attribute="class" defaultTheme={defaultTheme} enableSystem>
            <SiteProvider config={config}>
              <SiteShell />
            </SiteProvider>
          </ThemeProvider>
        </CocolightProvider>
      </Suspense>
    </ErrorBoundary>
  );
}

export default RootLayout;
