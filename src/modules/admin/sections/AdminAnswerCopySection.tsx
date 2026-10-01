import { Copy, Loader2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useDebounce } from "@/hooks/useDebounce";
import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";
import SearchTextInput from "@/modules/search/components/SearchTextInput";
import { useSearchAllResults } from "@/modules/search/hooks/useSearchAllResults";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import type { SearchType } from "@/modules/search/schema";

import { AdminTableShell } from "../components/AdminTableShell";
import { ADMIN_QUERY_KEYS } from "../constants/queryKeys";
import { useCopyAnswer, type CopyAnswerVariables } from "../hooks/useCopyAnswer";
import { buildCopyIndex, DEFAULT_DUPLICATE_KEYS, rankByCopyStatus, rowData, rowId, type CopyStatus } from "../lib/answerCopy";
import type { AdminAnswerCopySection as AdminAnswerCopySectionConfig, AdminSection } from "../schema";
import { formatColumnCell, normalizeColumns, STATUS_TONE_CLASS } from "./resourceHelpers";

const DEFAULT_COLUMNS = [
  { path: "name", label: { fr: "Intitulé", en: "Title" } },
  { path: "structure.name", label: { fr: "Structure", en: "Organization" } },
  { path: "address.postalCode", label: { fr: "Code postal", en: "Postal code" } },
];
// Constantes de lisibilité : `useSearchQuery` SÉRIALISE ces objets dans la queryKey — la
// référence n'a aucun effet, seule la valeur compte.
const ANSWERS_TYPE = { type: ["answers"] };
const EMPTY_TAGS: Record<string, string[]> = {};
/** Plafond de l'index cible : au-delà, une candidate pourrait passer pour « À copier » à tort. */
const TARGET_MAX_RESULTS = 2000;

/** Ton du badge des états AFFICHÉS — mêmes tokens que la modération (`STATUS_TONE_CLASS`). */
const STATUS_BADGE_CLASS: Record<Exclude<CopyStatus, "copied">, string | undefined> = {
  probable: STATUS_TONE_CLASS.pending,
  new: undefined,
};

/**
 * Section `answerCopy` — reprise, une par une, des réponses d'un form SOURCE (autre site) dans
 * le form CIBLE du site. Deux lectures, une écriture :
 *
 *  - **candidates** : recherche `answers` du form source (infinite scroll, `variant: "admin"` →
 *    documents complets aplatis par le hook costum, `notSourceKey` posé d'office car ces
 *    réponses appartiennent à un autre site) ;
 *  - **index cible** : TOUTES les réponses du form cible (`useSearchAllResults`, cache court : il
 *    sert de VÉRITÉ à une décision) → trace `copiedFrom` et empreintes `duplicateKeys`
 *    (`buildCopyIndex`). Tant qu'il n'est pas complet — première page en vol, pages suivantes,
 *    refetch après une copie, erreur — « Copier » reste désactivé : un index partiel ou vide par
 *    erreur ferait passer une copie faite pour « À copier » ;
 *  - **copie** : `useCopyAnswer` (serveur, idempotente). Un « Doublon probable » demande
 *    confirmation — le serveur ne connaît pas l'empreinte, seule la trace `copiedFrom` le protège.
 *    Une ligne copiée passe « Copié » immédiatement (mémoire locale), sans attendre le refetch.
 *
 * Affichage : les lignes « Copié » sont MASQUÉES (leur nombre est dit), les autres ordonnées —
 * « À copier » avant « Doublon probable » (`rankByCopyStatus`), l'ordre serveur restant celui de
 * chaque groupe. Le masquage est CLIENT (le serveur ne connaît pas la trace, portée par le form
 * cible) : la sentinelle du scroll infini est donc une ligne dédiée, rendue dès qu'une page suit —
 * une page entièrement copiée ne rend aucune ligne et bloquerait sinon le chargement de la suivante.
 * Rien n'est listé tant que l'index cible n'est pas prêt : sans lui, on ne sait pas quoi masquer.
 */
export default function AdminAnswerCopySection({ section }: { section: AdminSection }) {
  const cfg = section as AdminAnswerCopySectionConfig;
  const t = useT();
  const tAdmin = useT("modules/admin");
  const tSearch = useT("modules/search");
  const columns = normalizeColumns(cfg.columns, DEFAULT_COLUMNS);
  const duplicateKeys = cfg.duplicateKeys ?? DEFAULT_DUPLICATE_KEYS;

  const [q, setQ] = useState("");
  const searchText = useDebounce(q, 300);

  // ── Index du form cible (complet) ──────────────────────────────────────────────────────────
  const targetParams = useMemo(
    () => ({ defaultTypes: ["answers"] as SearchType[], notSourceKey: true, defaultFilters: { form: cfg.targetForm }, indexStepList: 100 }),
    [cfg.targetForm],
  );
  const target = useSearchAllResults({
    queryKeyPrefix: ADMIN_QUERY_KEYS.ANSWER_COPY_TARGET_PREFIX(cfg.targetForm),
    searchType: ANSWERS_TYPE,
    baseParams: targetParams,
    maxResults: TARGET_MAX_RESULTS,
    variant: "admin",
    // Toujours relu au (re)montage de l'onglet : une copie supprimée par un autre canal doit cesser
    // de compter. L'index reste petit (un form dédié), le coût est celui de quelques pages.
    cache: { staleTime: 0 },
  });
  // Copies faites DANS cette session : la ligne passe « Copié » sans attendre le refetch de l'index.
  const [localCopies, setLocalCopies] = useState<ReadonlyMap<string, string>>(new Map());
  const index = useMemo(() => {
    const built = buildCopyIndex(target.results, duplicateKeys);
    for (const [sourceId, copyId] of localCopies) built.copies.set(sourceId, copyId);
    return built;
  }, [target.results, duplicateKeys, localCopies]);
  const indexState: "ready" | "loading" | "capped" | "error" = target.error
    ? "error"
    : target.capped
      ? "capped"
      : target.isPending || target.isFetching || !target.isComplete
        ? "loading"
        : "ready";

  // ── Candidates (form source) ───────────────────────────────────────────────────────────────
  const sourceParams = useMemo(
    () => ({
      ...cfg.source,
      defaultTypes: ["answers"] as SearchType[],
      notSourceKey: true,
      defaultFilters: { ...(cfg.source?.defaultFilters ?? {}), form: cfg.sourceForm },
    }),
    [cfg.source, cfg.sourceForm],
  );
  const candidates = useSearchQuery({
    queryKeyPrefix: ADMIN_QUERY_KEYS.ANSWER_COPY_SOURCE_PREFIX(cfg.sourceForm),
    searchText,
    searchTags: EMPTY_TAGS,
    searchType: ANSWERS_TYPE,
    mapUsed: false,
    baseParams: sourceParams,
    variant: "admin",
    // Sans index prêt, on ne sait pas quoi masquer : pas de fetch (les données déjà reçues restent).
    enabled: indexState === "ready",
  });

  // ── Copie ──────────────────────────────────────────────────────────────────────────────────
  const mutation = useCopyAnswer(cfg.targetForm, (sourceId, copyId) =>
    setLocalCopies((prev) => new Map(prev).set(sourceId, copyId)),
  );
  const [pendingConfirm, setPendingConfirm] = useState<CopyAnswerVariables | null>(null);
  const requestCopy = (vars: CopyAnswerVariables, status: CopyStatus) => {
    if (status === "probable") setPendingConfirm(vars);
    else mutation.mutate(vars);
  };
  const confirmCopy = () => {
    if (pendingConfirm) mutation.mutate(pendingConfirm);
    setPendingConfirm(null);
  };

  const ranked = useMemo(
    () => rankByCopyStatus(candidates.transformedResults ?? [], index, duplicateKeys),
    [candidates.transformedResults, index, duplicateKeys],
  );
  const visible = useMemo(() => ranked.filter((r) => r.verdict.status !== "copied"), [ranked]);
  const hiddenCopied = ranked.length - visible.length;
  const canCopy = indexState === "ready" && !mutation.isPending;

  const indexStatus = (
    <span className="flex items-center gap-1 text-sm text-muted-foreground" aria-live="polite">
      {indexState === "ready" && tAdmin("AdminAnswerCopySection.indexed", undefined, { count: String(target.loaded) })}
      {indexState === "loading" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {tAdmin("AdminAnswerCopySection.indexing")}
        </>
      )}
      {(indexState === "capped" || indexState === "error") && (
        <>
          <TriangleAlert className="h-3.5 w-3.5 text-destructive" />
          {tAdmin(indexState === "capped" ? "AdminAnswerCopySection.indexCapped" : "AdminAnswerCopySection.indexError")}
        </>
      )}
    </span>
  );

  const head = (
    <TableRow>
      {columns.map((col) => (
        <TableHead key={col.path} className={col.label ? undefined : "capitalize"}>
          {col.label ? t(col.label) : col.path}
        </TableHead>
      ))}
      <TableHead>{tAdmin("AdminAnswerCopySection.colStatus")}</TableHead>
      <TableHead className="w-40 text-right">{tAdmin("AdminAnswerCopySection.colAction")}</TableHead>
    </TableRow>
  );

  const body = (
    <>
      {visible.map(({ row: item, verdict }, i) => {
        const data = rowData(item);
        const id = rowId(item);
        const name = (typeof data.name === "string" && data.name) || id;
        const status = verdict.status as Exclude<CopyStatus, "copied">; // les « Copié » sont filtrés plus haut
        return (
          <TableRow key={id || i}>
            {columns.map((col) => (
              <TableCell key={col.path} className="max-w-[14rem] truncate">
                {formatColumnCell(data, col.path, tSearch)}
              </TableCell>
            ))}
            <TableCell>
              <Badge variant={status === "new" ? "outline" : "default"} className={STATUS_BADGE_CLASS[status]}>
                {tAdmin(`AdminAnswerCopySection.status.${status}`)}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button size="sm" variant="outline" disabled={!canCopy || !id} onClick={() => requestCopy({ answerId: id, name }, status)}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                {tAdmin("AdminAnswerCopySection.copy")}
              </Button>
            </TableCell>
          </TableRow>
        );
      })}
      {candidates.hasNextPage && (
        // Sentinelle du scroll infini : une ligne dédiée, indépendante des lignes masquées.
        <TableRow ref={candidates.lastItemRef} data-testid="answer-copy-sentinel">
          <TableCell colSpan={columns.length + 2} className="py-2 text-center text-xs text-muted-foreground">
            {candidates.isFetchingNextPage ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : null}
          </TableCell>
        </TableRow>
      )}
    </>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Copy className="h-5 w-5" />
          {cfg.title ? t(cfg.title) : tAdmin("AdminAnswerCopySection.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{tAdmin("AdminAnswerCopySection.hint")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <SearchTextInput className="max-w-xs" placeholder={tAdmin("AdminAnswerCopySection.searchPlaceholder")} value={q} onChange={setQ} />
          <span className="text-sm text-muted-foreground">
            {candidates.totalCount != null && tAdmin("AdminAnswerCopySection.candidates", undefined, { count: String(candidates.totalCount) })}
            {hiddenCopied > 0 && ` · ${tAdmin("AdminAnswerCopySection.hiddenCopied", undefined, { count: String(hiddenCopied) })}`}
          </span>
          {indexStatus}
        </div>

        <AdminTableShell
          head={head}
          body={body}
          loading={indexState === "loading" || candidates.isLoading}
          empty={indexState === "ready" && visible.length === 0}
          emptyMessage={tAdmin("AdminAnswerCopySection.empty")}
          maxHeightClass="max-h-[60vh]"
        />
      </CardContent>

      <ConfirmDialog
        open={pendingConfirm !== null}
        onOpenChange={(open) => { if (!open) setPendingConfirm(null); }}
        onConfirm={confirmCopy}
        title={tAdmin("AdminAnswerCopySection.confirmTitle", undefined, { name: pendingConfirm?.name ?? "" })}
        description={tAdmin("AdminAnswerCopySection.confirmDescription")}
        confirmLabel={tAdmin("AdminAnswerCopySection.confirmAction")}
        cancelLabel={tAdmin("AdminAnswerCopySection.cancel")}
        isPending={mutation.isPending}
      />
    </Card>
  );
}
