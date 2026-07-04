import { BadgeCheck, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
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

  const { transformedResults, totalCount, isLoading, lastItemRef, refetch } = useSearchQuery({
    queryKeyPrefix: `admin-${resource.entityType}`,
    searchText: "",
    searchTags: {},
    searchType: null,
    mapUsed: false,
    baseParams: { defaultTypes: [resource.entityType] as SearchType[], ...(resource.source ?? {}) },
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
              const id = String((data as { id?: unknown }).id ?? i);
              const label = String((data as { name?: unknown }).name ?? id);
              const isLast = i === rows.length - 1;
              // Statut costum : toBeValidated absent/non-vide → en attente (« Valider ») ; {} vide → validé.
              const tbv = (data as { preferences?: { toBeValidated?: Record<string, unknown> } }).preferences?.toBeValidated;
              const isPending = !tbv || (typeof tbv === "object" && Object.keys(tbv).length > 0);
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
                          <DropdownMenuItem
                            onClick={() =>
                              validate.mutate({
                                carrier: carrier as unknown as ValidatableCarrier,
                                type: resource.entityType,
                                id,
                                valid: isPending,
                              })
                            }
                          >
                            <BadgeCheck className="mr-2 h-4 w-4" /> {isPending ? "Valider" : "Dévalider"}
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
