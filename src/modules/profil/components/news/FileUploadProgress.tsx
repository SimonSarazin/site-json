import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useT } from "@/hooks/useT";

export type UploadStatus = "idle" | "uploading" | "processing" | "compressing" | "success" | "error";

interface FileUploadProgressProps {
  fileName: string;
  progress: number;
  status: UploadStatus;
  error?: string;
}

export function FileUploadProgress({
  fileName,
  progress,
  status,
  error,
}: FileUploadProgressProps) {
  const t = useT("modules/profil");

  const getStatusIcon = () => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "error":
        return <XCircle className="w-4 h-4 text-destructive" />;
      case "uploading":
      case "processing":
      case "compressing":
        return <Loader2 className="w-4 h-4 animate-spin text-info" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "uploading":
        return t("upload.progress.uploading");
      case "processing":
        return t("upload.progress.processing");
      case "compressing":
        return t("upload.progress.compressing");
      case "success":
        return t("upload.progress.complete");
      case "error":
        return error || "Error";
      default:
        return "";
    }
  };

  if (status === "idle") {
    return null;
  }

  return (
    <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {getStatusIcon()}
          <span className="text-sm font-medium truncate">{fileName}</span>
        </div>
        <span className="text-xs text-muted-foreground ml-2">
          {status === "success" ? "100%" : `${Math.round(progress)}%`}
        </span>
      </div>

      {(status === "uploading" || status === "processing" || status === "compressing") && (
        <Progress value={progress} className="h-1" />
      )}

      <p className="text-xs text-muted-foreground">{getStatusText()}</p>
    </div>
  );
}
