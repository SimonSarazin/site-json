import { useMemo, useState } from "react";
import { ArrowLeftRight, Download, History, RotateCcw } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useUnsavedChangesWarning } from "@/modules/coform/hooks/useUnsavedChangesWarning";
import "@/modules/admin/i18n";

import { OwnershipMigrationDialog } from "../components/OwnershipMigrationDialog";
import { useOwnershipMigration, type TransferRunSummary } from "../hooks/useOwnershipMigration";

import type { AdminSection } from "../schema";

/**
 * Section costum « migration d'appropriation » (`{type:"ownershipMigration"}`) : reprend la
 * PROPRIÉTÉ d'un lot de fiches du costum `from` (régional/agrégateur) pour CE site, `from` restant
 * en référencement — la reprise du STOCK, pendante de la création déjà couverte par les
 * `mutation.stamps` des costumForms.
 *
 * V2 : la section n'est plus qu'un SÉLECTEUR (collection + critère whitelisté) + l'HISTORIQUE des
 * runs ; l'analyse, les options PAR RUN (subType/keysPolicy — décisions éclairées par le rapport,
 * la config ne fournit que des défauts) et l'apply vivent dans `OwnershipMigrationDialog`,
 * réutilisé tel quel par la bulkAction ids[] d'AdminResourceTable. Le serveur re-déroule tous les
 * contrôles à l'apply et porte le gate — l'UI n'est jamais l'autorité.
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
  /** DÉFAUT d'annotation de sous-type : "auto" (déduite du type), "" (aucune), ou valeur explicite.
   *  Ajustable PAR RUN dans le dialog. */
  subType: z.string().optional(),
  /** false = transfert sec (pas de référencement du cédant). Défaut true. */
  keepReference: z.boolean().optional(),
  /** DÉFAUT de politique source.keys — "replace" : from→to DANS keys en préservant les clés
   *  secondaires (ex. marqueur ESS974). Défaut serveur : "strict" (keys = [to]), bloqué par
   *  multipleSourceKeys si une clé serait perdue. Ajustable PAR RUN dans le dialog. */
  keysPolicy: z.enum(["strict", "replace"]).optional(),
});

export default function AdminOwnershipMigrationSection({ section }: { section: AdminSection }) {
  const t = useT("modules/admin");
  const { entity } = useCocolight();
  const parsed = useMemo(() => PropsSchema.safeParse((section as { props?: unknown }).props ?? {}), [section]);
  const { rollback, history, downloadSnapshot } = useOwnershipMigration();

  const [selectorIdx, setSelectorIdx] = useState(0);
  const [collection, setCollection] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState<string | null>(null);

  useUnsavedChangesWarning(rollback.isPending);

  if (!parsed.success) {
    return <p className="text-destructive">{t("AdminOwnershipMigration.badConfig")}</p>;
  }
  if (!entity) {
    return <p className="text-muted-foreground">{t("AdminOwnershipMigration.noContext")}</p>;
  }
  const props = parsed.data;
  const coll = collection ?? props.collections[0]!;
  const selector = props.selectors[selectorIdx] ?? props.selectors[0]!;

  return (
    <div className="space-y-6">
      {/* ── Choix du périmètre → analyse dans le dialog ──────────────────────────────────────── */}
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
            <Button onClick={() => setDialogOpen(true)}>
              {t("AdminOwnershipMigration.analyze")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <OwnershipMigrationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        from={props.from}
        collection={coll}
        selection={{ field: selector.field, value: selector.value }}
        selectionLabel={selector.label ? t(selector.label) : undefined}
        defaults={{ subType: props.subType, keepReference: props.keepReference, keysPolicy: props.keysPolicy }}
        onApplied={() => void history.refetch()}
      />

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
                      <Button variant="ghost" size="sm" disabled={rollback.isPending} onClick={() => setConfirmRollback(run.migrationId)}>
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
          rollback.mutate(id);
        }}
      />
    </div>
  );
}
