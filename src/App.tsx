import React from 'react';
import { ThemeProvider } from 'next-themes';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from '@/components/ui/sonner';
import { CocolightProvider } from '@/contexts/CocolightProvider';
import { SiteProvider } from '@/contexts/SiteContext';
import { LocalizationProvider } from '@/contexts/LocalizationContext';
import { RouterProvider } from '@/contexts/RouterContext';
import { SiteRenderer } from '@/components/SiteRenderer';
import { demoSiteConfig } from '@/data/demo-site';
import { SiteConfig } from '@/types/site';
import { getBaseUrl } from '@/lib/constant/common';
import './App.css';

interface AppProps {
  initialConfig?: SiteConfig;
  initialPath?: string;
  initialMe?: any;
  initialOrganization?: any;
}

function App({ initialConfig, initialPath, initialMe, initialOrganization }: AppProps = {}) {
  const config = initialConfig || demoSiteConfig;
  
  return (
    <HelmetProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <CocolightProvider 
          clientOptions={{ baseURL: getBaseUrl(), debug: true }}
          initialMe={initialMe}
          initialOrganization={initialOrganization}
        >
          <RouterProvider initialPath={initialPath}>
            <SiteProvider config={config}>
              <LocalizationProvider 
                defaultLocale={config.meta.defaultLang}
                availableLocales={config.meta.languages}
              >
                <SiteRenderer />
                <Toaster />
              </LocalizationProvider>
            </SiteProvider>
          </RouterProvider>
        </CocolightProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;