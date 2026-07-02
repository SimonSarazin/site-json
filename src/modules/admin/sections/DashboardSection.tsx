import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { AdminSection } from "../schema";

/**
 * Section `dashboard` — vue d'ensemble de l'admin. P0 : placeholder.
 * P1+ : tuiles de compteurs par resource (searchCostum count) + raccourcis (port DashboardAction legacy).
 */
export default function DashboardSection({ section: _section }: { section: AdminSection }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tableau de bord</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Vue d'ensemble de l'administration (compteurs par resource, raccourcis) — à venir.
      </CardContent>
    </Card>
  );
}
