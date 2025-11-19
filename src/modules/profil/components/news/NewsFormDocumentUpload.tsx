import { useRef, useState, useCallback } from "react";
import { FileText, X, Upload, File } from "lucide-react";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";

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
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback((files: File[]) => {
    if (documents.length + files.length > maxDocuments) {
      alert(`Vous ne pouvez ajouter que ${maxDocuments} documents maximum`);
      return;
    }

    const newDocuments = [...documents, ...files];
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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
              {t("AddNewsModal.form.documents.button")}
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
