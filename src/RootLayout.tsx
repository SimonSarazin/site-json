import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { SiteProvider } from "@/contexts/SiteContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { Outlet } from "react-router";
import { SiteTheme } from "@/components/layout/SiteTheme";
import { IntegrationsLoader } from "@/components/layout/IntegrationsLoader";
import type { SiteConfig } from "@/types/site";
import { I18nBridge } from "./contexts/I18nBridge";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { Suspense } from "react";
import { CocolightProvider } from "./contexts/CocolightProvider";
import { getBaseUrl } from "./lib/constant/common";
import { GoogleFontsLoader } from "./components/layout/GoogleFontsLoader";

interface Props {
  config: SiteConfig; // 👈 nouvelle prop
}

function RootLayout({ config }: Props) {
  // Provide default values for SSR
  // const baseUrl = typeof window !== 'undefined' ? getBaseUrl() : 'http://localhost:3000';

  return (
              <ErrorBoundary fallback={<p>Une erreur est survenue 😢.</p>}>
                {/* Suspense : spinner si les promises (React Query, lazy, etc.) sont en vol */}
                <Suspense fallback={<p>loading</p>}>
                  <CocolightProvider clientOptions={{ baseURL: getBaseUrl(), debug: true }}>
                        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
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
