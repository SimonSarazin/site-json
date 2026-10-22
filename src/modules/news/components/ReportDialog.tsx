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
import { REPORT_REASONS } from "@/modules/comment/constants/reportReasons";
import type { News } from "@communecter/cocolight-api-client";

interface ReportDialogProps {
  /**
   * Conservé pour les appelants existants, mais une seule valeur a désormais un sens : le
   * signalement d'un COMMENTAIRE est passé au module `comment`, qui porte son propre dialogue.
   */
  type?: "news";
  item: News | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDialog({ item, open, onOpenChange }: ReportDialogProps) {
  const t = useT("modules/news");
  const reportNewsMutation = useReportNews();

  const [reason, setReason] = useState("");
  const [commentText, setCommentText] = useState("");

  const isReporting = reportNewsMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!item || !reason) return;

    reportNewsMutation.mutate(
      {
        news: item,
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
            {t("reportDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("reportDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-reason" className="text-sm font-semibold">
              {t("reportDialog.reasonLabel")} <span className="text-destructive">*</span>
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
              className="bg-warning hover:bg-warning/90 text-warning-foreground font-semibold text-xs sm:text-sm uppercase"
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