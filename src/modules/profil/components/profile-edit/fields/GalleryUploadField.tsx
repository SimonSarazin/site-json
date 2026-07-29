/**
 * Champ GALERIE (Option C) — collecte locale d'images multiples, uploadées APRÈS le save par
 * l'orchestration (`runEntityMutation`) via `entity.uploadDocument(file, {contentKey})`. Le POI n'a
 * pas d'`id` pendant la saisie (création) → on ne peut pas uploader au fil de l'eau.
 *
 * Valeur du champ (auto-portée) : { existing, added, removedDocIds, contentKey, docType } — l'orchestration
 * la reconnaît par la présence de `added`/`removedDocIds`/`contentKey`. `existing` (seed édition) vient de
 * `entity.getGalleryImages()`.
 */
import { useEffect, useMemo, useRef } from "react";
import { X, ImagePlus } from "lucide-react";
import { FormItem, FormLabel } from "@/components/ui/form";

export interface GalleryExistingImage { docId: string; url: string; name?: string }

export interface GalleryValue {
  existing: GalleryExistingImage[];
  added: File[];
  removedDocIds: string[];
  contentKey: string;
  docType: "image" | "file";
}

export function emptyGalleryValue(contentKey: string, docType: "image" | "file" = "image"): GalleryValue {
  return { existing: [], added: [], removedDocIds: [], contentKey, docType };
}

interface Props {
  value: GalleryValue;
  onChange: (v: GalleryValue) => void;
  label?: string;
  hint?: string;
  maxItems?: number;
  accept?: string;
}

export default function GalleryUploadField({ value, onChange, label, hint, maxItems, accept = "image/*" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const existing = value.existing ?? [];
  // `value.added ?? []` fabriquait un tableau NEUF à chaque rendu quand le champ est
  // vide : le useMemo de `previews` ne mémoïsait alors rien, et l'effet révoquait puis
  // recréait les URL d'aperçu en boucle. On stabilise l'identité, pas la liste de deps.
  const added = useMemo(() => value.added ?? [], [value.added]);
  const removed = value.removedDocIds ?? [];
  const visibleExisting = existing.filter((e) => !removed.includes(e.docId));

  // URLs de prévisualisation des fichiers ajoutés (révoquées à chaque changement pour éviter les fuites).
  const previews = useMemo(() => added.map((f) => URL.createObjectURL(f)), [added]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const total = visibleExisting.length + added.length;
  const canAdd = !maxItems || total < maxItems;

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const room = maxItems ? Math.max(0, maxItems - total) : imgs.length;
    onChange({ ...value, added: [...added, ...imgs.slice(0, room)] });
  };
  const removeAdded = (i: number) => onChange({ ...value, added: added.filter((_, k) => k !== i) });
  const removeExisting = (docId: string) => onChange({ ...value, removedDocIds: [...removed, docId] });

  return (
    <FormItem>
      {label && <FormLabel>{label}</FormLabel>}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {visibleExisting.map((e) => (
          <Tile key={e.docId} url={e.url} onRemove={() => removeExisting(e.docId)} />
        ))}
        {added.map((f, i) => (
          <Tile key={`new-${i}-${f.name}`} url={previews[i]!} onRemove={() => removeAdded(i)} isNew />
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            aria-label="Ajouter des images"
          >
            <ImagePlus className="h-6 w-6" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {maxItems && <p className="text-xs text-muted-foreground">{total}/{maxItems}</p>}
    </FormItem>
  );
}

function Tile({ url, onRemove, isNew }: { url: string; onRemove: () => void; isNew?: boolean }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
      <img src={url} alt="" className="h-full w-full object-cover" />
      {isNew && (
        <span className="absolute left-1 top-1 rounded bg-primary/80 px-1 text-[10px] font-medium text-primary-foreground">
          nouveau
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/80 opacity-0 shadow transition group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
        aria-label="Retirer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
