import { useRef, useState } from "react";
import { FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { toast } from "sonner";
import { validateFile, formatFileSize, DOCUMENT_VALIDATION_CONFIG } from "../../utils/fileValidation";
import { Progress } from "@/components/ui/progress";

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

  const t = useT("modules/profil");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processingFiles, setProcessingFiles] = useState<{ [key: string]: number }>({});

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    // Filtrer et valider les fichiers
    const validFiles: File[] = [];
    let hasErrors = false;

    files.forEach((file) => {
      // Valider avec la configuration
      const validation = validateFile(file, DOCUMENT_VALIDATION_CONFIG);

      if (!validation.valid) {
        if (validation.errorKey === "upload.errors.fileTooLarge") {
          toast.error(
            t("upload.errors.fileTooLarge", undefined, {
              fileName: file.name,
              maxSize: DOCUMENT_VALIDATION_CONFIG.maxSizeInMB,
            })
          );
        } else if (validation.errorKey === "upload.errors.invalidExtension") {
          toast.error(t("upload.errors.invalidExtension", undefined, { fileName: file.name }));
        }
        hasErrors = true;
        return;
      }

      validFiles.push(file);
    });

    if (documents.length + validFiles.length > maxDocuments) {
      toast.error(t("AddNewsModal.form.documents.maxReached", undefined, { max: maxDocuments }));
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
  };

  const handleRemoveDocument = (index: number) => {
    const newDocuments = documents.filter((_, i) => i !== index);
    onDocumentsChange(newDocuments);
  };


  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={documents.length >= maxDocuments}
          className="text-xs w-full sm:text-sm"
        >
          <FileText className="w-4 h-4 mr-2" />
          {t("AddNewsModal.form.documents.button")}
        </Button>
        {documents.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {documents.length}/{maxDocuments}
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        multiple
        onChange={handleFileSelect}
        className="hidden"
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
        <div className="space-y-2">
          {documents.map((doc, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 sm:p-3 bg-muted rounded-lg border border-border"
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                    {doc.name}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {formatFileSize(doc.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveDocument(index)}
                className="text-red-500 hover:text-red-600 p-1 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
