import { File as FileIcon, FileText, Download, Upload, X } from "lucide-react";
import { formatFileSize } from "@/utils/imageUtils";

/**
 * Un document/fichier (forme lib `getGalleryFiles`) — `docPath` DÉJÀ absolutisé côté lib (`_imageFields`).
 * `contentKey` = valeur dérivée stockée (`pdf`/`spreadsheet`/`text`/`presentation`), sert à l'icône.
 */
export interface DocFile {
  docId: string;
  docPath?: string;
  name?: string;
  size?: number;
  contentKey?: string;
}

/** Icône colorée par extension/contentKey dérivé (patron legacy co.js:9785, réutilise `NewsFormDocumentUpload`). */
function fileIcon(name?: string, contentKey?: string) {
  const ext = (name?.split(".").pop() || "").toLowerCase();
  const cls = "h-5 w-5 shrink-0";
  if (ext === "pdf" || contentKey === "pdf") return <FileText className={`${cls} text-destructive`} />;
  if (["xls", "xlsx", "csv", "ods"].includes(ext) || contentKey === "spreadsheet")
    return <FileText className={`${cls} text-success`} />;
  if (["doc", "docx", "odt"].includes(ext) || contentKey === "text")
    return <FileText className={`${cls} text-info`} />;
  if (["ppt", "pptx", "odp"].includes(ext) || contentKey === "presentation")
    return <FileText className={`${cls} text-warning`} />;
  return <FileIcon className={`${cls} text-muted-foreground`} />;
}

interface FilesListProps {
  files: DocFile[];
  /** Gestion (admin) : suppression par ligne. Absent = affichage seul. */
  onDelete?: (file: DocFile) => void;
  /** Gestion (admin) : bouton d'ajout. */
  onAddClick?: () => void;
  /** docId en cours de suppression (ligne désactivée). */
  deletingId?: string | null;
  className?: string;
}

/**
 * Liste de documents (lignes : icône-ext + nom + taille + télécharger). Affichage seul par défaut ;
 * `onDelete`/`onAddClick` activent la gestion inline (croix touch-aware + bouton d'ajout). Pendant fichier
 * de `GalleryGrid` (qui, lui, est une grille+lightbox d'images). `docPath` attendu ABSOLU.
 */
export function FilesList({ files, onDelete, onAddClick, deletingId, className }: FilesListProps) {
  if (files.length === 0 && !onAddClick) return null;

  return (
    <div className={className}>
      {files.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {files.map((f) => (
            <li key={f.docId} className="group flex items-center gap-3 px-3 py-2">
              {fileIcon(f.name, f.contentKey)}
              <a
                href={f.docPath}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title={f.name}
              >
                {f.name || f.docId}
              </a>
              {typeof f.size === "number" && f.size > 0 && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatFileSize(f.size)}</span>
              )}
              <a
                href={f.docPath}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground transition hover:text-primary"
                aria-label="Télécharger le document"
              >
                <Download className="h-4 w-4" />
              </a>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(f)}
                  disabled={!!deletingId && deletingId === f.docId}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-100 transition hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                  aria-label="Supprimer le document"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {onAddClick && (
        <button
          type="button"
          onClick={onAddClick}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Upload className="h-4 w-4" /> Ajouter des documents
        </button>
      )}
    </div>
  );
}
