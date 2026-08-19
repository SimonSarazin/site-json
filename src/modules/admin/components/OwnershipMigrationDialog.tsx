import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, RotateCcw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useT } from "@/hooks/useT";
import { useUnsavedChangesWarning } from "@/modules/coform/hooks/useUnsavedChangesWarning";
import "@/modules/admin/i18n";

import { useOwnershipMigration, type TransferCheckResult, type TransferParams } from "../hooks/useOwnershipMigration";

/**
 * Dialog RÉUTILISABLE de migration d'appropriation (le morceau « OwnershipMigrationDialog » de la
 * V2 planifiée) : reçoit un périmètre {from, collection, selection} — critère whitelisté OU ids[]
 * (bulkAction de la table admin) — et déroule check → options PAR RUN → apply → rapport/rollback.
 *
 * Leçon de la migration Saint-Paul : `subType` et `keysPolicy` sont des décisions PAR RUN,
 * éclairées par le rapport d'analyse (types hétérogènes, multi-rattachements découverts au check) —
 * la config du site ne fournit que des DÉFAUTS. Tout changement d'option invalide le rapport
 * (l'apply n'est possible que sur une analyse conforme aux options courantes) ; le serveur
 * re-déroule de toute façon tous les contrôles à l'apply (l'UI n'est jamais l'autorité).
 */

export interface OwnershipTransferDefaults {
  subType?: string;
  keepReference?: boolean;
  keysPolicy?: "strict" | "replace";
}

interface OwnershipMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Slug du costum CÉDANT. */
  from: string;
  collection: string;
  /** Critère whitelisté (section) ou ids[] (bulkAction / rowAction). */
  selection: { ids: string[] } | { field: string; value: string };
  /** Libellé humain du périmètre (affiché dans l'en-tête). */
  selectionLabel?: string;
  /** Défauts venus de la config du site (surchargeables par l'opérateur). */
  defaults?: OwnershipTransferDefaults;
  /** Appelé après un apply réussi (invalidation de la vue appelante). */
  onApplied?: () => void;
}

const CONTROL_KEY = "AdminOwnershipMigration.controls.";

export function OwnershipMigrationDialog({
  open, onOpenChange, from, collection, selection, selectionLabel, defaults, onApplied,
}: OwnershipMigrationDialogProps) {
  const t = useT("modules/admin");
  const { check, apply, rollback, downloadSnapshot } = useOwnershipMigration();

  const [subType, setSubType] = useState(defaults?.subType ?? "auto");
  const [keysPolicy, setKeysPolicy] = useState<"strict" | "replace">(defaults?.keysPolicy ?? "strict");
  const [report, setReport] = useState<TransferCheckResult | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState<string | null>(null);

  const busy = check.isPending || apply.isPending || rollback.isPending;
  useUnsavedChangesWarning(apply.isPending || rollback.isPending);

  const params: TransferParams = {
    from,
    collection,
    selection,
    options: {
      subType,
      keysPolicy,
      ...(defaults?.keepReference !== undefined ? { keepReference: defaults.keepReference } : {}),
    },
  };

  const runCheck = (p: TransferParams) => {
    setReport(null);
    check.mutate(p, { onSuccess: (res) => setReport(res) });
  };

  // Ouverture : options remises aux défauts, analyse lancée immédiatement (le rapport EST l'écran).
  useEffect(() => {
    if (!open) return;
    const st = defaults?.subType ?? "auto";
    const kp = defaults?.keysPolicy ?? "strict";
    setSubType(st);
    setKeysPolicy(kp);
    setConfirmApply(false);
    setConfirmRollback(null);
    runCheck({ ...params, options: { ...params.options, subType: st, keysPolicy: kp } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- relance uniquement à l'ouverture
  }, [open]);

  const changeOption = (apply_: () => void) => {
    apply_();
    setReport(null); // l'analyse affichée ne correspond plus aux options → invalider
  };

  const runApply = () => {
    apply.mutate(
      { ...params, expectedCount: report?.counts?.selected ?? 0 },
      { onSuccess: (res) => { setReport(res); onApplied?.(); } },
    );
  };

  const applied = report && "migrationId" in report
    ? (report as TransferCheckResult & { migrationId?: string; applied?: Record<string, number>; verification?: Record<string, number> })
    : null;
  const selectionText = selectionLabel
    ?? ("ids" in selection
      ? t("AdminOwnershipMigration.selectionIds", undefined, { count: selection.ids.length })
      : `${selection.field} = ${selection.value}`);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
        <DialogContent className="max-h-[85vh] gap-4 overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("AdminOwnershipMigration.title")}</DialogTitle>
            <DialogDescription>
              {t("AdminOwnershipMigration.intro", undefined, { from })} · {collection} · {selectionText}
            </DialogDescription>
          </DialogHeader>

          {/* ── Options PAR RUN (défauts config, ajustables — tout changement invalide l'analyse) ── */}
          <div className="flex flex-wrap items-end gap-4 rounded-md border bg-muted/40 p-3">
            <div className="space-y-1">
              <Label htmlFor="om-subtype">{t("AdminOwnershipMigration.optionSubType")}</Label>
              <Input
                id="om-subtype"
                className="w-44"
                value={subType}
                disabled={busy || !!applied?.migrationId}
                onChange={(e) => changeOption(() => setSubType(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">{t("AdminOwnershipMigration.optionSubTypeHint")}</p>
            </div>
            <div className="space-y-1">
              <Label>{t("AdminOwnershipMigration.optionKeysPolicy")}</Label>
              <Select
                value={keysPolicy}
                disabled={busy || !!applied?.migrationId}
                onValueChange={(v) => changeOption(() => setKeysPolicy(v as "strict" | "replace"))}
              >
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="strict">{t("AdminOwnershipMigration.keysPolicyStrict")}</SelectItem>
                  <SelectItem value="replace">{t("AdminOwnershipMigration.keysPolicyReplace")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!report && !check.isPending && (
              <Button onClick={() => runCheck(params)} disabled={busy}>
                {t("AdminOwnershipMigration.analyze")}
              </Button>
            )}
            {check.isPending && <p className="text-sm text-muted-foreground">{t("AdminOwnershipMigration.analyzing")}</p>}
            {!report && !check.isPending && (
              <p className="w-full text-xs text-muted-foreground">{t("AdminOwnershipMigration.optionsChanged")}</p>
            )}
          </div>

          {/* ── Rapport (dry-run ou application) ─────────────────────────────────────────────────── */}
          {report && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">
                  {applied?.migrationId
                    ? t("AdminOwnershipMigration.appliedTitle")
                    : t("AdminOwnershipMigration.reportTitle", undefined, { count: report.counts?.selected ?? 0 })}
                </p>
                {!applied?.migrationId && report.canApply && (
                  <Button onClick={() => setConfirmApply(true)} disabled={busy}>
                    {t("AdminOwnershipMigration.apply", undefined, { count: report.counts?.selected ?? 0 })}
                  </Button>
                )}
              </div>

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

              {/* Types constatés = suggestions cliquables pour l'annotation (cas hétérogène). */}
              {!applied?.migrationId && (report.subType?.types?.filter((x): x is string => !!x).length ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("AdminOwnershipMigration.subTypeSuggestions")}{" "}
                  {report.subType!.types.filter((x): x is string => !!x).map((ty) => (
                    <Button key={ty} variant="outline" size="sm" className="mr-1 h-6 px-2 text-xs"
                      disabled={busy} onClick={() => changeOption(() => setSubType(ty))}>
                      {ty}
                    </Button>
                  ))}
                </p>
              )}

              <p className="text-sm text-muted-foreground">
                {t("AdminOwnershipMigration.schema", undefined, {
                  fromFields: report.schema?.fromFields ?? 0,
                  toFields: report.schema?.toFields ?? 0,
                })}
                {(report.schema?.missing.length ?? 0) > 0 && (
                  <span className="text-destructive"> — {t("AdminOwnershipMigration.schemaMissing")} : {report.schema!.missing.join(", ")}</span>
                )}
              </p>

              <div className="max-h-[35vh] overflow-auto rounded-md border">
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
                        <TableCell className="text-sm">{t(`${CONTROL_KEY}${c.id}`)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                        <TableCell className="truncate text-xs text-muted-foreground">{c.ids.join(", ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

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
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmApply}
        onOpenChange={setConfirmApply}
        title={t("AdminOwnershipMigration.confirmApplyTitle")}
        description={t("AdminOwnershipMigration.confirmApplyDesc", undefined, {
          count: report?.counts?.selected ?? 0,
          from,
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
          rollback.mutate(id, { onSuccess: () => { setReport(null); onApplied?.(); } });
        }}
      />
    </>
  );
}
