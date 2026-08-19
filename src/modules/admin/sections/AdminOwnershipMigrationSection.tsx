import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Download, History, RotateCcw, XCircle } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useUnsavedChangesWarning } from "@/modules/coform/hooks/useUnsavedChangesWarning";
import "@/modules/admin/i18n";

import { useOwnershipMigration, type TransferCheckResult, type TransferParams, type TransferRunSummary } from "../hooks/useOwnershipMigration";

import type { AdminSection } from "../schema";

/**
 * Section costum « migration d'appropriation » (`{type:"ownershipMigration"}`) : reprend la
 * PROPRIÉTÉ d'un lot de fiches du costum `from` (régional/agrégateur) pour CE site, `from` restant
 * en référencement — la reprise du STOCK, pendante de la création déjà couverte par les
 * `mutation.stamps` des costumForms. Flux : critère → ANALYSE (dry-run serveur : contrôles
 * bloquants/warnings, schéma costum, exemple avant/après) → confirmation (poste `expectedCount`) →
 * rapport (compteurs auto-vérifiés + migrationId) → historique/rollback/snapshot.
 *
 * Générique par construction : `from`, collections et sélecteurs viennent de la CONFIG (props) ;
 * le serveur re-déroule tous les contrôles à l'apply (la sélection peut bouger entre-temps) et
 * gate super-admin OU (admin de `from` ET admin du site) — l'UI n'est jamais l'autorité.
 */

/** Props de la section — validées ICI (AdminCustomSectionSchema laisse `props` libre, à dessein). */
const PropsSchema = z.object({
  /** Slug du costum CÉDANT (le régional/agrégateur dont on reprend la data). */
  from: z.string().min(1),
  /** Collections proposées (défaut : poi). */
  collections: z.array(z.string()).min(1).default(["poi"]),
  /** Sélections de masse proposées à l'opérateur (whitelist serveur sur `field`). */
  selectors: z
    .array(
      z.object({
        field: z.string().min(1),
        value: z.string().min(1),
        label: z.record(z.string(), z.string()).optional(),
      }),
    )
    .min(1),
  /** Annotation de sous-type : "auto" (déduite du type), "" (aucune), ou valeur explicite. */
  subType: z.string().optional(),
  /** false = transfert sec (pas de référencement du cédant). Défaut true. */
  keepReference: z.boolean().optional(),
});

const CONTROL_ORDER_HINT = "AdminOwnershipMigration.controls.";

export default function AdminOwnershipMigrationSection({ section }: { section: AdminSection }) {
  const t = useT("modules/admin");
  const { entity } = useCocolight();
  const parsed = useMemo(() => PropsSchema.safeParse((section as { props?: unknown }).props ?? {}), [section]);
  const { check, apply, rollback, history, downloadSnapshot } = useOwnershipMigration();

  const [selectorIdx, setSelectorIdx] = useState(0);
  const [collection, setCollection] = useState<string | null>(null);
  const [report, setReport] = useState<TransferCheckResult | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState<string | null>(null);

  const busy = check.isPending || apply.isPending || rollback.isPending;
  useUnsavedChangesWarning(apply.isPending || rollback.isPending);

  if (!parsed.success) {
    return <p className="text-destructive">{t("AdminOwnershipMigration.badConfig")}</p>;
  }
  if (!entity) {
    return <p className="text-muted-foreground">{t("AdminOwnershipMigration.noContext")}</p>;
  }
  const props = parsed.data;
  const coll = collection ?? props.collections[0]!;
  const selector = props.selectors[selectorIdx] ?? props.selectors[0]!;

  const params: TransferParams = {
    from: props.from,
    collection: coll,
    selection: { field: selector.field, value: selector.value },
    options: {
      ...(props.subType !== undefined ? { subType: props.subType } : {}),
      ...(props.keepReference !== undefined ? { keepReference: props.keepReference } : {}),
    },
  };

  const runCheck = () => {
    setReport(null);
    check.mutate(params, { onSuccess: (res) => setReport(res) });
  };
  const runApply = () => {
    apply.mutate(
      { ...params, expectedCount: report?.counts?.selected ?? 0 },
      { onSuccess: (res) => setReport(res) },
    );
  };

  const applied = report && "migrationId" in report ? (report as TransferCheckResult & { migrationId?: string; applied?: Record<string, number>; verification?: Record<string, number> }) : null;

  return (
    <div className="space-y-6">
      {/* ── Choix du périmètre + analyse ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" aria-hidden />
            {t("AdminOwnershipMigration.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("AdminOwnershipMigration.intro", undefined, { from: props.from })}
          </p>
          <div className="flex flex-wrap items-end gap-4">
            {props.collections.length > 1 && (
              <div className="space-y-1">
                <Label>{t("AdminOwnershipMigration.collection")}</Label>
                <Select value={coll} onValueChange={setCollection}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {props.collections.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>{t("AdminOwnershipMigration.selector")}</Label>
              <Select value={String(selectorIdx)} onValueChange={(v) => setSelectorIdx(Number(v))}>
                <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {props.selectors.map((s, i) => (
                    <SelectItem key={`${s.field}:${s.value}`} value={String(i)}>
                      {s.label ? t(s.label) : `${s.field} = ${s.value}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={runCheck} disabled={busy}>
              {check.isPending ? t("AdminOwnershipMigration.analyzing") : t("AdminOwnershipMigration.analyze")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Rapport d'analyse (dry-run) / rapport d'application ──────────────────────────────── */}
      {report && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {applied?.migrationId
                ? t("AdminOwnershipMigration.appliedTitle")
                : t("AdminOwnershipMigration.reportTitle", undefined, { count: report.counts?.selected ?? 0 })}
            </CardTitle>
            {!applied?.migrationId && report.canApply && (
              <Button onClick={() => setConfirmApply(true)} disabled={busy}>
                {t("AdminOwnershipMigration.apply", undefined, { count: report.counts?.selected ?? 0 })}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* compteurs par localité / type */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(report.counts?.byLocality ?? {}).map(([k, n]) => (
                <Badge key={`loc-${k}`} variant="secondary">{k} : {n}</Badge>
              ))}
              {Object.entries(report.counts?.byType ?? {}).map(([k, n]) => (
                <Badge key={`typ-${k}`} variant="outline">{k} : {n}</Badge>
              ))}
              {report.subType?.value && (
                <Badge>{t("AdminOwnershipMigration.subType")} : {report.subType.value}</Badge>
              )}
            </div>

            {/* schéma costum */}
            <p className="text-sm text-muted-foreground">
              {t("AdminOwnershipMigration.schema", undefined, {
                fromFields: report.schema?.fromFields ?? 0,
                toFields: report.schema?.toFields ?? 0,
              })}
              {(report.schema?.missing.length ?? 0) > 0 && (
                <span className="text-destructive"> — {t("AdminOwnershipMigration.schemaMissing")} : {report.schema!.missing.join(", ")}</span>
              )}
            </p>

            {/* contrôles */}
            <div className="max-h-[40vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>{t("AdminOwnershipMigration.control")}</TableHead>
                    <TableHead className="w-20 text-right">{t("AdminOwnershipMigration.count")}</TableHead>
                    <TableHead>{t("AdminOwnershipMigration.concerned")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report.controls ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        {c.count === 0
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                          : c.level === "blocking"
                            ? <XCircle className="h-4 w-4 text-destructive" aria-hidden />
                            : <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />}
                      </TableCell>
                      <TableCell className="text-sm">{t(`${CONTROL_ORDER_HINT}${c.id}`)}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                      <TableCell className="truncate text-xs text-muted-foreground">{c.ids.join(", ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* exemple avant / après */}
            {report.sample && !applied?.migrationId && (
              <details className="text-xs">
                <summary className="cursor-pointer text-sm font-medium">
                  {t("AdminOwnershipMigration.sample", undefined, { name: report.sample.name ?? report.sample.id })}
                </summary>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <pre className="overflow-auto rounded bg-muted p-2">{JSON.stringify(report.sample.before, null, 1)}</pre>
                  <pre className="overflow-auto rounded bg-muted p-2">{JSON.stringify(report.sample.after, null, 1)}</pre>
                </div>
              </details>
            )}

            {/* rapport d'application */}
            {applied?.migrationId && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge>{t("AdminOwnershipMigration.migrated")} : {applied.applied?.migrated ?? 0}</Badge>
                  <Badge variant="secondary">{t("AdminOwnershipMigration.referenced")} : {applied.applied?.referenceAdded ?? 0}</Badge>
                  <Badge variant="secondary">{t("AdminOwnershipMigration.annotated")} : {applied.applied?.annotated ?? 0}</Badge>
                  <Badge variant={applied.verification?.stillOwnedByFrom ? "destructive" : "outline"}>
                    {t("AdminOwnershipMigration.verification", undefined, {
                      ownedByTo: applied.verification?.ownedByTo ?? 0,
                      stillOwnedByFrom: applied.verification?.stillOwnedByFrom ?? 0,
                    })}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void downloadSnapshot(applied.migrationId!)}>
                    <Download className="mr-2 h-4 w-4" aria-hidden />
                    {t("AdminOwnershipMigration.downloadSnapshot")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmRollback(applied.migrationId!)} disabled={busy}>
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
                    {t("AdminOwnershipMigration.rollback")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Historique des migrations ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" aria-hidden />
            {t("AdminOwnershipMigration.historyTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <p className="text-muted-foreground">{t("AdminOwnershipMigration.loading")}</p>
          ) : (history.data?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{t("AdminOwnershipMigration.historyEmpty")}</p>
          ) : (
            <ul className="divide-y">
              {(history.data as TransferRunSummary[]).map((run) => (
                <li key={run.migrationId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {run.from} → {run.to} · {run.collection}
                      {run.selection.field ? ` · ${run.selection.field} = ${run.selection.value}` : ""}
                    </p>
                    <p className="text-muted-foreground">
                      {new Date(run.created * 1000).toLocaleString()} · {run.author?.name ?? run.author?.id}
                      {" · "}{t("AdminOwnershipMigration.selected")} : {run.counts?.selected ?? 0}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={run.status === "applied" ? "default" : run.status === "rolledback" ? "secondary" : "destructive"}>
                      {t(`AdminOwnershipMigration.status.${run.status}`)}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => void downloadSnapshot(run.migrationId)}>
                      <Download className="h-4 w-4" aria-hidden />
                    </Button>
                    {run.status !== "rolledback" && (
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmRollback(run.migrationId)}>
                        <RotateCcw className="mr-1 h-4 w-4" aria-hidden />
                        {t("AdminOwnershipMigration.rollback")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Confirmations ────────────────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmApply}
        onOpenChange={setConfirmApply}
        title={t("AdminOwnershipMigration.confirmApplyTitle")}
        description={t("AdminOwnershipMigration.confirmApplyDesc", undefined, {
          count: report?.counts?.selected ?? 0,
          from: props.from,
        })}
        confirmLabel={t("AdminOwnershipMigration.confirmApply")}
        isDestructive
        isPending={apply.isPending}
        onConfirm={() => {
          setConfirmApply(false);
          runApply();
        }}
      />
      <ConfirmDialog
        open={confirmRollback !== null}
        onOpenChange={(o) => { if (!o) setConfirmRollback(null); }}
        title={t("AdminOwnershipMigration.confirmRollbackTitle")}
        description={t("AdminOwnershipMigration.confirmRollbackDesc")}
        confirmLabel={t("AdminOwnershipMigration.confirmRollback")}
        isDestructive
        isPending={rollback.isPending}
        onConfirm={() => {
          const id = confirmRollback!;
          setConfirmRollback(null);
          rollback.mutate(id, { onSuccess: () => setReport(null) });
        }}
      />
    </div>
  );
}
