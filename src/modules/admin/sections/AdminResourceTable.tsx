import { BadgeCheck, BadgeX, Link2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCocolight } from "@/hooks/useCocolight";
import { DynamicModal } from "@/modules/profil/components/add/ModalRegistry";
import { DynamicEditModal } from "@/modules/profil/components/profile-edit/EditModalRegistry";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";

import type { SearchType } from "@/modules/search/schema";

import { useDeleteEntity, type DeletableEntity } from "../hooks/useDeleteEntity";
import { useReferenceElement, type ReferencingCarrier } from "../hooks/useReferenceElement";
import { useValidateGroup, type ValidatableCarrier } from "../hooks/useValidateGroup";
import type { AdminResourceSection, AdminSection } from "../schema";
import { formatCell, getPath, resolveCreateModal } from "./resourceHelpers";

import type { EntityTypes } from "@communecter/cocolight-api-client";

/**
 * Section `resource` (P2) — tableau CRUD générique. Liste via `useSearchQuery` (searchCostum, scopée au
 * carrier), colonnes déclarées en config, actions par-ligne : Éditer (`DynamicEditModal` → form standard OU
 * costum résolu PAR-LIGNE via editModalMatch) et Supprimer (`useDeleteEntity` → `canDeleteElement`).
 * Création via `DynamicModal` (clé `resolveCreateModal`). cf. plan §3/§4.
 */
export default function AdminResourceTable({ section }: { section: AdminSection }) {
  const resource = section as AdminResourceSection;
  const { entity: carrier } = useCocolight();
  const columns = resource.columns ?? ["name"];
  const rowActions = resource.rowActions ?? ["edit", "delete"];
  const src = (resource.source ?? {}) as { defaultFields?: string[] } & Record<string, unknown>;
  // M3 : on FORCE `source` dans la projection — absent du jeu legacy par défaut (DEFAULT_FIELD_LIST) — pour que
  // le toggle Référencer/Détacher reflète l'appartenance réelle à source.keys. NB : `preferences` est strippé
  // côté serveur (byte-legacy SearchNew::$forbidenFields) → le statut de validation n'est PAS lisible ici,
  // d'où deux actions explicites Valider / Dévalider plus bas (cf. M4).
  const baseParams = {
    defaultTypes: [resource.entityType] as SearchType[],
    ...src,
    defaultFields: [...new Set(["source", ...(src.defaultFields ?? [])])],
  };

  const { transformedResults, totalCount, isLoading, lastItemRef, refetch } = useSearchQuery({
    queryKeyPrefix: `admin-${resource.entityType}`,
    searchText: "",
    searchTags: {},
    // Le type de recherche DOIT passer par `searchType` (et non le seul `baseParams.defaultTypes`) :
    // useSearchQuery mappe `searchType:null` en `type=[]` (tableau vide), or buildSearchPayload ne
    // retombe sur `defaultTypes` que si `type===undefined` → sans ça, `param.searchType` reste vide et
    // le queryFn court-circuite (résultat vide, AUCUN appel réseau). Idiome repris de SearchProStatic.
    searchType: { type: [resource.entityType] },
    mapUsed: false,
    baseParams,
  });
  const rows = transformedResults ?? [];

  const [editEntity, setEditEntity] = useState<EntityTypes | null>(null);
  const [toDelete, setToDelete] = useState<{ entity: DeletableEntity; label: string } | null>(null);
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
  const costumSlug = (carrier as { slug?: string } | null)?.slug ?? "";
  const createModal = resolveCreateModal(resource);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg capitalize">
          {resource.entityType}
          {totalCount != null ? ` (${totalCount})` : ""}
        </CardTitle>
        {createModal && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Créer
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Hauteur bornée + scroll interne : la sentinelle du scroll infini (lastItemRef) est CLIPPÉE hors
            de cette zone tant qu'on n'a pas scrollé → l'IntersectionObserver ne re-déclenche pas en cascade.
            Sans ça, un gros costum (p.ex. 3120 POI = 312 pages) enchaîne des dizaines de fetchNextPage
            d'affilée dans une table non virtualisée → gel du renderer. Le chargement reste incrémental au scroll. */}
        <div className="max-h-[60vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col} className="capitalize">
                  {col}
                </TableHead>
              ))}
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
              return (
                <TableRow key={id} ref={isLast ? lastItemRef : undefined}>
                  {columns.map((col) => (
                    <TableCell key={col}>{formatCell(getPath(data, col))}</TableCell>
                  ))}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {rowActions.includes("edit") && (
                          <DropdownMenuItem onClick={() => setEditEntity(item as unknown as EntityTypes)}>
                            <Pencil className="mr-2 h-4 w-4" /> Éditer
                          </DropdownMenuItem>
                        )}
                        {rowActions.includes("validate") && carrier && (
                          // M4 : le statut de validation (preferences.toBeValidated) n'est PAS dans les résultats de
                          // recherche (strippé byte-legacy) → on ne devine plus l'état ; deux actions explicites,
                          // toutes deux idempotentes côté serveur (unset/set du flag pour le slug courant).
                          // ⚠ On appelle sur `item` (l'entité de la ligne) et NON `carrier` : validateGroup/addReference
                          // exigent un `_costumCtx` COMPLET (slug+costumId+costumType) via `_requireCostumCtx`, que l'hôte
                          // costum (carrier) n'a pas forcément ; l'item l'auto-dérive de sa `source.keys` (projetée par M3).
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                validate.mutate({ carrier: item as unknown as ValidatableCarrier, type: resource.entityType, id, valid: true })
                              }
                            >
                              <BadgeCheck className="mr-2 h-4 w-4" /> Valider
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                validate.mutate({ carrier: item as unknown as ValidatableCarrier, type: resource.entityType, id, valid: false })
                              }
                            >
                              <BadgeX className="mr-2 h-4 w-4" /> Dévalider
                            </DropdownMenuItem>
                          </>
                        )}
                        {rowActions.includes("reference") && carrier && costumSlug && (
                          <DropdownMenuItem
                            onClick={() =>
                              reference.mutate({
                                carrier: item as unknown as ReferencingCarrier,
                                op: isAttached ? "detach" : "reference",
                                type: resource.entityType,
                                id,
                              })
                            }
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
      </CardContent>

      {editEntity && (
        <DynamicEditModal
          open
          onOpenChange={(o) => {
            if (!o) setEditEntity(null);
          }}
          entity={editEntity}
        />
      )}
      {createModal && (
        <DynamicModal modalName={createModal} open={createOpen} onOpenChange={setCreateOpen} parent={carrier} />
      )}

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
