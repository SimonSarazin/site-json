import { toCsv } from "@communecter/cocolight-api-client";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";

import { downloadCsv } from "../lib/downloadCsv";
import { ensureCostumScope } from "../lib/ensureCostumScope";
import type { AdminExportSection as AdminExportSectionConfig, AdminSection } from "../schema";

/**
 * Section `export` (P3) — export CSV des éléments du costum courant. Câble `entity.exportElements`
 * (EXPORT_ELEMENTS, scopé source.key du carrier) + le helper `toCsv`. RÉSERVÉ super-admin côté backend →
 * on gate le bouton via `me.isSuperAdmin()`.
 */
const EXPORTABLE_TYPES = ["organizations", "projects", "poi", "events"];

export default function AdminExportSection({ section }: { section: AdminSection }) {
  const exportSection = section as AdminExportSectionConfig;
  const t = useT();
  const tAdmin = useT("modules/admin");
  const { entity: carrier, me, contextId, contextType } = useCocolight();
  // Types pilotés par la config (`entityTypes`), défaut = liste historique (audit config).
  const types = exportSection.entityTypes ?? EXPORTABLE_TYPES;
  const [type, setType] = useState(types[0] ?? "organizations");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "validated">("all");
  const [busy, setBusy] = useState(false);
  const canExport = me?.isSuperAdmin?.() ?? false;
  const costumSlug = (carrier as { slug?: string } | null)?.slug ?? "";

  async function handleExport() {
    if (!carrier) return;
    setBusy(true);
    try {
      // exportElements exige un _costumCtx complet — l'hôte costum n'en a pas (cf. ensureCostumScope).
      ensureCostumScope(carrier, { contextId, contextType });
      const filters = statusFilter !== "all" && costumSlug
        ? { [`preferences.toBeValidated.${costumSlug}`]: { $exists: statusFilter === "pending" } }
        : undefined;
      const { results, fields } = await carrier.exportElements({ searchType: [type], ...(filters ? { filters } : {}) });
      downloadCsv(toCsv(results, fields as Parameters<typeof toCsv>[1]), `export-${type}-${Date.now()}.csv`);
      toast.success(tAdmin("AdminExportSection.exportSuccess", undefined, { count: String(results.length) }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tAdmin("AdminExportSection.exportFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{exportSection.title ? t(exportSection.title) : tAdmin("AdminExportSection.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canExport && (
          <p className="text-sm text-muted-foreground">{tAdmin("AdminExportSection.superAdminOnly")}</p>
        )}
        {/* flex-wrap + largeurs responsives : à 390px la rangée empilait 530px fixes hors écran (audit mobile). */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full space-y-1 sm:w-auto">
            <Label htmlFor="admin-export-type" className="text-sm font-medium">{tAdmin("AdminExportSection.typeLabel")}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="admin-export-type" className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-1 sm:w-auto">
            <Label htmlFor="admin-export-status" className="text-sm font-medium">{tAdmin("AdminExportSection.statusLabel")}</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger id="admin-export-status" className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tAdmin("AdminExportSection.statusAll")}</SelectItem>
                <SelectItem value="pending">{tAdmin("AdminExportSection.statusPending")}</SelectItem>
                <SelectItem value="validated">{tAdmin("AdminExportSection.statusValidated")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleExport} disabled={busy || !canExport || !carrier}>
            <Download className="mr-2 h-4 w-4" />
            {tAdmin(busy ? "AdminExportSection.exporting" : "AdminExportSection.exportButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
