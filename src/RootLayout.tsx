import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { CocolightProvider } from '@/contexts/CocolightProvider';
import { SiteProvider } from '@/contexts/SiteContext';
import { LocalizationProvider } from '@/contexts/LocalizationProvider';
import { getBaseUrl } from '@/lib/constant/common';
import { Outlet } from 'react-router';
import { SiteTheme } from '@/components/layout/SiteTheme';
import type { SiteConfig } from "@/types/site";

interface Props {
  config: SiteConfig;        // 👈 nouvelle prop
}

function RootLayout({ config }: Props) {
  // Provide default values for SSR
  // const baseUrl = typeof window !== 'undefined' ? getBaseUrl() : 'http://localhost:3000';

  return (
    <ThemeProvider 
      attribute="class" 
      defaultTheme="system" 
      enableSystem
    >
      <CocolightProvider clientOptions={{ baseURL: getBaseUrl(), debug: true }}>
          <SiteProvider config={config}>
            <LocalizationProvider
              defaultLocale={config.meta.defaultLang}
              availableLocales={config.meta.languages}
            >
              <SiteTheme />
              <Outlet />
              <Toaster />
            </LocalizationProvider>
          </SiteProvider>
      </CocolightProvider>
    </ThemeProvider>
  );
}

export default RootLayout;