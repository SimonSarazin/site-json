import { Mail, Send, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/useT";
import { MarkdownEditor } from "@/modules/coform/components/MarkdownEditor";
import "@/modules/admin/i18n";

import { useAdminMailing } from "../hooks/useAdminMailing";
import { buildMailingHtml, MAX_MAILING_RECIPIENTS, plainTextOf, type MailingRecipient } from "../lib/mailing";

interface AdminMailingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Destinataires cochés (déjà dédoublonnés). */
  recipients: MailingRecipient[];
  /** Retirer un destinataire depuis la puce (décoche aussi la ligne chez l'appelant). */
  onRemove?: (key: string) => void;
  /** Après un envoi réussi (vider la sélection). */
  onSent?: () => void;
}

/**
 * Formulaire d'envoi groupé — reprise de la modale legacy `views/admin/userMailing.php` : destinataires en
 * puces retirables, objet, message mis en forme, bouton inactif tant que le formulaire est incomplet.
 * Le message est saisi en markdown (éditeur du dépôt) et part en HTML borné (`buildMailingHtml`).
 */
export function AdminMailingDialog({ open, onOpenChange, recipients, onRemove, onSent }: AdminMailingDialogProps) {
  const t = useT("modules/admin");
  const { sendMailing, busy } = useAdminMailing();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const tooMany = recipients.length > MAX_MAILING_RECIPIENTS;
  const ok = subject.trim() !== "" && plainTextOf(message) !== "" && recipients.length > 0 && !tooMany;

  const envoyer = async () => {
    if (!ok) return;
    const done = await sendMailing(subject.trim(), buildMailingHtml(subject, message), recipients);
    if (done) {
      setSubject("");
      setMessage("");
      onOpenChange(false);
      onSent?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" aria-hidden />
            {t("AdminMailing.title")}
          </DialogTitle>
          <DialogDescription>{t("AdminMailing.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              {t("AdminMailing.recipients")} <span className="text-muted-foreground">({recipients.length})</span>
            </Label>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-md border p-2" data-testid="mailing-recipients">
              {recipients.length === 0 ? (
                <span className="text-sm text-muted-foreground">{t("AdminMailing.noRecipient")}</span>
              ) : (
                recipients.map((r) => (
                  <span
                    key={r.key}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                    title={r.label}
                  >
                    <span className="max-w-48 truncate">{r.label}</span>
                    {onRemove && (
                      <button
                        type="button"
                        className="rounded-full hover:text-destructive"
                        aria-label={t("AdminMailing.remove", undefined, { name: r.label })}
                        onClick={() => onRemove(r.key)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>
            {tooMany && (
              <p className="text-xs text-destructive">
                {t("AdminMailing.tooMany", undefined, { max: String(MAX_MAILING_RECIPIENTS) })}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mailing-subject">
              {t("AdminMailing.subject")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="mailing-subject"
              value={subject}
              maxLength={200}
              placeholder={t("AdminMailing.subjectPlaceholder")}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              {t("AdminMailing.message")} <span className="text-destructive">*</span>
            </Label>
            <MarkdownEditor value={message} onChange={setMessage} height={180} />
            <p className="text-xs text-muted-foreground">{t("AdminMailing.unsubscribeNote")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("AdminMailing.cancel")}
          </Button>
          <Button onClick={() => void envoyer()} disabled={!ok || busy} data-testid="mailing-send">
            <Send className="mr-2 h-4 w-4" aria-hidden />
            {busy ? t("AdminMailing.sending") : t("AdminMailing.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
