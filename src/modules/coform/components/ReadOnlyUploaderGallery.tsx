import { useState, useMemo, useCallback } from "react";
import { FileText, Download, ExternalLink, Image as ImageIcon } from "lucide-react";
import { ImageViewer } from "@/components/ui/image-viewer";
import { getBaseUrl } from "@/lib/constant/common";
import { useT } from "@/hooks/useT";
import "../i18n/i18n";
import type { UploaderLegacyValue, ExistingUploadFile } from "../types";
import { useCoFormAnswerFiles } from "../hooks/useCoFormAnswerFiles";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
const PDF_EXTENSION = "pdf";

interface FileEntry {
  docId?: string;
  docPath: string;
  name: string;
  ext: string;
  isImage: boolean;
  isPdf: boolean;
}

function resolveFileUrl(baseUrl: string, src: string): string {
  if (!src) return src;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:")) return src;
  if (src.startsWith("/")) return `${baseUrl}${src}`;
  return `${baseUrl}/${src}`;
}

function getFileExtension(path: string): string {
  return (path.split(".").pop() || "").toLowerCase();
}

interface ReadOnlyUploaderGalleryProps {
  value: unknown;
  /** ID du formulaire parent (requis pour charger les fichiers legacy via la lib) */
  formId: string;
  answerId?: string;
  subKey?: string;
}

export function ReadOnlyUploaderGallery({ value, formId, answerId, subKey }: ReadOnlyUploaderGalleryProps) {
  const baseUrl = getBaseUrl();
  const t = useT("modules/coform");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Détection format legacy
  const isLegacyVal = !Array.isArray(value) && typeof value === "object" && value !== null && "updateDate" in value;
  const legacyVal = isLegacyVal ? (value as UploaderLegacyValue) : undefined;

  const hasLegacyFiles = (() => {
    if (!legacyVal?.files) return false;
    if (Array.isArray(legacyVal.files)) return legacyVal.files.length > 0;
    return typeof legacyVal.files === "object" && Object.keys(legacyVal.files).length > 0;
  })();
  const isLegacyWithoutFiles = isLegacyVal && !hasLegacyFiles;

  const { files: fetchedFiles } = useCoFormAnswerFiles({
    formId,
    answerId: answerId ?? "",
    subKey: subKey ?? "",
    enabled: isLegacyWithoutFiles && !!answerId && !!subKey,
  });

  // Normaliser en liste de FileEntry
  const entries = useMemo<FileEntry[]>(() => {
    let raw: Array<string | ExistingUploadFile> = [];

    if (legacyVal) {
      if (legacyVal.files) {
        if (!Array.isArray(legacyVal.files) && typeof legacyVal.files === "object") {
          raw = Object.entries(legacyVal.files).map(([docId, docPath]) => ({ docId, docPath } as ExistingUploadFile));
        } else if (Array.isArray(legacyVal.files)) {
          raw = legacyVal.files.filter((f): f is string | ExistingUploadFile => typeof f === "string" || (typeof f === "object" && f !== null && "docPath" in f));
        }
      }
      if (raw.length === 0) {
        raw = fetchedFiles;
      }
    } else if (Array.isArray(value)) {
      raw = value.filter((f): f is string | ExistingUploadFile => typeof f === "string" || (typeof f === "object" && f !== null && "docPath" in f));
    }

    return raw.map((item) => {
      const docPath = typeof item === "string" ? item : item.docPath;
      const docId = typeof item === "string" ? undefined : item.docId;
      const name = docPath.split("/").pop() || "fichier";
      const ext = getFileExtension(name);
      return {
        docId,
        docPath,
        name,
        ext,
        isImage: IMAGE_EXTENSIONS.includes(ext),
        isPdf: ext === PDF_EXTENSION,
      };
    });
  }, [legacyVal, value, fetchedFiles]);

  const imageEntries = useMemo(() => entries.filter((e) => e.isImage), [entries]);

  const openViewer = useCallback((idx: number) => setViewerIndex(idx), []);
  const closeViewer = useCallback(() => setViewerIndex(null), []);

  if (entries.length === 0) {
    return <span className="text-muted-foreground/50 italic">—</span>;
  }

  let imageIndex = 0;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {entries.map((entry, idx) => {
          if (entry.isImage) {
            const currentImageIdx = imageIndex++;
            return (
              <ImageTile
                key={idx}
                entry={entry}
                baseUrl={baseUrl}
                onClick={() => openViewer(currentImageIdx)}
              />
            );
          }
          if (entry.isPdf) {
            return (
              <PdfTile
                key={idx}
                entry={entry}
                baseUrl={baseUrl}
                label={t("coform.uploader.gallery.openPdf", "Ouvrir le PDF")}
              />
            );
          }
          return (
            <FileTile
              key={idx}
              entry={entry}
              baseUrl={baseUrl}
              downloadLabel={t("coform.uploader.gallery.download", "Télécharger")}
            />
          );
        })}
      </div>

      <ImageViewer
        images={imageEntries.map((e) => ({ src: resolveFileUrl(baseUrl, e.docPath), name: e.name }))}
        initialIndex={viewerIndex ?? 0}
        open={viewerIndex !== null}
        onClose={closeViewer}
      />
    </>
  );
}

// ─── Tiles ──────────────────────────────────────────────────────

function ImageTile({ entry, baseUrl, onClick }: { entry: FileEntry; baseUrl: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="group relative aspect-square rounded-lg overflow-hidden border bg-muted/30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      <img
        src={resolveFileUrl(baseUrl, entry.docPath)}
        alt={entry.name}
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
      </div>
      <span className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent px-2 py-1.5 text-xs text-white truncate">
        {entry.name}
      </span>
    </button>
  );
}

function PdfTile({ entry, baseUrl, label }: { entry: FileEntry; baseUrl: string; label: string }) {
  const url = resolveFileUrl(baseUrl, entry.docPath);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center justify-center gap-2 aspect-square rounded-lg border bg-muted/30 p-3 hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <FileText className="h-7 w-7" />
      </div>
      <span className="text-xs font-medium text-foreground truncate max-w-full text-center">
        {entry.name}
      </span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
        <ExternalLink className="h-3 w-3" />
        {label}
      </span>
    </a>
  );
}

function FileTile({ entry, baseUrl, downloadLabel }: { entry: FileEntry; baseUrl: string; downloadLabel: string }) {
  const url = resolveFileUrl(baseUrl, entry.docPath);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center justify-center gap-2 aspect-square rounded-lg border bg-muted/30 p-3 hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileText className="h-7 w-7" />
      </div>
      <span className="text-xs font-medium text-foreground truncate max-w-full text-center">
        {entry.name}
      </span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
        <Download className="h-3 w-3" />
        {downloadLabel}
      </span>
    </a>
  );
}
