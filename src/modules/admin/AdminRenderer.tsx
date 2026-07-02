import { useState } from "react";

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
  const tabs = (config.tabs ?? []).filter((tab) => !tab.access || access.has(tab.access));
  const [active, setActive] = useState(() => tabs[0]?.id ?? "");

  if (tabs.length === 0) {
    return <AdminSectionRenderer section={{ type: "dashboard" }} />;
  }

  return (
    <Tabs value={active} onValueChange={setActive} className="w-full">
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
