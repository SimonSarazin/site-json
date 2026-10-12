import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { publicSurfaceKeys } from "@/lib/queryKeys";
import "@/modules/admin/i18n";

import { ensureCostumScope } from "@/lib/ensureCostumScope";

/**
 * Migration d'APPROPRIATION (endpoints TRANSFER_SOURCE_*, nés en miroir legacy/Node) : la propriété
 * (`source.key/keys`) d'un ensemble de fiches du costum `from` passe au costum de CE site, `from`
 * restant en référencement (+ annotation `reference.costumTypes.<from>`). C'est le geste que ni
 * l'import (provenance préservée) ni setSource (refus set=source) ne savent faire — voie dédiée,
 * gatée serveur : super-admin OU (admin de `from` ET admin de `to`).
 *
 * Flux : check (dry-run, aucune écriture) → apply (journalisé dans `sourceMigrations`, snapshot
 * AVANT écriture, refus si un contrôle bloque ou si `expectedCount` a dérivé) → rollback par
 * migrationId (restauration des racines source/reference, partiel accepté) ; history liste les runs.
 */

export interface TransferSelection {
  ids?: string[];
  field?: string;
  value?: string;
}

export interface TransferOptions {
  keepReference?: boolean;
  subType?: string;
  annotateOnly?: boolean;
  cleanSelfReference?: boolean;
  keysPolicy?: "strict" | "replace";
}

export interface TransferControl { id: string; level: "blocking" | "warning"; count: number; ids: string[] }

export interface TransferCheckResult {
  result: boolean;
  msg?: string;
  canApply?: boolean;
  counts?: { selected: number; byLocality: Record<string, number>; byType: Record<string, number> };
  controls?: TransferControl[];
  subType?: { mode: string; value: string | null; types: (string | null)[] };
  schema?: { fromFields: number; toFields: number; missing: string[] };
  sample?: { id: string; name: string | null; before: unknown; after: unknown } | null;
}

export interface TransferApplyResult extends TransferCheckResult {
  migrationId?: string;
  applied?: { migrated: number; referenceAdded: number; annotated: number; selfReferenceCleaned: number };
  verification?: { ownedByTo: number; stillOwnedByFrom: number };
}

export interface TransferRunSummary {
  migrationId: string;
  status: "applying" | "applied" | "rolledback";
  mode: "transfer" | "annotate";
  from: string;
  to: string;
  collection: string;
  selection: { mode: string; count?: number; field?: string | null; value?: string | null };
  counts: Record<string, number>;
  author: { id: string; name: string | null };
  created: number;
  rollback: { date: number; by: { id: string; name: string | null }; restored: number; skipped: number } | null;
}

/** Le carrier lib (BaseEntity ≥ contrat 175) exposant la migration d'appropriation. */
interface TransferCarrier {
  checkOwnershipTransfer: (p: Record<string, unknown>) => Promise<TransferCheckResult>;
  applyOwnershipTransfer: (p: Record<string, unknown>) => Promise<TransferApplyResult>;
  rollbackOwnershipTransfer: (migrationId: string) => Promise<{ result: boolean; msg?: string; restored?: number; skipped?: { id: string; reason: string }[] }>;
  listOwnershipTransfers: (p?: { migrationId?: string }) => Promise<{ result: boolean; msg?: string; migrations?: TransferRunSummary[]; migration?: Record<string, unknown> }>;
}

export interface TransferParams {
  from: string;
  collection: string;
  selection: TransferSelection;
  options?: TransferOptions;
  expectedCount?: number;
}

/** Télécharge un objet en fichier JSON (jumeau de downloadCsv — le snapshot de rollback). */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useOwnershipMigration() {
  const { entity, contextId, contextType } = useCocolight();
  const queryClient = useQueryClient();
  const t = useT("modules/admin");

  const carrier = (): TransferCarrier => {
    if (!entity) throw new Error(t("AdminOwnershipMigration.noContext"));
    // Scope costum du SITE reposé inconditionnellement (7/19 sites ont un carrier au source.key étranger).
    ensureCostumScope(entity, { contextId: contextId ?? undefined, contextType: contextType ?? undefined });
    return entity as unknown as TransferCarrier;
  };

  /** Refus métier en HTTP 200 (`{result:false, msg}`) → throw, sinon le toast mentirait. */
  const lift = <T extends { result: boolean; msg?: string }>(res: T): T => {
    if (!res || res.result === false) throw new Error(res?.msg || t("AdminOwnershipMigration.error"));
    return res;
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("admin-") });
    for (const key of publicSurfaceKeys(entity?.slug ?? undefined)) void queryClient.invalidateQueries({ queryKey: key });
  };

  const check = useMutation({
    mutationFn: async (params: TransferParams) => lift(await carrier().checkOwnershipTransfer(params as unknown as Record<string, unknown>)),
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("AdminOwnershipMigration.error"));
    },
  });

  const apply = useMutation({
    mutationFn: async (params: TransferParams) => lift(await carrier().applyOwnershipTransfer(params as unknown as Record<string, unknown>)),
    onSuccess: () => {
      toast.success(t("AdminOwnershipMigration.applied"));
      invalidate();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("AdminOwnershipMigration.error"));
    },
  });

  const rollback = useMutation({
    mutationFn: async (migrationId: string) => lift(await carrier().rollbackOwnershipTransfer(migrationId)),
    onSuccess: (res) => {
      const skipped = res.skipped?.length ?? 0;
      if (skipped > 0) toast.warning(t("AdminOwnershipMigration.rolledBackPartial", undefined, { restored: res.restored ?? 0, skipped }));
      else toast.success(t("AdminOwnershipMigration.rolledBack"));
      invalidate();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("AdminOwnershipMigration.error"));
    },
  });

  /** Historique des runs du site (cédant ou repreneur), created décroissant, sans snapshot. */
  const history = useQuery({
    queryKey: ["admin-ownership-history", entity?.slug ?? ""],
    enabled: !!entity,
    queryFn: async () => lift(await carrier().listOwnershipTransfers()).migrations ?? [],
  });

  /** Télécharge le run COMPLET (snapshot inclus) — le fichier de rollback hors-produit. */
  const downloadSnapshot = async (migrationId: string): Promise<void> => {
    try {
      const res = lift(await carrier().listOwnershipTransfers({ migrationId }));
      downloadJson(res.migration, `migration-appropriation-${migrationId}.json`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("AdminOwnershipMigration.error"));
    }
  };

  return { check, apply, rollback, history, downloadSnapshot };
}
