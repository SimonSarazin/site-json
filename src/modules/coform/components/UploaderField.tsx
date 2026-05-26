import { useMemo, useRef, useCallback, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { FileText, Upload, X, Loader2, FolderOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getBaseUrl } from "@/lib/constant/common";
import { useCocolight } from "@/hooks/useCocolight";
import { showErrorToast } from "@/lib/toastUtils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useT } from "@/hooks/useT";
import "../i18n/i18n";
import type { FormFieldMapping, UploaderValue, UploaderLegacyValue, ImageUploadValue, ExistingUploadFile } from "../types";
import { useCoFormAnswerFiles } from "../hooks/useCoFormAnswerFiles";
import { COFORM_QUERY_KEYS } from "../constants";
import { FieldError } from "./FormFields";

function HintText({ text }: { text: string }) {
  return (
    <div className="text-xs text-muted-foreground -mt-1 mb-1 prose prose-xs dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

// Formats par défaut élargis pour supporter images + documents courants
const DEFAULT_UPLOAD_FORMATS = [
  "jpeg", "jpg", "png", "gif", "webp", "svg",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "txt", "csv", "rar",
];

interface UploaderFieldProps {
  field: FormFieldMapping;
  errors: FieldErrors;
  value?: UploaderValue | UploaderLegacyValue;
  onChange?: (value: UploaderValue | UploaderLegacyValue) => void;
  /** ID du formulaire parent (requis pour charger les fichiers legacy via la lib) */
  formId: string;
  /** ID de la réponse CoForm (pour charger les fichiers legacy depuis la DB) */
  answerId?: string;
  /** SubKey de l'input (format "subFormId.fieldName") */
  subKey?: string;
}

function resolveFileUrl(baseUrl: string, src: string): string {
  if (!src) return src;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:")) {
    return src;
  }
  if (src.startsWith("/")) {
    return `${baseUrl}${src}`;
  }
  return `${baseUrl}/${src}`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Impossible de lire le fichier"));
    reader.readAsDataURL(file);
  });
}

function isExistingFile(item: unknown): item is ExistingUploadFile {
  return typeof item === "object" && item !== null && "docId" in item && "docPath" in item;
}

export function UploaderField({ field, errors, value = [], onChange, formId, answerId, subKey }: UploaderFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { api, me } = useCocolight();
  const queryClient = useQueryClient();
  const baseUrl = getBaseUrl();
  const t = useT("modules/coform");
  const hasError = !!errors[field.name];
  const config = field.uploaderConfig;

  // Mode d'affichage déterminé par la config admin
  const displayMode = config?.displayMode ?? "simple";
  const [isDragOver, setIsDragOver] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  // Détection du format legacy (objet avec updateDate)
  const isLegacyVal = !Array.isArray(value) && typeof value === "object" && value !== null && "updateDate" in value;
  const legacyVal = isLegacyVal ? (value as UploaderLegacyValue) : undefined;

  // Vérifier si la valeur legacy contient des fichiers (tableau non vide OU objet non vide)
  const hasLegacyFiles = (() => {
    if (!legacyVal?.files) return false;
    if (Array.isArray(legacyVal.files)) return legacyVal.files.length > 0;
    return typeof legacyVal.files === "object" && Object.keys(legacyVal.files).length > 0;
  })();
  const isLegacyWithoutFiles = isLegacyVal && !hasLegacyFiles;

  // Récupération depuis la DB pour les valeurs legacy sans fichiers
  const { files: fetchedFiles, isLoading: isLoadingFiles } = useCoFormAnswerFiles({
    formId,
    answerId: answerId ?? "",
    subKey: subKey ?? "",
    enabled: isLegacyWithoutFiles && !!answerId && !!subKey,
  });

  type FileItem = string | ImageUploadValue | ExistingUploadFile;

  const files = useMemo<FileItem[]>(() => {
    if (legacyVal) {
      if (legacyVal.files) {
        // Nouveau format DB : files est un objet { docId: docPath }
        if (!Array.isArray(legacyVal.files) && typeof legacyVal.files === "object") {
          return Object.entries(legacyVal.files).map(([docId, docPath]) => ({
            docId,
            docPath,
          } satisfies ExistingUploadFile));
        }
        // Format de travail (tableau) avec des éléments
        if (Array.isArray(legacyVal.files) && legacyVal.files.length > 0) return legacyVal.files;
      }
      return fetchedFiles;
    }
    return Array.isArray(value) ? value : [];
  }, [legacyVal, value, fetchedFiles]);

  const accept = useMemo(() => {
    const formats = config?.formats ?? DEFAULT_UPLOAD_FORMATS;
    return formats.map((ext) => `.${ext.toLowerCase()}`).join(",");
  }, [config?.formats]);

  const maxFiles = config?.itemLimit ?? 5;
  const maxSize = config?.sizeLimit ?? 5000000;

  const handleAddFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || !onChange) return;

    const selected = Array.from(fileList);
    const existing = files;

    if (existing.length + selected.length > maxFiles) {
      showErrorToast(null, "coform.uploader.tooManyFiles", t, { max: String(maxFiles) });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const newItems: ImageUploadValue[] = [];
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const allowed = (config?.formats ?? DEFAULT_UPLOAD_FORMATS).map((f) => f.toLowerCase());
      if (!allowed.includes(ext)) {
        showErrorToast(null, "coform.uploader.invalidExtension", t, { name: file.name });
        continue;
      }
      if (file.size > maxSize) {
        showErrorToast(null, "coform.uploader.fileTooLarge", t, { name: file.name });
        continue;
      }

      // Conserve un data URI local pour pre-upload multipart au submit final.
      const data = await fileToDataUrl(file);
      newItems.push({ name: file.name, data } satisfies ImageUploadValue);
    }

    if (legacyVal !== undefined) {
      onChange({ ...legacyVal, files: [...files, ...newItems] });
    } else {
      onChange([...(Array.isArray(value) ? value : []), ...newItems]);
    }
    if (inputRef.current) inputRef.current.value = "";
  }, [onChange, files, legacyVal, value, maxFiles, maxSize, config?.formats, t]);

  const handleRemove = useCallback(async (index: number) => {
    if (!onChange) return;
    const item = files[index];

    // Si c'est un fichier existant en DB, le supprimer côté serveur via la
    // méthode entity `answer.deleteFile(docId)` (lib ≥ 1.0.135). La lib fait
    // le cleanup local automatique des structures `{updateDate, files}` dans
    // `serverData.answers` post-suppression, donc le caller n'a pas besoin de
    // refetch — on conserve quand même l'invalidation RQ pour le cache des
    // listes d'answer files éventuellement préchargées.
    if (isExistingFile(item)) {
      if (!api || !answerId) {
        showErrorToast(
          new Error("API ou answerId manquants"),
          "coform.uploader.deleteFileError",
          t,
        );
        return;
      }
      setDeletingIndex(index);
      try {
        const form = await api.form({ id: formId });
        const answer = await form.answer({ id: answerId });
        await answer.deleteFile(item.docId);
        // Invalidation : la liste des fichiers de l'answer doit être refetchée
        // si un consommateur (ReadOnlyUploaderGallery) en a affiché.
        if (subKey) {
          await queryClient.invalidateQueries({
            queryKey: COFORM_QUERY_KEYS.ANSWER_FILES(answerId, subKey, me?.id ?? null),
          });
        }
      } catch (error) {
        showErrorToast(error, "coform.uploader.deleteFileError", t);
        setDeletingIndex(null);
        return;
      }
      setDeletingIndex(null);
    }

    if (legacyVal !== undefined) {
      onChange({ ...legacyVal, files: files.filter((_, i) => i !== index) });
    } else {
      onChange((Array.isArray(value) ? value : []).filter((_, i) => i !== index));
    }
  }, [files, onChange, legacyVal, value, api, queryClient, formId, answerId, subKey, t]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    void handleAddFiles(e.dataTransfer.files);
  }, [handleAddFiles]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const dt = new DataTransfer();
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) dt.items.add(file);
      }
    }
    if (dt.files.length > 0) {
      e.preventDefault();
      void handleAddFiles(dt.files);
    }
  }, [handleAddFiles]);

  const canAddMore = files.length < maxFiles;
  const addLabel = maxFiles > 1
    ? t("coform.uploader.addFiles", "Ajouter des fichiers")
    : t("coform.uploader.addFile", "Ajouter un fichier");

  const fileNames = useMemo(() => {
    if (files.length === 0) return "";
    return files.map((item, i) => {
      if (typeof item === "string") return item.split("/").pop() || `Fichier ${i + 1}`;
      return item.name || (isExistingFile(item) ? item.docPath.split("/").pop() : null) || `Fichier ${i + 1}`;
    }).join(", ");
  }, [files]);

  return (
    <div className={cn("space-y-2", field.width || "col-span-12")}>
      <label
        htmlFor={field.name}
        className={cn("block text-sm font-medium", hasError && "text-destructive")}
      >
        {field.label}
        {field.isRequired && <span className="text-destructive ml-1">*</span>}
      </label>

      {field.info && <HintText text={field.info} />}

      {/* Indicateur chargement legacy */}
      {isLegacyWithoutFiles && isLoadingFiles && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("coform.uploader.loadingFiles", "Chargement des fichiers…")}
        </div>
      )}

      {/* Zone d'upload */}
      {canAddMore && (
        <>
          <input
            ref={inputRef}
            id={field.name}
            type="file"
            className="hidden"
            accept={accept}
            multiple={maxFiles > 1}
            onChange={(e) => void handleAddFiles(e.target.files)}
          />

          {displayMode === "advanced" ? (
            /* ---- MODE DROPZONE ---- */
            <div
              role="button"
              tabIndex={0}
              aria-label={addLabel}
              aria-invalid={hasError || undefined}
              aria-describedby={cn(
                `${field.name}-constraints`,
                hasError && `${field.name}-error`,
              )}
              className={cn(
                "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-8 transition-colors cursor-pointer select-none outline-none",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring",
                hasError && "border-destructive/50"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onPaste={handlePaste}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
            >
              <div className={cn("flex h-12 w-12 items-center justify-center rounded-full transition-colors", isDragOver ? "bg-primary/10" : "bg-muted")}>
                <Upload aria-hidden="true" className={cn("h-6 w-6 transition-colors", isDragOver ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {t("coform.uploader.dropzoneLabel", "Glissez-déposez vos fichiers ici")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("coform.uploader.dropzoneOr", "ou")}{" "}
                  <span className="font-medium text-primary">{t("coform.uploader.browse", "Parcourir")}</span>
                  {" · "}
                  <span>{t("coform.uploader.pasteHint", "Ctrl+V pour coller")}</span>
                </p>
              </div>
              <div id={`${field.name}-constraints`} className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{t("coform.uploader.maxFiles", "Maximum {{max}} fichier(s)").replace("{{max}}", String(maxFiles))}</span>
                <span aria-hidden="true">·</span>
                <span>{t("coform.uploader.maxSize", "Taille max : {{size}} Mo").replace("{{size}}", String(Math.round(maxSize / 1_000_000)))}</span>
              </div>
            </div>
          ) : (
            /* ---- MODE SIMPLE : input readonly + bouton Parcourir ---- */
            <div className="flex items-stretch">
              <div
                className={cn(
                  "flex-1 min-w-0 flex items-center rounded-l-md border border-r-0 bg-background px-3 text-sm min-h-9.5 overflow-hidden",
                  files.length === 0 ? "text-muted-foreground" : "text-foreground",
                  hasError && "border-destructive/50"
                )}
              >
                <span className="truncate">
                  {files.length === 0
                    ? t("coform.uploader.noFileSelected", "Aucun fichier sélectionné")
                    : fileNames
                  }
                </span>
              </div>
              <Button
                type="button"
                variant="default"
                className="gap-2 shrink-0 rounded-l-none min-h-9.5"
                onClick={() => inputRef.current?.click()}
              >
                <FolderOpen className="h-4 w-4" />
                {t("coform.uploader.browse", "Parcourir")}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Liste des fichiers */}
      {files.length > 0 && (
        <div className="space-y-1.5 rounded-md border p-2">
          {files.map((item, index) => {
            const existing = isExistingFile(item);
            const isString = typeof item === "string";
            const src = isString ? item : existing ? item.docPath : item.data;
            const name = isString
              ? item.split("/").pop() || `Fichier ${index + 1}`
              : (item.name || (existing ? item.docPath.split("/").pop() : null) || `Fichier ${index + 1}`);
            const isImage = src.startsWith("data:image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
            const isDeleting = deletingIndex === index;

            return (
              <div
                key={`${name}-${index}`}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-opacity",
                  "bg-muted/40 hover:bg-muted/70",
                  isDeleting && "opacity-50 pointer-events-none"
                )}
              >
                <div className="min-w-0 flex items-center gap-2">
                  {isImage ? (
                    <img
                      src={resolveFileUrl(baseUrl, src)}
                      alt={name}
                      className="h-9 w-9 shrink-0 rounded object-cover border"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-background">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-sm truncate">{name}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={isDeleting}
                  onClick={() => void handleRemove(index)}
                  aria-label={t("coform.uploader.deleteFile", "Supprimer {{name}}").replace("{{name}}", name)}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}

