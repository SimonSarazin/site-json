import { useMemo, useState } from "react";
import { Check, Lock, ListPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SortableList } from "@/components/admin/SortableList";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { cn } from "@/lib/utils";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useCostumListsReactive } from "@/hooks/useCostumLists";
import { isDynamicList } from "@/lib/costumLists";
import "@/modules/admin/i18n";

import { useCostumListsMutations, type CostumListsWritableCarrier } from "../hooks/useCostumListsMutations";
import { findListLabel, toListRef, type ListRef } from "../lib/costumListsEditing";

import type { AdminSection } from "../schema";

/**
 * Props de la section — validées ICI (`AdminCustomSectionSchema` laisse `props` libre, à dessein,
 * cf. `AdminOwnershipMigrationSection`). `lists` — quand déclaré — restreint et FIGE l'ensemble des
 * listes gérables ici (les autres clés de `costum.lists`, techniques ou non pertinentes pour un
 * admin, restent invisibles) ; une clé déclarée mais absente de `costum.lists` s'affiche comme une
 * liste statique VIDE, prête à être peuplée. Sans `lists`, comportement par défaut : toutes les
 * clés RÉELLEMENT présentes dans `costum.lists` sont listées, et la création libre de nouvelle
 * liste reste possible.
 *
 * Chaque entrée est soit une clé brute (string — affichée telle quelle, ex. démarrage rapide),
 * soit `{key, label}` pour donner un libellé lisible à une clé technique (`categoriesParole` →
 * « Catégories des paroles ») — même patron `label: z.record(string,string)` qu'utilisé par
 * `AdminOwnershipMigrationSection.selectors[].label`, pas la `LocalizedString` partagée de
 * `schema.ts` (props costum non parsées par le schéma central, cf. commentaire de tête de ce
 * fichier voisin).
 */
const PropsSchema = z.object({
  lists: z
    .array(
      z.union([
        z.string().min(1),
        z.object({ key: z.string().min(1), label: z.record(z.string(), z.string()).optional() }),
      ]),
    )
    .min(1)
    .optional(),
});

type ListKind = "static" | "dynamic" | "uneditable";

function kindOf(spec: unknown): ListKind {
  if (isDynamicList(spec)) return "dynamic";
  if (spec === undefined || Array.isArray(spec)) return "static";
  return "uneditable";
}

/**
 * Section costum « listes » (`{type:"lists"}`) : édition de `costum.lists` (@/lib/costumLists).
 * Layout maître-détail (menu des listes à gauche, édition à droite) pour éviter un long scroll
 * quand un site déclare beaucoup de listes.
 *
 * V1 volontairement restreinte — cf. plan d'implémentation :
 *  - listes DYNAMIQUES (recette `{collection,where,distinct}`/`{type:"badges"}`) : LECTURE SEULE,
 *    éditer une recette dépend d'un format backend PHP legacy hors repo.
 *  - listes statiques au format MAP (valeur→libellé) : LECTURE SEULE aussi — la primitive
 *    d'écriture (`$set` d'un tableau complet) collapse une map en tableau plat, ce qui perdrait
 *    silencieusement un libellé ≠ valeur. Seules les listes `Array.isArray` sont éditables.
 * Enregistrée via `registerAdminSection("lists", …)` dans `AdminSectionRenderer.tsx`.
 */
export default function AdminListsSection({ section }: { section: AdminSection }) {
  const { entity } = useCocolight();
  const t = useT("modules/admin");
  const listes = useCostumListsReactive(entity);
  const mutations = useCostumListsMutations(entity as CostumListsWritableCarrier | null);
  const parsed = useMemo(() => PropsSchema.safeParse((section as { props?: unknown }).props ?? {}), [section]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [newValueDrafts, setNewValueDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ key: string; index: number; draft: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ key: string; index: number; value: string } | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListValue, setNewListValue] = useState("");

  if (!entity) {
    return <p className="text-muted-foreground">{t("AdminLists.noContext")}</p>;
  }
  if (!parsed.success) {
    return <p className="text-destructive">{t("AdminLists.badConfig")}</p>;
  }

  const whitelist: ListRef[] | undefined = parsed.data.lists?.map(toListRef);
  const keys = whitelist ? whitelist.map((w) => w.key) : Object.keys(listes);
  const canCreateList = whitelist === undefined;
  const current = selectedKey && keys.includes(selectedKey) ? selectedKey : (keys[0] ?? null);
  const labelFor = (key: string): string => {
    const label = findListLabel(key, whitelist);
    return label ? t(label) : key;
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto md:w-56 md:flex-col md:overflow-visible">
        {keys.map((key) => {
          const readOnly = kindOf(listes[key]) !== "static";
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              className={cn(
                "flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                current === key ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <span className="truncate">{labelFor(key)}</span>
              {readOnly && <Lock className="h-3 w-3 shrink-0" aria-hidden />}
            </button>
          );
        })}

        {canCreateList && (
          <div className="shrink-0 border-t pt-2 md:mt-2">
            {creatingList ? (
              <div className="flex flex-col gap-2">
                <Input
                  autoFocus
                  placeholder={t("AdminLists.newListPlaceholder")}
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setCreatingList(false);
                  }}
                />
                <Input
                  placeholder={t("AdminLists.newListValuePlaceholder")}
                  value={newListValue}
                  onChange={(e) => setNewListValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void createList();
                    if (e.key === "Escape") setCreatingList(false);
                  }}
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={mutations.isPending} onClick={() => void createList()}>
                    {t("AdminLists.create")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCreatingList(false)}>
                    {t("AdminLists.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setCreatingList(true)}>
                <ListPlus className="mr-2 h-4 w-4" />
                {t("AdminLists.newList")}
              </Button>
            )}
          </div>
        )}
      </nav>

      <div className="min-w-0 flex-1">
        {keys.length === 0 && <p className="text-muted-foreground">{t("AdminLists.empty")}</p>}

        {current && (() => {
          const spec = listes[current];
          const kind = kindOf(spec);

          if (kind === "dynamic") {
            return <DynamicListPanel name={labelFor(current)} spec={spec} t={t} />;
          }
          if (kind === "uneditable") {
            return <UneditableListPanel name={labelFor(current)} t={t} />;
          }

          const values = Array.isArray(spec) ? spec.filter((v): v is string => typeof v === "string") : [];

          return (
            <Card>
              <CardHeader>
                <CardTitle>{labelFor(current)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <SortableList
                  items={values}
                  getId={(v) => v}
                  onReorder={(next) => void mutations.reorderValues(current, next)}
                  renderItem={(value, index) => {
                    if (editing?.key === current && editing.index === index) {
                      return (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            value={editing.draft}
                            onChange={(e) => setEditing({ key: current, index, draft: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void confirmEdit();
                              if (e.key === "Escape") setEditing(null);
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={mutations.isPending}
                            aria-label={t("AdminLists.confirmEdit")}
                            onClick={() => void confirmEdit()}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t("AdminLists.cancelEdit")}
                            onClick={() => setEditing(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-sm">{value}</span>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={mutations.isPending}
                            aria-label={t("AdminLists.rename")}
                            onClick={() => setEditing({ key: current, index, draft: value })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={mutations.isPending}
                            aria-label={t("AdminLists.remove")}
                            onClick={() => setConfirmRemove({ key: current, index, value })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  }}
                />

                <div className="flex gap-2">
                  <Input
                    placeholder={t("AdminLists.addPlaceholder")}
                    value={newValueDrafts[current] ?? ""}
                    onChange={(e) => setNewValueDrafts((d) => ({ ...d, [current]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void addValue(current);
                    }}
                  />
                  <Button variant="outline" disabled={mutations.isPending} onClick={() => void addValue(current)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("AdminLists.add")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      <ConfirmDialog
        open={confirmRemove !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmRemove(null);
        }}
        title={t("AdminLists.confirmRemoveTitle")}
        description={t("AdminLists.confirmRemoveDesc", undefined, { value: confirmRemove?.value ?? "" })}
        confirmLabel={t("AdminLists.remove")}
        cancelLabel={t("AdminLists.cancel")}
        isDestructive
        isPending={mutations.isPending}
        onConfirm={() => {
          const target = confirmRemove;
          if (!target) return;
          setConfirmRemove(null);
          void mutations.removeValue(target.key, target.index);
        }}
      />
    </div>
  );

  async function addValue(key: string) {
    const value = newValueDrafts[key] ?? "";
    try {
      await mutations.addValue(key, value);
      setNewValueDrafts((d) => ({ ...d, [key]: "" }));
    } catch {
      // Toast déjà posé par le hook (`useCostumListsMutations`) — rien de plus à faire ici.
    }
  }

  async function confirmEdit() {
    if (!editing) return;
    try {
      await mutations.renameValue(editing.key, editing.index, editing.draft);
      setEditing(null);
    } catch {
      // Toast déjà posé par le hook.
    }
  }

  async function createList() {
    try {
      const key = newListName.trim();
      await mutations.createList(key, newListValue);
      setSelectedKey(key);
      setCreatingList(false);
      setNewListName("");
      setNewListValue("");
    } catch {
      // Toast déjà posé par le hook.
    }
  }
}

function DynamicListPanel({ name, spec, t }: { name: string; spec: unknown; t: ReturnType<typeof useT> }) {
  const recette = spec as Record<string, unknown>;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{name}</CardTitle>
        <Badge variant="secondary">{t("AdminLists.dynamicBadge")}</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {t("AdminLists.dynamicHint", undefined, { collection: String(recette.collection ?? recette.type ?? "?") })}
        </p>
      </CardContent>
    </Card>
  );
}

function UneditableListPanel({ name, t }: { name: string; t: ReturnType<typeof useT> }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{name}</CardTitle>
        <Badge variant="outline">{t("AdminLists.uneditableBadge")}</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t("AdminLists.uneditableHint")}</p>
      </CardContent>
    </Card>
  );
}
