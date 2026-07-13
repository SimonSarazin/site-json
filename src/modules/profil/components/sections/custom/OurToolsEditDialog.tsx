import { useId, useRef, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/hooks/useT";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import {
  TOOLS_MAP,
  TOOL_CATEGORY_KEYS,
  parseRows,
  rowsToOurTools,
  type OurTools,
  type ToolRow,
} from "./toolsMap";

interface OurToolsEditDialogProps {
  entity: EntityTypes;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Éditeur des outils numériques d'un lieu (`ourTools`). Réservé aux admins du
 * lieu (le call-site gate via `canEditProfile`). Sauvegarde via
 * `entity.updateField("ourTools", …)` puis `entity.refresh()` (met à jour le
 * `serverData` réactif → `useReactiveProperty` re-render la liste).
 *
 * Monté conditionnellement (`{isOpen && …}`) → état frais à chaque ouverture.
 */
export function OurToolsEditDialog({ entity, isOpen, onClose }: OurToolsEditDialogProps) {
  const t = useT("modules/profil");
  const fieldId = useId();
  const [rows, setRows] = useState<ToolRow[]>(() => parseRows(entity.serverData?.ourTools));
  // Prochain id de ligne : démarre après les lignes initiales (ids 0..n-1).
  const idRef = useRef(rows.length);

  const mutation = useMutationWithToast<unknown, OurTools>({
    // `{}` en form-urlencoded n'émet AUCUN paramètre `value` → 500 backend.
    // Quand tout est vide, on envoie `null` = `$unset` explicite (wire-safe).
    mutationFn: (value) =>
      entity.updateField("ourTools", Object.keys(value).length > 0 ? value : null),
    successKey: "ProfileTiersLieuxInfo.toolsModal.saveSuccess",
    errorKey: "ProfileTiersLieuxInfo.toolsModal.saveError",
    namespace: "modules/profil",
    onSuccessCallback: async () => {
      // `refresh()` re-fetch l'entité et met à jour son `serverData` réactif →
      // `useReactiveProperty` re-render la liste (pattern useUploadProfileBanner).
      await entity.refresh();
      onClose();
    },
  });

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { id: idRef.current++, category: TOOL_CATEGORY_KEYS[0], name: "", url: "" },
    ]);
  const removeRow = (id: number) => setRows((prev) => prev.filter((r) => r.id !== id));
  const patchRow = (id: number, patch: Partial<ToolRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const handleSave = () => mutation.mutate(rowsToOurTools(rows, entity.serverData?.ourTools));

  if (!isOpen) return null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !mutation.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("ProfileTiersLieuxInfo.toolsModal.title")}</DialogTitle>
          <DialogDescription>
            {t("ProfileTiersLieuxInfo.toolsModal.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 px-0.5">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              {t("ProfileTiersLieuxInfo.toolsModal.empty")}
            </p>
          )}

          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end"
            >
              <div className="space-y-1 sm:w-52">
                <Label htmlFor={`${fieldId}-${row.id}-cat`} className="text-xs text-muted-foreground">
                  {t("ProfileTiersLieuxInfo.toolsModal.category")}
                </Label>
                <Select
                  value={row.category}
                  onValueChange={(v) => patchRow(row.id, { category: v })}
                >
                  <SelectTrigger id={`${fieldId}-${row.id}-cat`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOOL_CATEGORY_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {TOOLS_MAP[key].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-1">
                <Label htmlFor={`${fieldId}-${row.id}-name`} className="text-xs text-muted-foreground">
                  {t("ProfileTiersLieuxInfo.toolsModal.name")}
                </Label>
                <Input
                  id={`${fieldId}-${row.id}-name`}
                  value={row.name}
                  onChange={(e) => patchRow(row.id, { name: e.target.value })}
                  placeholder={t("ProfileTiersLieuxInfo.toolsModal.namePlaceholder")}
                />
              </div>

              <div className="flex-1 space-y-1">
                <Label htmlFor={`${fieldId}-${row.id}-url`} className="text-xs text-muted-foreground">
                  {t("ProfileTiersLieuxInfo.toolsModal.url")}
                </Label>
                <Input
                  id={`${fieldId}-${row.id}-url`}
                  value={row.url}
                  onChange={(e) => patchRow(row.id, { url: e.target.value })}
                  placeholder="https://…"
                  inputMode="url"
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removeRow(row.id)}
                aria-label={t("ProfileTiersLieuxInfo.toolsModal.removeRow")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addRow}>
            <Plus className="h-4 w-4" />
            {t("ProfileTiersLieuxInfo.toolsModal.addRow")}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t("ProfileTiersLieuxInfo.toolsModal.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={mutation.isPending}>
            {t("ProfileTiersLieuxInfo.toolsModal.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
