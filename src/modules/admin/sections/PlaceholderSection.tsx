import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";

import type { AdminSection } from "../schema";

/**
 * Fallback pour les sections builtin pas encore implémentées (P0) ou un `type` inconnu.
 * Remplacé phase par phase : members (P1), resource (P2), import/export (P3), validation/reference (P4/P5).
 */
export default function PlaceholderSection({ section }: { section: AdminSection }) {
  const t = useT("modules/admin");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize">{section.type}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {t("PlaceholderSection.comingSoon", undefined, { type: section.type })}
      </CardContent>
    </Card>
  );
}
