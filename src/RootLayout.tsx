import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { Outlet } from "react-router";
import { SiteTheme } from "@/components/layout/SiteTheme";
import { IntegrationsLoader } from "@/components/layout/IntegrationsLoader";
import type { SiteConfig } from "@/types/site";
import { I18nBridge } from "@/contexts/I18nBridge";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { Suspense, lazy } from "react";
import { CocolightProvider } from "@/contexts/CocolightProvider";
import { getBaseUrl } from "@/lib/constant/common";
import { GoogleFontsLoader } from "@/components/layout/GoogleFontsLoader";
import { SiteProvider } from "@/contexts/SiteProvider";
import { FloatingQRCode } from "@/components/layout/FloatingQRCode";

const AdminPanel = import.meta.env.DEV
  ? lazy(() => import("@/components/admin/AdminPanel"))
  : null;

interface Props {
  config: SiteConfig; // 👈 nouvelle prop
}

function RootLayout({ config }: Props) {
  // Provide default values for SSR
  // const baseUrl = typeof window !== 'undefined' ? getBaseUrl() : 'http://localhost:3000';
  const defaultTheme = config.theme?.defaultMode || "light";

  return (
    <ErrorBoundary fallback={<p>Une erreur est survenue 😢.</p>}>
      {/* Suspense : spinner si les promises (React Query, lazy, etc.) sont en vol */}
      <Suspense fallback={<p>loading</p>}>
        <CocolightProvider clientOptions={{ baseURL: getBaseUrl() }}>
          <ThemeProvider attribute="class" defaultTheme={defaultTheme} enableSystem>
            <SiteProvider config={config}>
              <LocalizationProvider
                defaultLocale={config.meta.defaultLang}
                availableLocales={config.meta.languages}
              >
                <I18nBridge>
                  <SiteTheme />
                  <GoogleFontsLoader />

                  <Outlet />
                  <IntegrationsLoader />
                  <Toaster />

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
                </I18nBridge>
              </LocalizationProvider>
            </SiteProvider>
          </ThemeProvider>
        </CocolightProvider>
      </Suspense>

    </ErrorBoundary>

  );
}

export default RootLayout;
