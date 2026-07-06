import { Link2, Link2Off, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCocolight } from "@/hooks/useCocolight";
import { useDebounce } from "@/hooks/useDebounce";
import SearchTextInput from "@/modules/search/components/SearchTextInput";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";

import type { SearchType } from "@/modules/search/schema";

import { useReferenceElement, type ReferencingCarrier } from "../hooks/useReferenceElement";
import { ensureCostumScope } from "../lib/ensureCostumScope";
import type { AdminReferenceSection as AdminReferenceSectionConfig, AdminSection } from "../schema";
import { formatCell, getPath } from "./resourceHelpers";

const DEFAULT_TYPES = ["organizations", "projects", "events", "poi"];

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
  const { entity: carrier, contextId, contextType } = useCocolight();
  const costumSlug = (carrier as { slug?: string } | null)?.slug ?? "";
  const types = cfg.entityTypes ?? DEFAULT_TYPES;

  const [tab, setTab] = useState<"search" | "referenced">("search");
  const [type, setType] = useState(types[0] ?? "poi");
  const [q, setQ] = useState("");
  const searchText = useDebounce(q, 300);

  // ── Recherche globale « à référencer » (fidèle referenceTable legacy) ──────────────────────────
  const searchParams = useMemo(() => ({
    defaultTypes: [type] as SearchType[],
    notSourceKey: true,
    defaultFilters: {
      "preferences.isOpenData": true,
      "reference.costum": { $nin: [costumSlug] },
      "source.keys": { $nin: [costumSlug] },
    },
  }), [type, costumSlug]);

  const global = useSearchQuery({
    queryKeyPrefix: `admin-ref-search-${type}`,
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
    queryKeyPrefix: `admin-ref-listed-${type}`,
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

  const runMutation = (op: "reference" | "unreference", itemType: string, id: string) => {
    // ctx costum requis par addReference/removeReference (les éléments externes n'ont pas de source.key).
    ensureCostumScope(carrier, { contextId, contextType });
    mutation.mutate({ carrier: carrier as unknown as ReferencingCarrier, op, type: itemType, id });
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
      return (
        <TableRow key={id} ref={i === rows.length - 1 ? (lastItemRef as never) : undefined}>
          <TableCell>{formatCell(getPath(data, "name"))}</TableCell>
          <TableCell><Badge variant="outline">{itemType}</Badge></TableCell>
          <TableCell>{formatCell(getPath(data, "address.addressLocality"))}</TableCell>
          <TableCell className="text-right">
            <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => runMutation(action.op, itemType, id)}>
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
  ) => (
    <div className="max-h-[55vh] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Commune</TableHead>
            <TableHead className="w-44 text-right">Action</TableHead>
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
          Référencement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchTextInput className="max-w-xs" placeholder="Rechercher…" value={q} onChange={setQ} />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="search">
              <Search className="mr-1.5 h-3.5 w-3.5" />
              Rechercher &amp; référencer{global.totalCount != null ? ` (${global.totalCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="referenced">
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              Référencés{referenced.totalCount != null ? ` (${referenced.totalCount})` : ""}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="pt-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Éléments publics (openData) de tout Communecter, hors de ce costum. « Référencer » les propose
              au costum (<code>reference.costum</code>) — ils apparaissent ensuite dans les tables Contenu.
            </p>
            {tableShell(
              renderRows(global.transformedResults ?? [], global.lastItemRef, { label: "Référencer", icon: <Plus className="mr-1.5 h-3.5 w-3.5" />, op: "reference" }),
              global.isLoading,
              (global.transformedResults ?? []).length === 0,
              "Aucun élément à référencer.",
            )}
          </TabsContent>
          <TabsContent value="referenced" className="pt-3">
            {tableShell(
              renderRows(referenced.transformedResults ?? [], referenced.lastItemRef, { label: "Retirer", icon: <Link2Off className="mr-1.5 h-3.5 w-3.5" />, op: "unreference" }),
              referenced.isLoading,
              (referenced.transformedResults ?? []).length === 0,
              "Aucun élément référencé.",
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
