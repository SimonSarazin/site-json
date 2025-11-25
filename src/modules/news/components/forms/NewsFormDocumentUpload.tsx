import { useRef, useState, useCallback } from "react";
import { FileText, X, Upload, File, Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

// Temporary validation config - should be shared with profil module
const DOCUMENT_VALIDATION_CONFIG = {
  maxSizeInMB: 20,
  maxSizeInBytes: 20 * 1024 * 1024,
  allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.odt', '.ods']
};

const validateFile = (file: File, config: typeof DOCUMENT_VALIDATION_CONFIG) => {
  if (file.size > config.maxSizeInBytes) {
    return { valid: false, error: 'File too large' };
  }
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!config.allowedExtensions.includes(ext)) {
    return { valid: false, error: 'Invalid file type' };
  }
  return { valid: true };
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface NewsFormDocumentUploadProps {
  documents: File[];
  onDocumentsChange: (documents: File[]) => void;
  maxDocuments?: number;
}

export function NewsFormDocumentUpload({
  documents,
  onDocumentsChange,
  maxDocuments = 5,
}: NewsFormDocumentUploadProps) {

  const t = useT("modules/news");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processingFiles, setProcessingFiles] = useState<{ [key: string]: number }>({});
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(async (files: File[]) => {
    // Filtrer et valider les fichiers
    const validFiles: File[] = [];
    let hasErrors = false;

    files.forEach((file) => {
      // Valider avec la configuration
      const validation = validateFile(file, DOCUMENT_VALIDATION_CONFIG);

      if (!validation.valid) {
        if (validation.error === 'File too large') {
          toast.error(
            `Fichier trop volumineux: ${file.name} (max: ${DOCUMENT_VALIDATION_CONFIG.maxSizeInMB}MB)`
          );
        } else if (validation.error === 'Invalid file type') {
          toast.error(`Extension non autorisée: ${file.name}`);
        }
        hasErrors = true;
        return;
      }

      validFiles.push(file);
    });

    if (documents.length + validFiles.length > maxDocuments) {
      toast.error(`Maximum ${maxDocuments} documents autorisés`);
      return;
    }

    if (validFiles.length === 0 && hasErrors) {
      return;
    }

    // Simuler la progression pour chaque fichier
    for (const file of validFiles) {
      const fileKey = `${file.name}-${file.size}`;

      setProcessingFiles((prev) => ({ ...prev, [fileKey]: 0 }));

      // Simuler progression
      const progressInterval = setInterval(() => {
        setProcessingFiles((prev) => {
          const current = prev[fileKey] || 0;
          if (current >= 100) {
            clearInterval(progressInterval);
            return prev;
          }
          return { ...prev, [fileKey]: current + 20 };
        });
      }, 100);

      // Nettoyer après traitement
      setTimeout(() => {
        clearInterval(progressInterval);
        setProcessingFiles((prev) => {
          const newState = { ...prev };
          delete newState[fileKey];
          return newState;
        });
      }, 600);
    }

    const newDocuments = [...documents, ...validFiles];
    onDocumentsChange(newDocuments);
  }, [documents, maxDocuments, onDocumentsChange]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    processFiles(files);
    if (event.target) event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleRemoveDocument = (index: number) => {
    const newDocuments = documents.filter((_, i) => i !== index);
    onDocumentsChange(newDocuments);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-4 h-4 text-red-500" />;
    if (['doc', 'docx'].includes(ext || '')) return <FileText className="w-4 h-4 text-blue-500" />;
    if (['xls', 'xlsx'].includes(ext || '')) return <FileText className="w-4 h-4 text-green-500" />;
    return <File className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-3">
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer",
          "hover:border-primary/50 hover:bg-primary/5",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.02]"
            : "border-border bg-muted/30",
          documents.length >= maxDocuments && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div className={cn(
            "p-2 rounded-full transition-colors",
            isDragging ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {isDragging ? (
              <Upload className="w-5 h-5" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-foreground">
              {t("forms.documentUpload.label")}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              {documents.length}/{maxDocuments} • PDF, DOC, XLS
            </p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={documents.length >= maxDocuments}
      />

      {/* Indicateurs de progression */}
      {Object.keys(processingFiles).length > 0 && (
        <div className="space-y-2">
          {Object.entries(processingFiles).map(([fileKey, progress]) => {
            const fileName = fileKey.split('-').slice(0, -1).join('-');
            return (
              <div key={fileKey} className="p-2 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />
                    <span className="truncate">{fileName}</span>
                  </div>
                  <span className="text-muted-foreground ml-2 shrink-0">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-1" />
              </div>
            );
          })}
        </div>
      )}

      {documents.length > 0 && (
        <div className="space-y-1.5">
          {documents.map((doc, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border border-border group hover:bg-muted transition-colors"
            >
              <div className="shrink-0">
                {getFileIcon(doc.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {doc.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatFileSize(doc.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveDocument(index)}
                className="text-red-500 hover:text-red-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}