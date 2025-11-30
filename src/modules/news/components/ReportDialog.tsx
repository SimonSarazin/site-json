import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/hooks/useT";
import { useReportNews } from "../hooks/useNewsMutations";
import { useReportComment } from "../hooks/useCommentMutations";
import { REPORT_REASONS } from "../constants/reportReasons";
import type { News, Comment } from "@communecter/cocolight-api-client";

interface ReportDialogProps {
  type: "news" | "comment";
  item: News | Comment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDialog({ type, item, open, onOpenChange }: ReportDialogProps) {
  const t = useT("modules/news");
  const reportNewsMutation = useReportNews();
  const reportCommentMutation = useReportComment();

  const [reason, setReason] = useState("");
  const [commentText, setCommentText] = useState("");

  const isReporting = reportNewsMutation.isPending || reportCommentMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!item || !reason) return;

    if (type === "news") {
      reportNewsMutation.mutate(
        {
          news: item as News,
          reason,
          comment: commentText.trim() || undefined,
        },
        {
          onSuccess: () => {
            setReason("");
            setCommentText("");
            onOpenChange(false);
          },
        }
      );
    } else {
      reportCommentMutation.mutate(
        {
          comment: item as Comment,
          reason,
          commentText: commentText.trim() || undefined,
        },
        {
          onSuccess: () => {
            setReason("");
            setCommentText("");
            onOpenChange(false);
          },
        }
      );
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isReporting) {
      if (!newOpen) {
        setReason("");
        setCommentText("");
      }
      onOpenChange(newOpen);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            {type === "news" ? t("reportDialog.title") : t("reportDialog.titleComment")}
          </DialogTitle>
          <DialogDescription>
            {t("reportDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-reason" className="text-sm font-semibold">
              {t("reportDialog.reasonLabel")} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={reason}
              onValueChange={setReason}
              disabled={isReporting}
            >
              <SelectTrigger id="report-reason" className="w-full">
                <SelectValue placeholder={t("reportDialog.reasonPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((reportReason) => (
                  <SelectItem key={reportReason.value} value={reportReason.value}>
                    {t(reportReason.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-comment" className="text-sm font-semibold">
              {t("reportDialog.commentLabel")}
            </Label>
            <Textarea
              id="report-comment"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t("reportDialog.commentPlaceholder")}
              rows={4}
              className="resize-none text-sm"
              disabled={isReporting}
            />
          </div>

          <DialogFooter className="space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isReporting}
              className="text-xs sm:text-sm uppercase"
            >
              {t("reportDialog.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isReporting || !reason}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs sm:text-sm uppercase"
            >
              {isReporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("reportDialog.submitting")}
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {t("reportDialog.submit")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}