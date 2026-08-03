// Provider des aperçus design-sync : le minimum de contexte pour rendre les
// composants SiteForge hors app (router mémoire, config site minimale,
// localisation fr). Exporté dans le bundle via cfg.extraEntries.
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SiteProvider } from "@/contexts/SiteProvider";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import type { SiteConfig } from "@/types/site-schema";
import "@/i18n";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

// Stub inerte : les headers appellent useCocolight() (entity pour le logo) mais
// aucun aperçu ne déclenche d'appel API — tout est null/no-op.
const cocolightStub = {
  apiClient: null,
  userApi: null,
  loading: false,
  me: null,
  api: null,
  entity: null,
  helper: {} as CocolightContextType["helper"],
  dataToProfile: null,
  setDataToProfile: () => {},
  refreshMe: async () => {},
} as CocolightContextType;

const minimalConfig = {
  version: "1.0.0",
  meta: { title: { fr: "SiteForge" }, defaultLang: "fr", languages: ["fr"] },
  header: { type: "standard", nav: [] },
  pages: [],
  footer: { type: "minimal-centered", copyright: { fr: "SiteForge" } },
} as unknown as SiteConfig;

export function DsProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Captures déterministes : fige les animations d'entrée (tw-animate) à leur état final. */}
      <style>{"*,*::before,*::after{animation:none!important;transition:none!important}"}</style>
      <MemoryRouter>
        <SiteProvider config={minimalConfig}>
          <CocolightContext.Provider value={cocolightStub}>
            <LocalizationProvider>{children}</LocalizationProvider>
          </CocolightContext.Provider>
        </SiteProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
