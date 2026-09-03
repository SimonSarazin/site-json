import { Link2, Link2Off, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { useCocolight } from "@/hooks/useCocolight";
import { useDebounce } from "@/hooks/useDebounce";
import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";
import SearchTextInput from "@/modules/search/components/SearchTextInput";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import { formsDeCollection, cheminAnnotation, type CostumFormSubTypeLike } from "@/modules/search/lib/costumSubType";
import { useSite } from "@/hooks/useSite";

import { ScrollableTabsList } from "../components/ScrollableTabsList";

import type { SearchType } from "@/modules/search/schema";

import { ADMIN_QUERY_KEYS } from "../constants/queryKeys";
import { useReferenceElement, type AnnotableEntity, type ReferencingCarrier } from "../hooks/useReferenceElement";
import { ensureCostumScope } from "../lib/ensureCostumScope";
import type { AdminReferenceSection as AdminReferenceSectionConfig, AdminSection } from "../schema";
import { formatCell, getPath } from "./resourceHelpers";

const DEFAULT_TYPES = ["organizations", "projects", "events", "poi"];

/**
 * Filtres de la recherche de CANDIDATES : ciblage config (commun ⊕ par-collection) + politique
 * open-data + garde-fous du déjà-rattaché — fusion MÊME-CLÉ pour que la config puisse cibler
 * `source.keys` (« le vivier ssbe ») SANS écraser le `$nin` de garde (et réciproquement) :
 * un scalaire/tableau config devient `$in`, les objets d'opérateurs sont fusionnés, le `$nin`
 * de garde s'unionne à un éventuel `$nin` config. Les DEUX moteurs (L searchNew / B buildQuery)
 * passent les objets d'opérateurs tels quels (le referenceTable legacy envoie déjà des `$nin`).
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
  const cfg = section as AdminReferenceSectionConfig;
  const t = useT();
  const tAdmin = useT("modules/admin");
  const { entity: carrier, contextId, contextType } = useCocolight();
  const costumSlug = (carrier as { slug?: string } | null)?.slug ?? "";
  const types = cfg.entityTypes ?? DEFAULT_TYPES;
  // Colonnes de DONNÉES configurables (`columns`, même forme que resource — audit config) ;
  // Type (badge collection) et Action restent structurelles.
  const columns = (cfg.columns ?? DEFAULT_COLUMNS).map((c) =>
    typeof c === "string" ? { path: c, label: undefined } : c,
  );

  const [tab, setTab] = useState<"search" | "referenced">("search");
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
  const [q, setQ] = useState("");
  const searchText = useDebounce(q, 300);

  // ── Recherche « à référencer » : ciblage + politique open-data configurables (cfg.search),
  //    garde-fous du déjà-rattaché non configurables — défaut = fidèle referenceTable legacy.
  const searchParams = useMemo(() => ({
    defaultTypes: [type] as SearchType[],
    notSourceKey: true,
    defaultFilters: buildOpenSearchFilters(cfg.search, type, costumSlug),
  }), [cfg.search, type, costumSlug]);

  const global = useSearchQuery({
    queryKeyPrefix: ADMIN_QUERY_KEYS.REFERENCE_SEARCH_PREFIX(type),
    searchText,
    searchTags: {},
    searchType: { type: [type] },
    mapUsed: false,
    baseParams: searchParams,
    variant: "admin",
  });

  // ── Référencés (reference.costum ∋ slug) ───────────────────────────────────────────────────────
  const referencedParams = useMemo(() => ({
    defaultTypes: [type] as SearchType[],
    notSourceKey: true, // désactive le scope auto ($or source/reference) → on filtre reference SEUL
    defaultFilters: { "reference.costum": { $in: [costumSlug] } },
  }), [type, costumSlug]);

  const referenced = useSearchQuery({
    queryKeyPrefix: ADMIN_QUERY_KEYS.REFERENCE_LISTED_PREFIX(type),
    searchText,
    searchTags: {},
    searchType: { type: [type] },
    mapUsed: false,
    baseParams: referencedParams,
    variant: "admin",
  });

  const mutation = useReferenceElement(() => {
    void global.refetch();
    void referenced.refetch();
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
    action: { label: string; icon: React.ReactNode; op: "reference" | "unreference" },
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
            <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => runMutation(action.op, itemType, id, item as AnnotableEntity)}>
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
    <div className="max-h-[55vh] overflow-auto">
      <Table>
        <TableHeader>
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
        </TableHeader>
        <TableBody>{body}</TableBody>
      </Table>
      {loading && (
        <div className="space-y-2 py-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}
      {!loading && empty && <p className="py-8 text-center text-sm text-muted-foreground">{emptyMsg}</p>}
    </div>
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
        </Tabs>
      </CardContent>
    </Card>
  );
}
