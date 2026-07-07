import { Download, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { useEffect, useState } from "react";
import { useBlocker } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useUnsavedChangesWarning } from "@/modules/coform/hooks/useUnsavedChangesWarning";

import { ensureCostumScope } from "../lib/ensureCostumScope";
import { shapeImportRow } from "../lib/shapeImportRow";
import type { AdminImportSection, AdminSection } from "../schema";

/**
 * Section `import` (P3) — import CSV en masse sous le costum courant. Câble : papaparse (CSV→lignes) →
 * `shapeImportRows` (colonnes plates → structure microformat) → `entity.previewImport` (GEOCODAGE :
 * résolution d'adresse + warnings AVANT insertion) → `entity.importElements` (IMPORT_ELEMENTS, chunké +
 * onProgress) → résumé {créés, maj, erreurs}. Scope source.key auto (carrier ctx-ifié, cf. useAdminCostumCarrier).
 */
const IMPORT_TYPES = ["poi", "organizations", "projects", "events", "citoyens"] as const;
type ImportType = (typeof IMPORT_TYPES)[number];

interface PreviewRow {
  rowIndex: string;
  success: boolean;
  data?: Record<string, unknown>;
  warnings?: string[];
  msgErrorAddress?: string;
}

export default function AdminImportSection({ section }: { section: AdminSection }) {
  const importSection = section as AdminImportSection;
  const { entity: carrier, contextId, contextType } = useCocolight();
  const t = useT();
  const queryClient = useQueryClient();
  const allowed = importSection.entityTypes?.filter((t): t is ImportType =>
    (IMPORT_TYPES as readonly string[]).includes(t),
  ) ?? [...IMPORT_TYPES];
  const [type, setType] = useState<ImportType>(allowed[0] ?? "poi");
  // Filet runtime (le schéma z.enum attrape désormais ce cas à la VALIDATION, mais le runtime
  // consomme le JSON brut) : signaler les types de config rejetés au lieu de les avaler.
  const rejected = (importSection.entityTypes ?? []).filter((t) => !(IMPORT_TYPES as readonly string[]).includes(t)).join(", ");
  useEffect(() => {
    if (rejected) toast.warning(`Import : types de config non importables ignorés — ${rejected}`);
  }, [rejected]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{ created: number; updated: number; errors: number } | null>(null);
  /** Erreurs PAR LIGNE du dernier import (res.elements[].msgError — existait dans la réponse mais
   *  n'était jamais exploité : seul le résumé agrégé était affiché — audit UX). */
  const [importErrors, setImportErrors] = useState<Array<{ rowIndex: string; name: string; error: string }> | null>(null);
  const [busy, setBusy] = useState(false);
  // Garde de navigation pendant l'import : fermeture/refresh (beforeunload natif) + navigation SPA
  // (useBlocker — un changement d'onglet admin démonte la section : progression et résumé perdus,
  // l'import continue en aveugle). Les lignes déjà envoyées restent importées côté serveur.
  useUnsavedChangesWarning(busy);
  const blocker = useBlocker(busy);

  /** Modèle CSV : les en-têtes standard comprises par shapeImportRow (adresse pliée automatiquement). */
  function downloadTemplate() {
    const headers = type === "events"
      ? "name,type,startDate,endDate,streetAddress,postalCode,city,tags,shortDescription"
      : "name,type,streetAddress,postalCode,city,tags,shortDescription";
    const example = type === "events"
      ? `Mon événement,meeting,2026-09-01,2026-09-02,1 rue Exemple,97400,Saint-Denis,"tag1,tag2",Description courte`
      : `Mon élément,typeExemple,1 rue Exemple,97400,Saint-Denis,"tag1,tag2",Description courte`;
    const blob = new Blob([headers + "\n" + example + "\n"], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modele-import-${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    setPreview(null);
    setSummary(null);
    setImportErrors(null);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setRows(res.data.map(shapeImportRow));
        toast.success(`${res.data.length} ligne(s) chargée(s)`);
      },
      error: () => toast.error("Fichier CSV illisible"),
    });
  }

  async function handlePreview() {
    if (!carrier || rows.length === 0) return;
    setBusy(true);
    try {
      ensureCostumScope(carrier, { contextId, contextType });
      const res = await carrier.previewImport(rows);
      setPreview(res.rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Prévisualisation impossible");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!carrier || rows.length === 0) return;
    setBusy(true);
    setProgress({ current: 0, total: rows.length });
    try {
      ensureCostumScope(carrier, { contextId, contextType });
      const res = await carrier.importElements(type, rows, {
        onProgress: (current, total) => setProgress({ current, total }),
      });
      setSummary(res.summary);
      const errs = Object.entries((res.elements ?? {}) as Record<string, unknown>).flatMap(([k, v]) => {
        const el = v as { name?: unknown; msgError?: unknown } | null;
        return el?.msgError ? [{ rowIndex: k, name: String(el.name ?? ""), error: String(el.msgError) }] : [];
      });
      setImportErrors(errs.length ? errs : null);
      toast.success(`Import : ${res.summary.created} créés · ${res.summary.updated} maj · ${res.summary.errors} erreurs`);
      // REVIEW M4 : les éléments importés doivent apparaître dans les tables/tuiles sans attendre le staleTime.
      void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("admin-") });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import impossible");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{importSection.title ? t(importSection.title) : "Import CSV"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <span className="text-sm font-medium">Type</span>
            <Select value={type} onValueChange={(v) => setType(v as ImportType)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowed.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Modèle CSV
          </Button>
          <div className="space-y-1">
            <span className="text-sm font-medium">Fichier CSV</span>
            <Input
              type="file"
              accept=".csv,text/csv"
              // value remis à vide : sans ça, re-sélectionner LE MÊME fichier (corrigé) ne
              // déclenche plus change sur Chromium — l'import repartait sur les anciennes lignes.
              onChange={(e) => { handleFile(e.target.files?.[0]); e.currentTarget.value = ""; }}
              className="w-64"
            />
          </div>
        </div>

        {rows.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePreview} disabled={busy}>
              <Upload className="mr-2 h-4 w-4" />
              Prévisualiser ({rows.length})
            </Button>
            <Button onClick={handleImport} disabled={busy || !carrier}>
              Importer
            </Button>
          </div>
        )}

        {progress && (
          <Progress value={progress.total ? (progress.current / progress.total) * 100 : 0} />
        )}

        {summary && (
          <p className="text-sm">
            ✅ {summary.created} créés · ✏️ {summary.updated} mis à jour · ⚠️ {summary.errors} erreurs
          </p>
        )}
        {importErrors && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const csv = ["ligne,nom,erreur", ...importErrors.map((r) =>
                `${r.rowIndex},"${r.name.replaceAll('"', '""')}","${r.error.replaceAll('"', '""')}"`,
              )].join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "rapport-erreurs-import.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Rapport d'erreurs d'import ({importErrors.length})
          </Button>
        )}

        {preview && preview.some((r) => !r.success || r.msgErrorAddress) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const bad = preview.filter((r) => !r.success || r.msgErrorAddress);
              const csv = ["ligne,nom,erreur", ...bad.map((r) =>
                `${r.rowIndex},"${String((r.data?.name as string | undefined) ?? "")}","${r.msgErrorAddress ?? "échec"}"`,
              )].join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "rapport-erreurs-import.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Rapport d'erreurs ({preview.filter((r) => !r.success || r.msgErrorAddress).length})
          </Button>
        )}
        {preview && (
          <div className="max-h-96 overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>OK</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Adresse résolue</TableHead>
                  <TableHead>Avertissements</TableHead>
                  <TableHead>Erreur adresse</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((r) => (
                  <TableRow key={r.rowIndex}>
                    <TableCell>{r.rowIndex}</TableCell>
                    <TableCell>{r.success ? "✓" : "✗"}</TableCell>
                    <TableCell>{String((r.data?.name as string | undefined) ?? "—")}</TableCell>
                    <TableCell>
                      {(() => {
                        // Le POINT DE VALEUR du géocodage : la commune résolue (localityId) + geo.
                        const addr = r.data?.address as { addressLocality?: string; postalCode?: string; localityId?: string } | undefined;
                        const geo = r.data?.geo as { latitude?: unknown } | undefined;
                        if (!addr?.localityId) return <span className="text-muted-foreground">—</span>;
                        return (
                          <span className="text-emerald-700">
                            {addr.addressLocality}{addr.postalCode ? ` (${addr.postalCode})` : ""}{geo?.latitude ? " · 📍" : ""}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-amber-600">{(r.warnings ?? []).join(", ") || "—"}</TableCell>
                    <TableCell className="text-destructive">{r.msgErrorAddress ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(o) => { if (!o) blocker.reset?.(); }}
        onConfirm={() => blocker.proceed?.()}
        title="Import en cours"
        description="Quitter la page interrompra le suivi de l'import (les lignes déjà envoyées restent importées). Quitter quand même ?"
        confirmLabel="Quitter"
        cancelLabel="Rester"
        isDestructive
      />
    </Card>
  );
}
