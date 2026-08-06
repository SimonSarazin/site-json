import { useMemo, useState } from "react";
import { AlertCircle, Loader2, Upload } from "lucide-react";
import type { ToolCatalogItem } from "@communecter/cocolight-api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SelectObject } from "@/components/ui/select-objet";
import { useT } from "@/hooks/useT";
import { useCommunList } from "../hooks/useCommunList";
import { useToolEnrichmentMutation } from "../hooks/useToolEnrichmentMutation";
import { ToolImage } from "./ToolImage";

const COMMUN_ANCHOR = /#detail-un-commun\.communId\.[0-9a-fA-F]{24}/;

interface ToolEditDialogProps {
  tool: ToolCatalogItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Id du form AAP des communs — sans lui, pas de select de rattachement. */
  communFormId?: string;
  /**
   * Appelé après un enregistrement réussi. L'appelant en profite pour fermer la
   * fiche détail : elle affiche l'objet `tool` de la page, figé, donc périmé dès
   * l'enregistrement — la liste, elle, est invalidée et se recharge.
   */
  onSaved?: () => void;
  /**
   * Gabarit d'URL du commun, `{communId}` substitué. Sert UNIQUEMENT quand l'outil
   * n'a pas déjà un lien de commun dont on puisse réutiliser la base : les deux
   * costums existants pointent des domaines différents (lescommuns.tiers-lieux.org
   * et communs.les-cae.coop), donc on préserve l'existant en priorité.
   */
  communUrlTemplate?: string;
}

/**
 * Éditeur de l'enrichissement d'un outil (document `navigatorcriteria`) : lien,
 * commun rattaché, description markdown, open source, image.
 *
 * N'est monté que pour les admins du costum (cf. `ToolDetailDialog`), et le serveur
 * revérifie ce droit — le gate client n'est qu'un confort d'affichage.
 */
export function ToolEditDialog({
  tool,
  open,
  onOpenChange,
  communFormId,
  onSaved,
  communUrlTemplate,
}: ToolEditDialogProps) {
  const t = useT("modules/toolsCatalog");
  const { communs, isPending: communsPending } = useCommunList({ communFormId, enabled: open });
  const mutation = useToolEnrichmentMutation();

  // `urlOwn` et NON `url` : ce dernier est une fusion d'affichage (`url ?: urlTool`)
  // qui, pour un outil sans lien propre, contient le lien du commun.
  const [url, setUrl] = useState(tool.urlOwn ?? "");
  const [description, setDescription] = useState(tool.description ?? "");
  const [isOpenSource, setIsOpenSource] = useState(!!tool.isOpenSource);
  /** "" = aucun commun rattaché. */
  const [communId, setCommunId] = useState(tool.communId || "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const initialCommunId = tool.communId || "";

  // 297 communs : la liste est filtrée dans le combobox (`shouldFilter`), pas ici.
  const communOptions = useMemo(
    () => communs.map((c) => ({ id: c.id, label: c.title, value: c.id })),
    [communs],
  );

  const handleFile = (file: File | null) => {
    setImageFile(file);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  /**
   * `urlTool` n'est envoyé QUE si le rattachement a changé — sinon on laisserait
   * le backend écraser un lien légitime qui ne porte pas d'ancre de commun
   * (certains outils y stockent une page « notre collectif »).
   */
  const urlToolChange = useMemo(() => {
    if (communId === initialCommunId) return undefined;
    if (communId === "") return "";
    // Base existante d'abord : elle porte le bon domaine pour ce costum.
    const existing = tool.urlTool && COMMUN_ANCHOR.test(tool.urlTool) ? tool.urlTool : "";
    if (existing) {
      return existing.replace(COMMUN_ANCHOR, `#detail-un-commun.communId.${communId}`);
    }
    // Ni base réutilisable ni gabarit configuré : on ne touche PAS à `urlTool`.
    // Y écrire "" (ce que produirait un `?? ""`) effacerait le lien au moment même
    // où l'admin rattache un commun.
    return communUrlTemplate ? communUrlTemplate.replace("{communId}", communId) : undefined;
  }, [communId, initialCommunId, tool.urlTool, communUrlTemplate]);

  const canSubmit = !mutation.isPending && !!tool.title;

  const handleSubmit = () => {
    mutation.mutate(
      {
        name: tool.title,
        url,
        description,
        isOpenSource,
        ...(urlToolChange !== undefined ? { urlTool: urlToolChange } : {}),
        imageFile,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSaved?.();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("edit.title", undefined, { tool: tool.title })}</DialogTitle>
          <DialogDescription>{t("edit.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto scrollbar-thin px-1">
          <div className="space-y-1.5">
            <Label htmlFor="tool-url">{t("edit.urlLabel")}</Label>
            <Input
              id="tool-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>

          {communFormId && (
            <div className="space-y-1.5">
              {/* `id` + `aria-labelledby` et non `htmlFor` : SelectObject rend un
                  bouton dont l'id est interne, le label ne pourrait pas le viser. */}
              <Label id="tool-commun-label">{t("edit.communLabel")}</Label>
              <div role="group" aria-labelledby="tool-commun-label">
                {/* Combobox recherchable et non `Select` : ~300 communs, comme le select2 legacy. */}
                <SelectObject
                  value={communId || null}
                  onChange={(v) => setCommunId(v ? String(v) : "")}
                  options={communOptions}
                  placeholder={t("edit.communNone")}
                  placeholderSearch={t("edit.communPlaceholder")}
                  // Défaut de SelectObject + `scrollbar-thin` : la piste `--muted`
                  // pleine hauteur des thèmes est trop lourde pour ce popover.
                  listClassName="max-h-60 overflow-auto scrollbar-thin w-full bg-popover text-popover-foreground"
                />
              </div>
              {communsPending && (
                <p className="text-xs text-muted-foreground">{t("edit.communLoading")}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tool-description">{t("edit.descriptionLabel")}</Label>
            <Textarea
              id="tool-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
            />
            <p className="text-xs text-muted-foreground">{t("edit.descriptionHint")}</p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <Label htmlFor="tool-opensource" className="cursor-pointer">
              {t("edit.openSourceLabel")}
            </Label>
            <Switch id="tool-opensource" checked={isOpenSource} onCheckedChange={setIsOpenSource} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tool-image">{t("edit.imageLabel")}</Label>
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white">
                {preview ? (
                  <img src={preview} alt="" className="h-full w-full object-contain p-1.5" />
                ) : (
                  <ToolImage src={tool.image} alt={tool.title} width={128} />
                )}
              </div>
              <Input
                id="tool-image"
                type="file"
                accept="image/*"
                className="cursor-pointer"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {mutation.isError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {/* Message i18n et non `error.message` : celui du serveur est du français
                  brut, hors de tout canal de traduction. */}
              <span className="text-sm">{t("edit.error")}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("edit.cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {t("edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
