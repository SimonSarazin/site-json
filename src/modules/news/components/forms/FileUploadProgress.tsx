import { CheckCircle, X, AlertCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export interface FileUploadStatus {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

interface FileUploadProgressProps {
  uploads: FileUploadStatus[];
  onCancel?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function FileUploadProgress({ uploads, onCancel, onRemove }: FileUploadProgressProps) {
  if (uploads.length === 0) return null;

  return (
    <div className="space-y-2 max-h-40 overflow-y-auto">
      {uploads.map((upload) => (
        <div key={upload.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate">{upload.file.name}</span>
              <div className="flex items-center gap-1">
                {upload.status === 'uploading' && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                )}
                {upload.status === 'completed' && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
                {upload.status === 'error' && (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                {(onCancel && upload.status === 'uploading') || (onRemove && upload.status !== 'uploading') ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 h-auto"
                    onClick={() => {
                      if (upload.status === 'uploading' && onCancel) {
                        onCancel(upload.id);
                      } else if (onRemove) {
                        onRemove(upload.id);
                      }
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                ) : null}
              </div>
            </div>
            
            {upload.status === 'uploading' && (
              <Progress value={upload.progress} className="h-2" />
            )}
            
            {upload.status === 'error' && upload.error && (
              <div className="text-xs text-red-600 mt-1">{upload.error}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}