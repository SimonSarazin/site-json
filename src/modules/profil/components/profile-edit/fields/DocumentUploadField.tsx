/**
 * Champ DOCUMENTS (fichiers non-image) d'un form costum — pendant FICHIER de `GalleryUploadField`.
 * Collecte locale de fichiers ; upload/suppression APRÈS le save par l'orchestration
 * (`processGalleryFields` → `entity.uploadDocument(file, {contentKey, docType:"file"})` / `deleteFile`).
 *
 * Réutilise le contrat `GalleryValue` ({ existing, added, removedDocIds, contentKey, docType:"file" }) —
 * l'orchestration le reconnaît par `added`/`removedDocIds`/`contentKey`. Diffère du widget galerie : accepte
 * tout type (pas de filtre `image/`), rendu en LIGNES (icône-ext + nom + taille), pas de preview image.
 * `existing` (seed édition) vient des fichiers `about.files` de l'entité (cf. `seedGalleryDefaults`).
 */
import { useRef } from "react";
import { X, Upload, FileText, File as FileIcon } from "lucide-react";
import { FormItem, FormLabel } from "@/components/ui/form";
import { formatFileSize } from "@/utils/imageUtils";
import type { GalleryValue } from "./GalleryUploadField";

interface Props {
  value: GalleryValue;
  onChange: (v: GalleryValue) => void;
  label?: string;
  hint?: string;
  maxItems?: number;
  accept?: string;
}

export default function DocumentUploadField({ value, onChange, label, hint, maxItems, accept }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const existing = value.existing ?? [];
  const added = value.added ?? [];
  const removed = value.removedDocIds ?? [];
  const visibleExisting = existing.filter((e) => !removed.includes(e.docId));
  const total = visibleExisting.length + added.length;
  const canAdd = !maxItems || total < maxItems;

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const room = maxItems ? Math.max(0, maxItems - total) : arr.length;
    onChange({ ...value, added: [...added, ...arr.slice(0, room)] });
  };
  const removeAdded = (i: number) => onChange({ ...value, added: added.filter((_, k) => k !== i) });
  const removeExisting = (docId: string) => onChange({ ...value, removedDocIds: [...removed, docId] });

  return (
    <FormItem>
      {label && <FormLabel>{label}</FormLabel>}
      {(visibleExisting.length > 0 || added.length > 0) && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {visibleExisting.map((e) => (
            <Row key={e.docId} name={e.name || e.url.split("/").pop() || e.docId} onRemove={() => removeExisting(e.docId)} />
          ))}
          {added.map((f, i) => (
            <Row key={`new-${i}-${f.name}`} name={f.name} size={f.size} isNew onRemove={() => removeAdded(i)} />
          ))}
        </ul>
      )}
      {canAdd && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Upload className="h-4 w-4" /> Ajouter des documents
        </button>
      )}
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

const DOC_EXT = ["pdf", "doc", "docx", "odt", "xls", "xlsx", "csv", "ods", "ppt", "pptx", "odp"];

function Row({ name, size, isNew, onRemove }: { name: string; size?: number; isNew?: boolean; onRemove: () => void }) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const Icon = DOC_EXT.includes(ext) ? FileText : FileIcon;
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={name}>{name}</span>
      {isNew && (
        <span className="shrink-0 rounded bg-primary/80 px-1 text-[10px] font-medium text-primary-foreground">nouveau</span>
      )}
      {typeof size === "number" && size > 0 && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatFileSize(size)}</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive hover:text-destructive-foreground"
        aria-label="Retirer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
