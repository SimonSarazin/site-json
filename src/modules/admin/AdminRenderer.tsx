import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { DynamicIcon, type IconName } from "lucide-react/dynamic";

import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/hooks/useT";

import { AdminSectionRenderer } from "./AdminSectionRenderer";
import { ScrollableTabsList } from "./components/ScrollableTabsList";
import { useAdminAccess } from "./hooks/useAdminAccess";
import type { AdminConfig } from "./schema";

/**
 * Rend la page admin : onglets (miroir de `profiles.<type>.tabs`) → sections config-driven.
 * Filtre les onglets selon l'accès (`tab.access`). Sans `tabs` → dashboard par défaut (dérivation auto = P2).
 */
export function AdminRenderer({ config }: { config: AdminConfig }) {
  const t = useT();
  const access = useAdminAccess();
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const tabs = (config.tabs ?? []).filter((tab) => !tab.access || access.has(tab.access));
  const [active, setActive] = useState("");
  // REVIEW M3 : une navigation EXTERNE (palette Ctrl+K, tuile dashboard) change :section — l'URL
  // reprend la main sur l'état cliqué. Pattern React « adjust state during render » (pas d'effet :
  // la règle react-compiler interdit le setState synchrone en effet, et ce pattern évite un
  // rendu intermédiaire avec le mauvais onglet).
  const [lastSection, setLastSection] = useState(section);
  if (section !== lastSection) {
    setLastSection(section);
    if (section) setActive(section);
  }
  // Onglet effectif dérivé à CHAQUE rendu (pas d'état figé) :
  // - M1 (deep-link) : au 1er rendu `active===""` → on prend l'onglet de l'URL `admin/:section` s'il existe ;
  // - M2 (réconciliation) : si `active` sort du jeu filtré (accès révoqué / config changée) → repli sur URL puis tabs[0].
  const activeTab = tabs.some((tb) => tb.id === active)
    ? active
    : tabs.some((tb) => tb.id === section)
      ? (section as string)
      : (tabs[0]?.id ?? "");

  if (tabs.length === 0) {
    return <AdminSectionRenderer section={{ type: "dashboard" }} />;
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => {
        setActive(v);
        // Sync URL (deep-link bidirectionnel) : l'onglet actif est adressable/partageable.
        navigate(`/admin/${v}`, { replace: true });
      }}
      className="w-full"
    >
      <ScrollableTabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.icon && <DynamicIcon name={tab.icon as IconName} className="mr-1.5 h-3.5 w-3.5" />}
            {t(tab.label)}
          </TabsTrigger>
        ))}
      </ScrollableTabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="space-y-4 py-4">
          {tab.sections.map((section, i) => (
            <AdminSectionRenderer key={`${section.type}-${i}`} section={section} />
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}
