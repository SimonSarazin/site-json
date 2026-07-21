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
import { useRef, useMemo, useEffect } from "react";
import { X, Upload, FileText, File as FileIcon, Music } from "lucide-react";
import { FormItem, FormLabel } from "@/components/ui/form";
import { AudioPlayer } from "@/components/media/AudioPlayer";
import { AudioRecorder } from "@/components/media/AudioRecorder";
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
  // Champ AUDIO (accept `audio/*`) → propose l'enregistrement in-navigateur en plus de l'upload de fichier.
  const isAudioField = (accept ?? "").includes("audio");

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const room = maxItems ? Math.max(0, maxItems - total) : arr.length;
    onChange({ ...value, added: [...added, ...arr.slice(0, room)] });
  };
  const addRecorded = (file: File) => { if (canAdd) onChange({ ...value, added: [...added, file] }); };
  const removeAdded = (i: number) => onChange({ ...value, added: added.filter((_, k) => k !== i) });
  const removeExisting = (docId: string) => onChange({ ...value, removedDocIds: [...removed, docId] });

  return (
    <FormItem>
      {label && <FormLabel>{label}</FormLabel>}
      {(visibleExisting.length > 0 || added.length > 0) && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {visibleExisting.map((e) => (
            <Row
              key={e.docId}
              name={e.name || e.url.split("/").pop() || e.docId}
              audioUrl={isAudio(e.name || e.url) ? e.url : undefined}
              onRemove={() => removeExisting(e.docId)}
            />
          ))}
          {added.map((f, i) => (
            <Row key={`new-${i}-${f.name}`} name={f.name} size={f.size} isNew file={f} onRemove={() => removeAdded(i)} />
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
      {isAudioField && canAdd && <AudioRecorder onRecorded={addRecorded} className="mt-2" />}
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
const AUDIO_EXT = ["mp3", "m4a", "ogg", "wav", "webm"];
/** Le nom/URL désigne-t-il un fichier audio (par extension) ? */
function isAudio(nameOrUrl: string): boolean {
  const ext = (nameOrUrl.split("?")[0].split(".").pop() || "").toLowerCase();
  return AUDIO_EXT.includes(ext);
}

function Row({ name, size, isNew, onRemove, audioUrl, file }: { name: string; size?: number; isNew?: boolean; onRemove: () => void; audioUrl?: string; file?: File }) {
  // Fichier AJOUTÉ (pas encore uploadé) audio → aperçu local via objectURL, révoqué au démontage/changement.
  // (useMemo pour la création : setState-dans-effect est interdit par le React Compiler ici ; la seule fuite
  // possible est un render non-committé en StrictMode DEV — triviale, le File reste retenu par le form state.)
  const objectUrl = useMemo(() => (file && isAudio(file.name) ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);
  // `audioUrl` (existant) = docPath DÉJÀ ABSOLU (normalisé par ApiClient._imageFields) → lecture directe.
  const audioSrc = audioUrl ?? objectUrl ?? undefined;
  const ext = (name.split(".").pop() || "").toLowerCase();
  const Icon = audioSrc ? Music : DOC_EXT.includes(ext) ? FileText : FileIcon;
  return (
    <li className="px-3 py-2">
      <div className="flex items-center gap-3">
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
      </div>
      {audioSrc && <AudioPlayer src={audioSrc} className="mt-2" />}
    </li>
  );
}
