import React, { useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { SiteProvider } from '@/contexts/SiteContext';
import { LocalizationProvider } from '@/contexts/LocalizationContext';
import { SiteRenderer } from '@/components/SiteRenderer';
import { demoSiteConfig } from '@/data/demo-site';
import './App.css';

function App() {
  const [currentPath] = useState('/');

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SiteProvider config={demoSiteConfig}>
        <LocalizationProvider 
          defaultLocale={demoSiteConfig.meta.defaultLang}
          availableLocales={demoSiteConfig.meta.languages}
        >
          <SiteRenderer currentPath={currentPath} />
          <Toaster />
        </LocalizationProvider>
      </SiteProvider>
    </ThemeProvider>
  );
}

export default App;