import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { AdminSection } from "../schema";

/**
 * Fallback pour les sections builtin pas encore implémentées (P0) ou un `type` inconnu.
 * Remplacé phase par phase : members (P1), resource (P2), import/export (P3), validation/reference (P4/P5).
 */
export default function PlaceholderSection({ section }: { section: AdminSection }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize">{section.type}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Section « {section.type} » — implémentation à venir.
      </CardContent>
    </Card>
  );
}
