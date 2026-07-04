import { Upload } from "lucide-react";
import Papa from "papaparse";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCocolight } from "@/hooks/useCocolight";

import type { AdminImportSection, AdminSection } from "../schema";

/**
 * Section `import` (P3) — import CSV en masse sous le costum courant. Câble : papaparse (CSV→lignes) →
 * `entity.previewImport` (IMPORT_PREVIEW : géocodage + warnings AVANT insertion) → `entity.importElements`
 * (IMPORT_ELEMENTS, chunké + onProgress) → résumé {créés, maj, erreurs}. Scope source.key auto (carrier).
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
  const { entity: carrier } = useCocolight();
  const allowed = importSection.entityTypes?.filter((t): t is ImportType =>
    (IMPORT_TYPES as readonly string[]).includes(t),
  ) ?? [...IMPORT_TYPES];
  const [type, setType] = useState<ImportType>(allowed[0] ?? "poi");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{ created: number; updated: number; errors: number } | null>(null);
  const [busy, setBusy] = useState(false);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setPreview(null);
    setSummary(null);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setRows(res.data);
        toast.success(`${res.data.length} ligne(s) chargée(s)`);
      },
      error: () => toast.error("Fichier CSV illisible"),
    });
  }

  async function handlePreview() {
    if (!carrier || rows.length === 0) return;
    setBusy(true);
    try {
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
      const res = await carrier.importElements(type, rows, {
        onProgress: (current, total) => setProgress({ current, total }),
      });
      setSummary(res.summary);
      toast.success(`Import : ${res.summary.created} créés · ${res.summary.updated} maj · ${res.summary.errors} erreurs`);
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
        <CardTitle className="text-lg">Import CSV</CardTitle>
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
          <div className="space-y-1">
            <span className="text-sm font-medium">Fichier CSV</span>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
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

        {preview && (
          <div className="max-h-96 overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>OK</TableHead>
                  <TableHead>Nom</TableHead>
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
                    <TableCell className="text-amber-600">{(r.warnings ?? []).join(", ") || "—"}</TableCell>
                    <TableCell className="text-destructive">{r.msgErrorAddress ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
