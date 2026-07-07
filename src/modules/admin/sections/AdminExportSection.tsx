import { toCsv } from "@communecter/cocolight-api-client";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";

import { ensureCostumScope } from "../lib/ensureCostumScope";
import type { AdminSection } from "../schema";

/**
 * Section `export` (P3) — export CSV des éléments du costum courant. Câble `entity.exportElements`
 * (EXPORT_ELEMENTS, scopé source.key du carrier) + le helper `toCsv`. RÉSERVÉ super-admin côté backend →
 * on gate le bouton via `me.isSuperAdmin()`.
 */
const EXPORTABLE_TYPES = ["organizations", "projects", "poi", "events"];

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminExportSection({ section }: { section: AdminSection }) {
  const exportSection = section as { title?: Parameters<ReturnType<typeof useT>>[0] };
  const t = useT();
  const { entity: carrier, me, contextId, contextType } = useCocolight();
  const [type, setType] = useState("organizations");
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
      toast.success(`${results.length} élément(s) exporté(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{exportSection.title ? t(exportSection.title) : "Export CSV"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canExport && (
          <p className="text-sm text-muted-foreground">L&apos;export est réservé aux super-administrateurs.</p>
        )}
        {/* flex-wrap + largeurs responsives : à 390px la rangée empilait 530px fixes hors écran (audit mobile). */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full space-y-1 sm:w-auto">
            <span className="text-sm font-medium">Type</span>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORTABLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-1 sm:w-auto">
            <span className="text-sm font-medium">Statut</span>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">À valider</SelectItem>
                <SelectItem value="validated">Validés</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleExport} disabled={busy || !canExport || !carrier}>
            <Download className="mr-2 h-4 w-4" />
            {busy ? "Export…" : "Exporter CSV"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
