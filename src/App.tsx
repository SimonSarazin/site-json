import React from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { CocolightProvider } from '@/contexts/CocolightProvider';
import { SiteProvider } from '@/contexts/SiteContext';
import { LocalizationProvider } from '@/contexts/LocalizationContext';
import { RouterProvider } from '@/contexts/RouterContext';
import { SiteRenderer } from '@/components/SiteRenderer';
import { demoSiteConfig } from '@/data/demo-site';
import './App.css';

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <CocolightProvider>
        <RouterProvider>
          <SiteProvider config={demoSiteConfig}>
            <LocalizationProvider 
              defaultLocale={demoSiteConfig.meta.defaultLang}
              availableLocales={demoSiteConfig.meta.languages}
            >
              <SiteRenderer />
              <Toaster />
            </LocalizationProvider>
          </SiteProvider>
        </RouterProvider>
      </CocolightProvider>
    </ThemeProvider>
  );
}

export default App;