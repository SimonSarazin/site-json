import { BadgeCheck, BadgeX, ChevronDown, ChevronUp, Link2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCocolight } from "@/hooks/useCocolight";
import { useDebounce } from "@/hooks/useDebounce";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import SearchTextInput from "@/modules/search/components/SearchTextInput";
import { DynamicModal } from "@/modules/profil/components/add/ModalRegistry";
import { DynamicEditModal } from "@/modules/profil/components/profile-edit/EditModalRegistry";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";

import type { SearchType } from "@/modules/search/schema";

import { ADMIN_QUERY_KEYS } from "../constants/queryKeys";
import { useDeleteEntity, type DeletableEntity } from "../hooks/useDeleteEntity";
import { useReferenceElement, type ReferencingCarrier } from "../hooks/useReferenceElement";
import { useValidateGroup, type ValidatableCarrier } from "../hooks/useValidateGroup";
import type { AdminResourceSection, AdminSection } from "../schema";
import { formatCell, getPath, resolveCreateModal, resolveEditModal, type CostumFormDocLike } from "./resourceHelpers";

import type { EntityTypes } from "@communecter/cocolight-api-client";

/**
 * Section `resource` (P2) — tableau CRUD générique. Liste via `useSearchQuery` (searchCostum, scopée au
 * carrier), colonnes déclarées en config, actions par-ligne : Éditer (`DynamicEditModal` → form standard OU
 * costum résolu PAR-LIGNE via editModalMatch) et Supprimer (`useDeleteEntity` → `canDeleteElement`).
 * Création via `DynamicModal` (clé `resolveCreateModal`). cf. plan §3/§4.
 */
/** Statut de validation costum, par filtre serveur : Tous / À valider / Validés. */
type StatusFilter = "all" | "pending" | "validated";

export default function AdminResourceTable({ section }: { section: AdminSection }) {
  const resource = section as AdminResourceSection;
  const { entity: carrier } = useCocolight();
  const t = useT();
  // Colonnes : `"path"` brut OU `{path, label}` (libellé localisé) — cf. AdminColumnSchema.
  const columns = (resource.columns ?? ["name"]).map((c) =>
    typeof c === "string" ? { path: c, label: undefined } : c,
  );
  const rowActions = resource.rowActions ?? ["edit", "delete"];
  const costumSlug = (carrier as { slug?: string } | null)?.slug ?? "";
  // Mode ADMIN (variant SDK `admin` → globalautocompleteadmin, SDK ≥ 1.0.161) dès que la table gère la
  // validation : la projection admin renvoie `preferences` (strippé byte-legacy sur l'endpoint public)
  // → badge « En attente / Validé » + filtre statut + action contextuelle. Gate : la page /admin est déjà
  // réservée aux admins de l'hôte — même population que la gate serveur (canEditItem sur l'hôte).
  const adminMode = rowActions.includes("validate") || !!resource.status;

  // Recherche plein-texte débouncée (300ms comme MembersSection) — searchText est dans la queryKey → refetch auto.
  const [q, setQ] = useState("");
  const searchText = useDebounce(q, 300);
  // Tri SERVEUR mono-colonne (payload sortBy {champ:1|-1} — byte-vérifié : la direction est préservée).
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  // Filtre statut (serveur : preferences.toBeValidated.<slug> $exists) — admin uniquement.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const src = (resource.source ?? {}) as { defaultFields?: string[]; defaultFilters?: Record<string, unknown> } & Record<string, unknown>;
  const baseParams = useMemo(() => {
    const filters: Record<string, unknown> = { ...(src.defaultFilters ?? {}) };
    if (adminMode && statusFilter !== "all" && costumSlug) {
      filters[`preferences.toBeValidated.${costumSlug}`] = { $exists: statusFilter === "pending" };
    }
    // Projection :
    //  - mode ADMIN : AUCUN `fields` → la route admin renvoie les DOCUMENTS COMPLETS (sémantique
    //    legacy searchAdmin, moins pwd). Indispensable au-delà du badge : la résolution d'édition
    //    (`editModalMatch`, ex. {type:"recoveryCenter"}) lit serverData.type, et le form costum
    //    d'édition doit être PRÉREMPLI (champs equip_*) — une projection partielle ouvrait le form
    //    générique et/ou des champs vides. Coût maîtrisé : pagination par 10.
    //  - mode public : `source` FORCÉ (M3, absent du jeu legacy par défaut) → le toggle
    //    Référencer/Détacher reflète l'appartenance réelle à source.keys.
    return {
      defaultTypes: [resource.entityType] as SearchType[],
      ...src,
      ...(adminMode ? { defaultFields: undefined } : { defaultFields: [...new Set(["source", ...(src.defaultFields ?? [])])] }),
      ...(Object.keys(filters).length > 0 ? { defaultFilters: filters } : {}),
      ...(sort ? { defaultSortBy: { [sort.col]: sort.dir } } : {}),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- src dérivé de la config (stable par rendu)
  }, [adminMode, statusFilter, costumSlug, sort, resource.entityType, JSON.stringify(src)]);

  const { transformedResults, totalCount, isLoading, lastItemRef, refetch } = useSearchQuery({
    queryKeyPrefix: ADMIN_QUERY_KEYS.RESOURCE_PREFIX(resource.entityType),
    searchText,
    searchTags: {},
    // Le type de recherche DOIT passer par `searchType` (et non le seul `baseParams.defaultTypes`) :
    // useSearchQuery mappe `searchType:null` en `type=[]` (tableau vide), or buildSearchPayload ne
    // retombe sur `defaultTypes` que si `type===undefined` → sans ça, `param.searchType` reste vide et
    // le queryFn court-circuite (résultat vide, AUCUN appel réseau). Idiome repris de SearchProStatic.
    searchType: { type: [resource.entityType] },
    mapUsed: false,
    baseParams,
    ...(adminMode ? { variant: "admin" as const } : {}),
  });
  const rows = transformedResults ?? [];

  const toggleSort = (col: string) =>
    setSort((s) => (s?.col === col ? (s.dir === 1 ? { col, dir: -1 } : null) : { col, dir: 1 }));

  const [editEntity, setEditEntity] = useState<EntityTypes | null>(null);
  const [toDelete, setToDelete] = useState<{ entity: DeletableEntity; label: string } | null>(null);
  // Détacher = action FORTE (l'élément sort du scope costum et disparaît de la table) → confirmation.
  const [toDetach, setToDetach] = useState<{ item: unknown; id: string; label: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const del = useDeleteEntity(() => {
    setToDelete(null);
    void refetch();
  });
  const validate = useValidateGroup(() => {
    void refetch();
  });
  const reference = useReferenceElement(() => {
    void refetch();
  });
  // Choix costum/standard par CONFIG (`create`/`edit`) — cf. resourceHelpers. En `inherit`, la
  // création prend le form COSTUM du site s'il en existe un pour ce type (config.costumForms,
  // même form que le bouton public), et l'édition suit la résolution publique (editModal/Match).
  const { config } = useSite();
  const createModal = resolveCreateModal(
    resource,
    (config as { costumForms?: Record<string, CostumFormDocLike> }).costumForms,
    costumSlug,
  );
  const editModal = resolveEditModal(resource);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">
          {resource.label ? t(resource.label) : <span className="capitalize">{resource.entityType}</span>}
          {totalCount != null ? ` (${totalCount})` : ""}
        </CardTitle>
        {createModal && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Créer
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Barre d'outils : recherche plein-texte (débouncée) + filtre statut (mode admin). */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchTextInput className="max-w-xs" placeholder="Rechercher…" value={q} onChange={setQ} />
          {adminMode && costumSlug && (
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">À valider</SelectItem>
                <SelectItem value="validated">Validés</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        {/* Hauteur bornée + scroll interne : la sentinelle du scroll infini (lastItemRef) est CLIPPÉE hors
            de cette zone tant qu'on n'a pas scrollé → l'IntersectionObserver ne re-déclenche pas en cascade.
            Sans ça, un gros costum (p.ex. 3120 POI = 312 pages) enchaîne des dizaines de fetchNextPage
            d'affilée dans une table non virtualisée → gel du renderer. Le chargement reste incrémental au scroll. */}
        <div className="max-h-[60vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                // Tri SERVEUR au clic (asc → desc → aucun) — les données étant paginées en scroll
                // infini, un tri client ne trierait que les pages chargées.
                <TableHead
                  key={col.path}
                  className={col.label ? "cursor-pointer select-none hover:bg-muted/50" : "cursor-pointer select-none capitalize hover:bg-muted/50"}
                  onClick={() => toggleSort(col.path)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label ? t(col.label) : col.path}
                    {sort?.col === col.path && (sort.dir === 1 ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />)}
                  </span>
                </TableHead>
              ))}
              {adminMode && <TableHead>Statut</TableHead>}
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item, i) => {
              const data = (item as { serverData?: Record<string, unknown> }).serverData ?? {};
              // H1 : privilégier le GETTER d'entité `item.id` (serverData.id pas toujours peuplé par
              // searchCostum — cf. SearchListView) ; l'index i n'est qu'un ultime repli anti-crash.
              const id = String((item as { id?: unknown }).id ?? (data as { id?: unknown }).id ?? i);
              const label = String((data as { name?: unknown }).name ?? id);
              const isLast = i === rows.length - 1;
              // Rattachement : source.keys (projeté via defaultFields) contient le slug du costum courant → détachable ; sinon référençable.
              const sourceKeys = (data as { source?: { keys?: unknown[] } }).source?.keys;
              const isAttached = Array.isArray(sourceKeys) && !!costumSlug && sourceKeys.includes(costumSlug);
              // Statut de validation costum — LISIBLE en mode admin (le variant admin renvoie preferences,
              // strippé sur l'endpoint public) : flag posé → « En attente », absent → « Validé ».
              const tbv = (data as { preferences?: { toBeValidated?: Record<string, unknown> } }).preferences?.toBeValidated;
              const isPending = adminMode && !!costumSlug && !!tbv && typeof tbv === "object" && tbv[costumSlug] === true;
              return (
                <TableRow key={id} ref={isLast ? lastItemRef : undefined}>
                  {columns.map((col) => (
                    <TableCell key={col.path}>{formatCell(getPath(data, col.path))}</TableCell>
                  ))}
                  {adminMode && (
                    <TableCell>
                      {isPending ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">En attente</Badge>
                      ) : (
                        <Badge variant="secondary">Validé</Badge>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions pour ${label}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {rowActions.includes("edit") && editModal.enabled && (
                          <DropdownMenuItem onClick={() => setEditEntity(item as unknown as EntityTypes)}>
                            <Pencil className="mr-2 h-4 w-4" /> Éditer
                          </DropdownMenuItem>
                        )}
                        {rowActions.includes("validate") && carrier && (
                          // Le statut est LISIBLE en mode admin (variant admin → preferences projeté) : on
                          // n'affiche que l'action PERTINENTE (« Valider » un en-attente, « Dévalider » un validé).
                          // ⚠ On appelle sur `item` (l'entité de la ligne) et NON `carrier` : validateGroup/addReference
                          // exigent un `_costumCtx` COMPLET (slug+costumId+costumType) via `_requireCostumCtx`, que l'hôte
                          // costum (carrier) n'a pas forcément ; l'item l'auto-dérive de sa `source.keys` (projetée par M3).
                          <DropdownMenuItem
                            onClick={() =>
                              validate.mutate({ carrier: item as unknown as ValidatableCarrier, type: resource.entityType, id, valid: isPending })
                            }
                          >
                            {isPending ? <BadgeCheck className="mr-2 h-4 w-4" /> : <BadgeX className="mr-2 h-4 w-4" />}
                            {isPending ? "Valider" : "Dévalider"}
                          </DropdownMenuItem>
                        )}
                        {rowActions.includes("reference") && carrier && costumSlug && (
                          <DropdownMenuItem
                            onClick={() => {
                              if (isAttached) { setToDetach({ item, id, label }); return; }
                              reference.mutate({
                                carrier: item as unknown as ReferencingCarrier,
                                op: "reference",
                                type: resource.entityType,
                                id,
                              });
                            }}
                          >
                            <Link2 className="mr-2 h-4 w-4" /> {isAttached ? "Détacher" : "Référencer"}
                          </DropdownMenuItem>
                        )}
                        {rowActions.includes("delete") && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setToDelete({ entity: item as unknown as DeletableEntity, label })}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
        {isLoading && (
          <div className="space-y-2 py-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
        {!isLoading && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun élément.</p>
        )}
        {rows.length > 0 && totalCount != null && (
          <p className="pt-2 text-xs text-muted-foreground">
            {rows.length} affiché{rows.length > 1 ? "s" : ""} sur {totalCount} — faites défiler pour charger la suite.
          </p>
        )}
      </CardContent>

      {editEntity && (
        <DynamicEditModal
          open
          onOpenChange={(o) => {
            if (!o) setEditEntity(null);
          }}
          entity={editEntity}
          {...(editModal.modalName ? { modalName: editModal.modalName } : {})}
        />
      )}
      {createModal && (
        <DynamicModal modalName={createModal} open={createOpen} onOpenChange={setCreateOpen} parent={carrier} />
      )}

      <AlertDialog
        open={!!toDetach}
        onOpenChange={(o) => {
          if (!o) setToDetach(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Détacher « {toDetach?.label} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'élément sera retiré du costum (source) et disparaîtra de cette table. Vous pourrez le
              re-référencer depuis l'onglet Référencement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDetach) {
                  reference.mutate({ carrier: toDetach.item as unknown as ReferencingCarrier, op: "detach", type: resource.entityType, id: toDetach.id });
                  setToDetach(null);
                }
              }}
              disabled={reference.isPending}
            >
              Détacher
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => {
          if (!o) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {toDelete?.label} » ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) del.mutate({ entity: toDelete.entity, reason: "admin delete" });
              }}
              disabled={del.isPending}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
