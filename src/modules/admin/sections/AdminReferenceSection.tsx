import { Database, Link2, Link2Off, Plus, Search, Unlink } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { lazy } from "vite-preload";

import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { useCocolight } from "@/hooks/useCocolight";
import { useDebounce } from "@/hooks/useDebounce";
import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";
import SearchTextInput from "@/modules/search/components/SearchTextInput";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import { formsDeCollection, cheminAnnotation, type CostumFormSubTypeLike } from "@/modules/search/lib/costumSubType";
import { useSite } from "@/hooks/useSite";
import { PageFiltersProvider, usePageFiltersOptional } from "@/modules/search/contexts/pageFilters";

import { AdminTableShell } from "../components/AdminTableShell";
import { ScrollableTabsList } from "../components/ScrollableTabsList";

import type { SearchType } from "@/modules/search/schema";

import { ADMIN_QUERY_KEYS } from "../constants/queryKeys";
import { useReferenceElement, type AnnotableEntity, type ReferencingCarrier } from "../hooks/useReferenceElement";
import { ensureCostumScope } from "@/lib/ensureCostumScope";
import type { AdminReferenceSection as AdminReferenceSectionConfig, AdminSection } from "../schema";
import { formatCell, getPath, normalizeColumns } from "./resourceHelpers";
import { applyReferenceFacets } from "../lib/referenceFacets";

// Panneau de filtres : chargé seulement quand la section en déclare un (`filters`, opt-in).
const FiltersSection = lazy(() => import("@/modules/search/sections/FiltersSection"));

const DEFAULT_TYPES = ["organizations", "projects", "events", "poi"];

/**
 * Filtres de la recherche de CANDIDATES : ciblage config (commun ⊕ par-collection) + politique
 * open-data + garde-fous du déjà-rattaché — fusion MÊME-CLÉ pour que la config puisse cibler
 * `source.keys` (« le vivier ssbe ») SANS écraser le `$nin` de garde (et réciproquement) :
 * un scalaire/tableau config devient `$in`, les objets d'opérateurs sont fusionnés, le `$nin`
 * de garde s'unionne à un éventuel `$nin` config. Les DEUX moteurs (L searchNew / B buildQuery)
 * passent les objets d'opérateurs tels quels (le referenceTable legacy envoie déjà des `$nin`).
 *
 * ⚠ `{ $in, $nin }` sur UNE clé n'est honoré que par un backend dont `SearchNew::searchFilters`
 * combine les deux opérateurs (correctif `7b19f871` de citizenToolKit) : avant lui, le `$nin`
 * gagnait et le ciblage `$in` était ignoré EN SILENCE (tout le vivier remontait). Ekilib.re cible
 * `source.keys` et compte donc sur ce correctif ; sur un backend qui ne l'a pas, cibler la source
 * PRINCIPALE `source.key` (scalaire, clé distincte de la garde `source.keys`).
 */
export function buildOpenSearchFilters(
  search: { openData?: "optIn" | "optOut" | "off"; defaultFilters?: Record<string, unknown>; defaultFiltersByType?: Record<string, Record<string, unknown>> } | undefined,
  type: string,
  costumSlug: string,
): Record<string, unknown> {
  const cibles: Record<string, unknown> = { ...(search?.defaultFilters ?? {}), ...(search?.defaultFiltersByType?.[type] ?? {}) };
  const politique = search?.openData ?? "optIn";
  const filtres: Record<string, unknown> = { ...cibles };
  if (politique === "optIn") filtres["preferences.isOpenData"] = true;
  else if (politique === "optOut") filtres["preferences.isOpenData"] = { $nin: [false, "false"] };
  // Garde-fous non configurables — fusion même-clé avec un éventuel ciblage config.
  for (const champ of ["reference.costum", "source.keys"]) {
    const base = filtres[champ];
    const ops: Record<string, unknown> =
      base === undefined ? {}
      : typeof base === "object" && base !== null && !Array.isArray(base) ? { ...(base as Record<string, unknown>) }
      : { $in: Array.isArray(base) ? base : [base] };
    const nin = ops.$nin;
    ops.$nin = [...new Set([...(Array.isArray(nin) ? nin : nin !== undefined ? [nin] : []), costumSlug])];
    filtres[champ] = ops;
  }
  return filtres;
}
const DEFAULT_COLUMNS = [
  { path: "name", label: { fr: "Nom", en: "Name" } },
  { path: "address.addressLocality", label: { fr: "Commune", en: "Municipality" } },
];

/**
 * Section `reference` — port moderne de l'onglet « search & reference » du referenceTable legacy :
 *
 * - **Rechercher & référencer** : recherche GLOBALE hors costum (`notSourceKey:true` — prioritaire
 *   sur le sourceKey posé par la lib, e2e verrouillé) avec les MÊMES garde-fous que le legacy
 *   (referenceTable.php:140-152) : `preferences.isOpenData:true` + `$nin` sur reference.costum et
 *   source.keys (exclut le déjà-rattaché/référencé — add/reference ne déduplique pas, parité).
 *   Bouton « Référencer » par résultat → SET_SOURCE add/reference (pose `reference.costum`).
 * - **Référencés** : les éléments `reference.costum ∋ slug` + action « Retirer la référence ».
 *
 * Les mutations s'appellent sur le CARRIER ctx-ifié (ensureCostumScope) : les éléments externes
 * n'ont pas de `source.key` → pas de `_costumCtx` auto-dérivable côté item.
 * NB parité : il n'existe AUCUNE promotion reference→source (add/source refusé par le legacy) —
 * un référencé reste référencé ; il apparaît dans les tables Contenu (le scope costum matche
 * source.keys OU reference.costum). Un élément DÉTACHÉ (source retiré) redevient référençable ici.
 */
export default function AdminReferenceSection({ section }: { section: AdminSection }) {
  // Le panneau et les deux recherches partagent l'état de filtres de la SECTION (provider local).
  if ((section as AdminReferenceSectionConfig).filters) {
    return (
      <PageFiltersProvider>
        <ReferenceSection section={section} />
      </PageFiltersProvider>
    );
  }
  return <ReferenceSection section={section} />;
}

function ReferenceSection({ section }: { section: AdminSection }) {
  const cfg = section as AdminReferenceSectionConfig;
  const pageFilters = usePageFiltersOptional();
  const filterNames = pageFilters?.filterNames;
  const searchByFields = pageFilters?.searchByFields;
  const selection = useMemo(
    () => (cfg.filters && filterNames && searchByFields ? { filterNames, searchByFields } : null),
    [cfg.filters, filterNames, searchByFields],
  );
  const t = useT();
  const tAdmin = useT("modules/admin");
  const { entity: carrier, contextId, contextType } = useCocolight();
  const costumSlug = (carrier as { slug?: string } | null)?.slug ?? "";
  const types = cfg.entityTypes ?? DEFAULT_TYPES;
  // Colonnes de DONNÉES configurables (`columns`, même forme que resource — audit config) ;
  // Type (badge collection) et Action restent structurelles.
  const columns = normalizeColumns(cfg.columns, DEFAULT_COLUMNS);

  const [tab, setTab] = useState<"search" | "referenced" | "sourced">("search");
  const [type, setType] = useState(types[0] ?? "poi");

  // ── SOUS-TYPE de rattachement ─────────────────────────────────────────────────────────────────
  // Le référencement seul (`reference.costum`) rattache PAR COLLECTION : quand elle porte plusieurs
  // forms costum (institutBleu : document ET financement sur poi), rien ne classe l'entité — elle
  // est invisible des onglets et pages filtrés par sous-type, et l'édition ouvre le form générique.
  // On écrit donc, en plus, l'ANNOTATION `reference.costumTypes.<slug> = <subType>` — jamais le
  // champ cœur (`type`…), qui porte la sémantique d'un autre site. Candidats = les forms de la
  // collection déclarant `subType` : 1 → posé d'office, N → sélecteur, 0 → référencement nu.
  const { config: siteConfig } = useSite();
  const costumForms = (siteConfig as { costumForms?: Record<string, CostumFormSubTypeLike> } | undefined)?.costumForms;
  const candidats = useMemo(
    () => formsDeCollection(costumForms, type, costumSlug).filter((f): f is CostumFormSubTypeLike & { subType: string } => !!f.subType),
    [costumForms, type, costumSlug],
  );
  const [sousTypeChoisi, setSousTypeChoisi] = useState<string | null>(null);
  // Le choix ne survit pas à un changement de collection : on retombe sur le premier candidat.
  const sousType = candidats.some((f) => f.subType === sousTypeChoisi)
    ? (sousTypeChoisi as string)
    : candidats[0]?.subType;
  const libelleSousType = (st: string | undefined): string => {
    const f = candidats.find((c) => c.subType === st);
    return f?.subTypeLabel ? t(f.subTypeLabel as never) : (st ?? "");
  };
  // Props du panneau MÉMOÏSÉES : `FiltersSection` recalcule ses groupes dans un effet dépendant de
  // `props.filterGroups` et met à jour son état — un nouveau tableau à chaque rendu boucle à l'infini.
  const filtersPanelProps = useMemo(() => {
    if (!cfg.filters) return null;
    return {
      ...cfg.filters,
      // Le champ texte est celui de la section, au-dessus.
      hideSearch: true,
      // Réseaux (`sourceKey`) : seulement sur « Référencés » — cf. schema `filters`.
      filterGroups: tab === "search"
        ? cfg.filters.filterGroups.filter((g) => (g as { filterType?: string }).filterType !== "sourceKey")
        : cfg.filters.filterGroups,
    };
  }, [cfg.filters, tab]);
  const [q, setQ] = useState("");
  const searchText = useDebounce(q, 300);

  // ── Recherche « à référencer » : ciblage + politique open-data configurables (cfg.search),
  //    garde-fous du déjà-rattaché non configurables — défaut = fidèle referenceTable legacy.
  const searchQuery = useMemo(() => applyReferenceFacets({
    defaultTypes: [type] as SearchType[],
    notSourceKey: true,
    defaultFilters: buildOpenSearchFilters(cfg.search, type, costumSlug),
  }, selection, { ignoreSourceKeys: true }), [cfg.search, type, costumSlug, selection]);

  const global = useSearchQuery({
    queryKeyPrefix: ADMIN_QUERY_KEYS.REFERENCE_SEARCH_PREFIX(type),
    searchText,
    searchTags: searchQuery.searchTags,
    searchType: { type: [type] },
    mapUsed: false,
    baseParams: searchQuery.baseParams,
    variant: "admin",
  });

  // ── Référencés (reference.costum ∋ slug) ───────────────────────────────────────────────────────
  const referencedQuery = useMemo(() => applyReferenceFacets({
    defaultTypes: [type] as SearchType[],
    notSourceKey: true, // désactive le scope auto ($or source/reference) → on filtre reference SEUL
    defaultFilters: { "reference.costum": { $in: [costumSlug] } },
  }, selection), [type, costumSlug, selection]);

  const referenced = useSearchQuery({
    queryKeyPrefix: ADMIN_QUERY_KEYS.REFERENCE_LISTED_PREFIX(type),
    searchText,
    searchTags: referencedQuery.searchTags,
    searchType: { type: [type] },
    mapUsed: false,
    baseParams: referencedQuery.baseParams,
    variant: "admin",
  });

  // ── Sourcés (source.keys ∋ slug), opt-in `showSourced` ─────────────────────────────────────────
  // Même construction que « Référencés » (périmètre explicite, filtres du panneau) ; requête
  // désactivée sans l'option.
  const sourcedQuery = useMemo(() => applyReferenceFacets({
    defaultTypes: [type] as SearchType[],
    notSourceKey: true, // désactive le scope auto ($or source/reference) → on filtre source SEUL
    defaultFilters: { "source.keys": { $in: [costumSlug] } },
  }, selection), [type, costumSlug, selection]);

  const sourced = useSearchQuery({
    queryKeyPrefix: ADMIN_QUERY_KEYS.REFERENCE_SOURCED_PREFIX(type),
    searchText,
    searchTags: sourcedQuery.searchTags,
    searchType: { type: [type] },
    mapUsed: false,
    baseParams: sourcedQuery.baseParams,
    variant: "admin",
    enabled: !!cfg.showSourced,
  });
  const [toDetach, setToDetach] = useState<{ id: string; type: string; label: string } | null>(null);

  const mutation = useReferenceElement(() => {
    void global.refetch();
    void referenced.refetch();
    if (cfg.showSourced) void sourced.refetch();
  });

  const runMutation = (
    op: "reference" | "unreference" | "classify",
    itemType: string,
    id: string,
    cible: AnnotableEntity,
    subTypeCible?: string,
  ) => {
    // ctx costum requis par addReference/removeReference (les éléments externes n'ont pas de source.key).
    ensureCostumScope(carrier, { contextId, contextType });
    mutation.mutate({
      carrier: carrier as unknown as ReferencingCarrier,
      op,
      type: itemType,
      id,
      // L'ENTITÉ de la ligne : les écritures d'annotation passent par SA méthode `updateField`
      // (voie haut-niveau BaseEntity — validations + normalisation), pas par un endpointApi brut.
      cible,
      // Au référencement : le sous-type courant (choisi ou unique) ; au reclassement : la cible.
      subType: op === "classify" ? subTypeCible : sousType,
      moderate: cfg.moderateReferenced,
    });
  };

  const renderRows = (
    rows: unknown[],
    lastItemRef: (node: HTMLElement | null) => void,
    action: { label: string; icon: React.ReactNode; op: "reference" | "unreference" | "detach" },
  ) =>
    rows.map((item, i) => {
      const data = (item as { serverData?: Record<string, unknown> }).serverData ?? {};
      const id = String((item as { id?: unknown }).id ?? (data as { id?: unknown }).id ?? i);
      const itemType = String((data as { collection?: unknown }).collection ?? type);
      // L'annotation posée (le mode admin renvoie les documents complets, `reference` inclus).
      const annote = candidats.length > 0 ? (getPath(data, cheminAnnotation(costumSlug)) as string | undefined) : undefined;
      return (
        <TableRow key={id} ref={i === rows.length - 1 ? (lastItemRef as never) : undefined}>
          {columns.map((col) => (
            <TableCell key={col.path} className="max-w-[14rem] truncate">{formatCell(getPath(data, col.path))}</TableCell>
          ))}
          <TableCell><Badge variant="outline">{itemType}</Badge></TableCell>
          {candidats.length > 0 && action.op === "unreference" && (
            <TableCell>
              {/* Classer / Reclasser : la même annotation, rejouable — c'est le filet quand
                  l'écriture a raté au référencement, ET l'outil de rattrapage de l'existant. */}
              <Select
                value={annote ?? ""}
                onValueChange={(v) => runMutation("classify", itemType, id, item as AnnotableEntity, v)}
                disabled={mutation.isPending}
              >
                <SelectTrigger size="sm" className="w-40" aria-label={tAdmin("AdminReferenceSection.colSubType")}>
                  <SelectValue placeholder={tAdmin("AdminReferenceSection.unclassified")} />
                </SelectTrigger>
                <SelectContent>
                  {candidats.map((f) => (
                    <SelectItem key={f.subType} value={f.subType}>{libelleSousType(f.subType)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
          )}
          <TableCell className="text-right">
            <Button
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() =>
                action.op === "detach"
                  // Retrait de source : irréversible pour le site (add/source refusé) → confirmation.
                  ? setToDetach({ id, type: itemType, label: String((data as { name?: unknown }).name ?? id) })
                  : runMutation(action.op, itemType, id, item as AnnotableEntity)
              }
            >
              {action.icon}
              {action.label}
            </Button>
          </TableCell>
        </TableRow>
      );
    });

  const tableShell = (
    body: React.ReactNode,
    loading: boolean,
    empty: boolean,
    emptyMsg: string,
    avecSousType = false,
  ) => (
    <AdminTableShell
      head={
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.path} className={col.label ? undefined : "capitalize"}>
              {col.label ? t(col.label) : col.path}
            </TableHead>
          ))}
          <TableHead>{tAdmin("AdminReferenceSection.colType")}</TableHead>
          {avecSousType && <TableHead>{tAdmin("AdminReferenceSection.colSubType")}</TableHead>}
          <TableHead className="w-44 text-right">{tAdmin("AdminReferenceSection.colAction")}</TableHead>
        </TableRow>
      }
      body={body}
      loading={loading}
      empty={empty}
      emptyMessage={emptyMsg}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5" />
          {cfg.title ? t(cfg.title) : tAdmin("AdminReferenceSection.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchTextInput className="max-w-xs" placeholder={tAdmin("AdminReferenceSection.searchPlaceholder")} value={q} onChange={setQ} />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-44" aria-label={tAdmin("AdminReferenceSection.entityTypeAria")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Plusieurs forms costum sur cette collection → l'admin dit COMME QUOI il référence.
              Un seul → posé d'office, pas de question ; aucun → référencement nu. */}
          {candidats.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{tAdmin("AdminReferenceSection.attachAs")}</span>
              <Select value={sousType ?? ""} onValueChange={setSousTypeChoisi}>
                <SelectTrigger className="w-44" aria-label={tAdmin("AdminReferenceSection.attachAs")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {candidats.map((f) => (
                    <SelectItem key={f.subType} value={f.subType}>{libelleSousType(f.subType)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className={cfg.filters ? "grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]" : undefined}>
        {filtersPanelProps && (
          <Suspense fallback={null}>
            <FiltersSection props={filtersPanelProps} />
          </Suspense>
        )}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <ScrollableTabsList>
            <TabsTrigger value="search">
              <Search className="mr-1.5 h-3.5 w-3.5" />
              {tAdmin("AdminReferenceSection.tabSearch")}{global.totalCount != null ? ` (${global.totalCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="referenced">
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              {tAdmin("AdminReferenceSection.tabReferenced")}{referenced.totalCount != null ? ` (${referenced.totalCount})` : ""}
            </TabsTrigger>
            {cfg.showSourced && (
              <TabsTrigger value="sourced">
                <Database className="mr-1.5 h-3.5 w-3.5" />
                {tAdmin("AdminReferenceSection.tabSourced")}{sourced.totalCount != null ? ` (${sourced.totalCount})` : ""}
              </TabsTrigger>
            )}
          </ScrollableTabsList>
          <TabsContent value="search" className="pt-3">
            <p className="mb-2 text-xs text-muted-foreground">
              {tAdmin("AdminReferenceSection.openDataHintBefore")}
              <code>reference.costum</code>
              {tAdmin("AdminReferenceSection.openDataHintAfter")}
            </p>
            {tableShell(
              renderRows(global.transformedResults ?? [], global.lastItemRef, { label: tAdmin("AdminReferenceSection.reference"), icon: <Plus className="mr-1.5 h-3.5 w-3.5" />, op: "reference" }),
              global.isLoading,
              (global.transformedResults ?? []).length === 0,
              tAdmin("AdminReferenceSection.emptySearch"),
            )}
          </TabsContent>
          <TabsContent value="referenced" className="pt-3">
            {tableShell(
              renderRows(referenced.transformedResults ?? [], referenced.lastItemRef, { label: tAdmin("AdminReferenceSection.remove"), icon: <Link2Off className="mr-1.5 h-3.5 w-3.5" />, op: "unreference" }),
              referenced.isLoading,
              (referenced.transformedResults ?? []).length === 0,
              tAdmin("AdminReferenceSection.emptyReferenced"),
              candidats.length > 0,
            )}
          </TabsContent>
          {cfg.showSourced && (
            <TabsContent value="sourced" className="pt-3">
              {tableShell(
                renderRows(sourced.transformedResults ?? [], sourced.lastItemRef, { label: tAdmin("AdminReferenceSection.removeSource"), icon: <Unlink className="mr-1.5 h-3.5 w-3.5" />, op: "detach" }),
                sourced.isLoading,
                (sourced.transformedResults ?? []).length === 0,
                tAdmin("AdminReferenceSection.emptySourced"),
              )}
            </TabsContent>
          )}
        </Tabs>
        </div>
      </CardContent>
      {cfg.showSourced && (
        <ConfirmDialog
          open={!!toDetach}
          onOpenChange={(o) => { if (!o) setToDetach(null); }}
          onConfirm={() => {
            if (toDetach) {
              ensureCostumScope(carrier, { contextId, contextType });
              mutation.mutate({ carrier: carrier as unknown as ReferencingCarrier, op: "detach", type: toDetach.type, id: toDetach.id });
              setToDetach(null);
            }
          }}
          title={tAdmin("AdminReferenceSection.removeSourceTitle", undefined, { label: toDetach?.label ?? "" })}
          description={tAdmin("AdminReferenceSection.removeSourceDescription")}
          confirmLabel={tAdmin("AdminReferenceSection.removeSource")}
          isDestructive
          isPending={mutation.isPending}
        />
      )}
    </Card>
  );
}
