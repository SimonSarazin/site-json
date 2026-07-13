import { AlertTriangle, CheckCircle2, Download, MapPin, Pencil, Upload, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { useEffect, useMemo, useState } from "react";
import { useBlocker } from "react-router";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useCocolight } from "@/hooks/useCocolight";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useUnsavedChangesWarning } from "@/modules/coform/hooks/useUnsavedChangesWarning";

import { downloadCsv } from "../lib/downloadCsv";
import { ensureCostumScope } from "../lib/ensureCostumScope";
import { useCostumImportMapping } from "../hooks/useCostumImportMapping";
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
  const tAdmin = useT("modules/admin");
  const queryClient = useQueryClient();
  const allowed = importSection.entityTypes?.filter((t): t is ImportType =>
    (IMPORT_TYPES as readonly string[]).includes(t),
  ) ?? [...IMPORT_TYPES];
  const [type, setType] = useState<ImportType>(allowed[0] ?? "poi");
  // Filet runtime (le schéma z.enum attrape désormais ce cas à la VALIDATION, mais le runtime
  // consomme le JSON brut) : signaler les types de config rejetés au lieu de les avaler.
  const rejected = (importSection.entityTypes ?? []).filter((t) => !(IMPORT_TYPES as readonly string[]).includes(t)).join(", ");
  // Message calculé HORS effet : `tAdmin` change d'identité à chaque rendu (closure) — en dépendance
  // directe, le toast se rejouerait à chaque rendu ; la chaîne, elle, est stable par contenu.
  const rejectedMsg = rejected ? tAdmin("AdminImportSection.rejectedTypes", undefined, { types: rejected }) : "";
  useEffect(() => {
    if (rejectedMsg) toast.warning(rejectedMsg);
  }, [rejectedMsg]);
  // Lignes CSV BRUTES (clés = en-têtes du fichier) + en-têtes détectées : la traduction en-tête →
  // attribut (costum.import.mapping) est faite au moment de dériver `rows`, ajustable via le wizard.
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const { entries: mappingEntries, targetAttrs } = useCostumImportMapping(carrier, type);
  const hasMapping = mappingEntries.length > 0;
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

  // Correspondance en-tête CSV → attribut : auto-remplie (col du mapping costum, sinon l'en-tête telle
  // quelle = nom technique/champ standard). Recalculée quand le fichier ou le mapping change (les édits
  // manuels du wizard persistent tant que ces deux-là ne bougent pas). Pattern adjust-during-render.
  const autoKey = `${headers.join("|")}::${mappingEntries.map((e) => `${e.col}>${e.attr}`).join("|")}`;
  const [lastAutoKey, setLastAutoKey] = useState("");
  if (headers.length > 0 && autoKey !== lastAutoKey) {
    setLastAutoKey(autoKey);
    const auto: Record<string, string> = {};
    for (const h of headers) auto[h] = mappingEntries.find((e) => e.col === h)?.attr ?? h;
    setColumnMap(auto);
  }
  // `rows` DÉRIVÉ des lignes brutes + correspondance : shapeImportRow traduit puis met en forme.
  const rows = useMemo(
    () => rawRows.map((r) => shapeImportRow(r, headers.length > 0 ? columnMap : undefined)),
    [rawRows, columnMap, headers.length],
  );

  /** Modèle CSV : les EN-TÊTES du costum (`col` du mapping) si présent — l'utilisateur obtient un fichier
   *  qui matche exactement le mapping ; sinon les en-têtes standard comprises par shapeImportRow. */
  function downloadTemplate() {
    if (hasMapping) {
      const cols = mappingEntries.map((e) => e.col);
      downloadCsv(cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(",") + "\n", `modele-import-${type}.csv`);
      return;
    }
    const headerLine = type === "events"
      ? "name,type,startDate,endDate,streetAddress,postalCode,city,tags,shortDescription"
      : "name,type,streetAddress,postalCode,city,tags,shortDescription";
    const example = type === "events"
      ? `Mon événement,meeting,2026-09-01,2026-09-02,1 rue Exemple,97400,Saint-Denis,"tag1,tag2",Description courte`
      : `Mon élément,typeExemple,1 rue Exemple,97400,Saint-Denis,"tag1,tag2",Description courte`;
    downloadCsv(headerLine + "\n" + example + "\n", `modele-import-${type}.csv`);
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
        setRawRows(res.data);
        setHeaders((res.meta.fields ?? []).map((h) => h.trim()).filter(Boolean));
        toast.success(tAdmin("AdminImportSection.rowsLoaded", undefined, { count: String(res.data.length) }));
      },
      error: () => toast.error(tAdmin("AdminImportSection.fileUnreadable")),
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
      toast.error(error instanceof Error ? error.message : tAdmin("AdminImportSection.previewFailed"));
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
      toast.success(tAdmin("AdminImportSection.importDone", undefined, {
        created: String(res.summary.created),
        updated: String(res.summary.updated),
        errors: String(res.summary.errors),
      }));
      // REVIEW M4 : les éléments importés doivent apparaître dans les tables/tuiles sans attendre le staleTime.
      void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("admin-") });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tAdmin("AdminImportSection.importFailed"));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{importSection.title ? t(importSection.title) : tAdmin("AdminImportSection.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="admin-import-type" className="text-sm font-medium">{tAdmin("AdminImportSection.typeLabel")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as ImportType)}>
              <SelectTrigger id="admin-import-type" className="w-44">
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
            <Download className="mr-1.5 h-3.5 w-3.5" /> {tAdmin("AdminImportSection.template")}
          </Button>
          <div className="space-y-1">
            <Label htmlFor="admin-import-file" className="text-sm font-medium">{tAdmin("AdminImportSection.fileLabel")}</Label>
            <Input
              id="admin-import-file"
              type="file"
              accept=".csv,text/csv"
              // value remis à vide : sans ça, re-sélectionner LE MÊME fichier (corrigé) ne
              // déclenche plus change sur Chromium — l'import repartait sur les anciennes lignes.
              onChange={(e) => { handleFile(e.target.files?.[0]); e.currentTarget.value = ""; }}
              className="w-64"
            />
          </div>
        </div>

        {/* Wizard de correspondance en-tête CSV → attribut (rôle du `col` de costum.import.mapping) :
            auto-rempli, ajustable. Une colonne mise sur « (ignorer) » est retirée de l'import. */}
        {headers.length > 0 && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">{tAdmin("AdminImportSection.mappingTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {tAdmin(hasMapping ? "AdminImportSection.mappingHintCostum" : "AdminImportSection.mappingHintStd")}
            </p>
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tAdmin("AdminImportSection.mappingColCsv")}</TableHead>
                    <TableHead>{tAdmin("AdminImportSection.mappingColAttr")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headers.map((h) => {
                    const current = columnMap[h] ?? "";
                    const opts = [...new Set([...targetAttrs, ...(current && !targetAttrs.includes(current) ? [current] : [])])];
                    return (
                      <TableRow key={h}>
                        <TableCell className="max-w-[16rem] truncate font-medium" title={h}>{h}</TableCell>
                        <TableCell>
                          <Select
                            value={current || "__ignore__"}
                            onValueChange={(v) => setColumnMap((m) => ({ ...m, [h]: v === "__ignore__" ? "" : v }))}
                          >
                            <SelectTrigger className="h-8 w-full sm:w-72"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__ignore__">{tAdmin("AdminImportSection.mappingIgnore")}</SelectItem>
                              {opts.map((a) => (
                                <SelectItem key={a} value={a}>{a}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePreview} disabled={busy}>
              <Upload className="mr-2 h-4 w-4" />
              {tAdmin("AdminImportSection.preview", undefined, { count: String(rows.length) })}
            </Button>
            <Button onClick={handleImport} disabled={busy || !carrier}>
              {tAdmin("AdminImportSection.import")}
            </Button>
          </div>
        )}

        {progress && (
          <Progress value={progress.total ? (progress.current / progress.total) * 100 : 0} />
        )}

        {summary && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              {tAdmin("AdminImportSection.summaryCreated", undefined, { count: String(summary.created) })}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Pencil className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              {tAdmin("AdminImportSection.summaryUpdated", undefined, { count: String(summary.updated) })}
            </Badge>
            <Badge variant={summary.errors > 0 ? "destructive" : "secondary"} className="gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {tAdmin("AdminImportSection.summaryErrors", undefined, { count: String(summary.errors) })}
            </Badge>
          </div>
        )}
        {importErrors && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const csv = ["ligne,nom,erreur", ...importErrors.map((r) =>
                `${r.rowIndex},"${r.name.replace(/"/g, '""')}","${r.error.replace(/"/g, '""')}"`,
              )].join("\n");
              downloadCsv(csv, "rapport-erreurs-import.csv");
            }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> {tAdmin("AdminImportSection.importErrorReport", undefined, { count: String(importErrors.length) })}
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
              downloadCsv(csv, "rapport-erreurs-preview.csv");
            }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> {tAdmin("AdminImportSection.errorReport", undefined, { count: String(preview.filter((r) => !r.success || r.msgErrorAddress).length) })}
          </Button>
        )}
        {preview && (
          <div className="max-h-96 overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tAdmin("AdminImportSection.colIndex")}</TableHead>
                  <TableHead>{tAdmin("AdminImportSection.colOk")}</TableHead>
                  <TableHead>{tAdmin("AdminImportSection.colName")}</TableHead>
                  <TableHead>{tAdmin("AdminImportSection.colAddress")}</TableHead>
                  <TableHead>{tAdmin("AdminImportSection.colWarnings")}</TableHead>
                  <TableHead>{tAdmin("AdminImportSection.colAddressError")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((r) => (
                  <TableRow key={r.rowIndex}>
                    <TableCell>{r.rowIndex}</TableCell>
                    <TableCell>
                      {r.success
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        : <XCircle className="h-4 w-4 text-destructive" />}
                    </TableCell>
                    <TableCell>{String((r.data?.name as string | undefined) ?? "—")}</TableCell>
                    <TableCell>
                      {(() => {
                        // Le POINT DE VALEUR du géocodage : la commune résolue (localityId) + geo.
                        const addr = r.data?.address as { addressLocality?: string; postalCode?: string; localityId?: string } | undefined;
                        const geo = r.data?.geo as { latitude?: unknown } | undefined;
                        if (!addr?.localityId) return <span className="text-muted-foreground">—</span>;
                        return (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            {addr.addressLocality}{addr.postalCode ? ` (${addr.postalCode})` : ""}
                            {geo?.latitude ? <MapPin className="h-3.5 w-3.5" /> : null}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-amber-600 dark:text-amber-400">{(r.warnings ?? []).join(", ") || "—"}</TableCell>
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
        title={tAdmin("AdminImportSection.blockerTitle")}
        description={tAdmin("AdminImportSection.blockerDescription")}
        confirmLabel={tAdmin("AdminImportSection.blockerConfirm")}
        cancelLabel={tAdmin("AdminImportSection.blockerCancel")}
        isDestructive
      />
    </Card>
  );
}
