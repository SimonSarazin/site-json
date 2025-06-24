import React from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { CocolightProvider } from '@/contexts/CocolightProvider';
import { SiteProvider } from '@/contexts/SiteContext';
import { LocalizationProvider } from '@/contexts/LocalizationContext';
import { RouterProvider } from '@/contexts/RouterContext';
import { SiteRenderer } from '@/components/SiteRenderer';
import { demoSiteConfig } from '@/data/demo-site';
import { getBaseUrl } from '@/lib/constant/common';
import './App.css';

function App() {
  // Provide default values for SSR
  const baseUrl = typeof window !== 'undefined' ? getBaseUrl() : 'http://localhost:3000';
  
  return (
    <ThemeProvider 
      attribute="class" 
      defaultTheme="system" 
      enableSystem
      disableTransitionOnChange
    >
      <CocolightProvider clientOptions={{ baseURL: baseUrl, debug: true }}>
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