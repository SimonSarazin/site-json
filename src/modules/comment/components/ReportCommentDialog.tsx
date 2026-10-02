import { useState } from "react";
import { useT } from "@/hooks/useT";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REPORT_REASONS } from "../constants/reportReasons";

export interface ReportCommentDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (reason: string, details: string) => void;
  readonly submitting?: boolean;
}

/**
 * Signalement d'un message.
 *
 * Reprend les sept motifs déjà en place dans le dépôt (`REPORT_REASONS`, déplacé ici et
 * ré-exporté depuis `news` jusqu'au rebranchement) plutôt que d'en inventer d'autres : deux
 * listes de motifs divergentes produiraient deux statistiques de modération incomparables.
 *
 * Monté conditionnellement par son appelant — un dialogue fermé ne doit rien instancier.
 */
export function ReportCommentDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting = false,
}: ReportCommentDialogProps) {
  const t = useT("modules/comment");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reportDialog.title")}</DialogTitle>
          <DialogDescription>{t("reportDialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="comment-report-reason">
              {t("reportDialog.reasonLabel")} <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="comment-report-reason" className="w-full">
                <SelectValue placeholder={String(t("reportDialog.reasonPlaceholder"))} />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comment-report-details">{t("reportDialog.commentLabel")}</Label>
            <Textarea
              id="comment-report-details"
              value={details}
              onChange={event => setDetails(event.target.value)}
              placeholder={String(t("reportDialog.commentPlaceholder"))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("reportDialog.cancel")}
          </Button>
          <Button
            // Sans motif, le signalement n'est pas exploitable par la modération.
            disabled={!reason || submitting}
            // Les champs ne se vident plus à l'envoi : si le serveur refuse, le dialogue reste ouvert
            // avec ce qu'on avait saisi. Il se vide en se fermant — le fil le démonte.
            onClick={() => onSubmit(reason, details)}
          >
            {submitting ? t("reportDialog.submitting") : t("reportDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
