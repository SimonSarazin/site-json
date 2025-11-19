import { useRef } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (documents.length + files.length > maxDocuments) {
      alert(`Vous ne pouvez ajouter que ${maxDocuments} documents maximum`);
      return;
    }

    const newDocuments = [...documents, ...files];
    onDocumentsChange(newDocuments);
  };

  const handleRemoveDocument = (index: number) => {
    const newDocuments = documents.filter((_, i) => i !== index);
    onDocumentsChange(newDocuments);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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
