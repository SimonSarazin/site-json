import { useState } from "react";
import { useParams } from "react-router";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/hooks/useT";

import { AdminSectionRenderer } from "./AdminSectionRenderer";
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
  const tabs = (config.tabs ?? []).filter((tab) => !tab.access || access.has(tab.access));
  const [active, setActive] = useState("");
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
    <Tabs value={activeTab} onValueChange={setActive} className="w-full">
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {t(tab.label)}
          </TabsTrigger>
        ))}
      </TabsList>
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
