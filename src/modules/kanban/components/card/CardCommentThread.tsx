import { useEffect, useId, useRef, useState } from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useDayClock } from "@/modules/kanban/components/board/useDayClock";
import { FailureNotice } from "@/modules/kanban/components/ui/FailureNotice";
import { Field } from "@/modules/kanban/components/ui/Field";
import { MemberAvatar } from "@/modules/kanban/components/ui/MemberAvatar";
import { useCardComments } from "@/modules/kanban/hooks/useCardComments";
import { formatDateTime, formatRelativeDays, type DateLocale, type DateZone } from "@/modules/kanban/lib/dates";
import { memberDisplayName } from "@/modules/kanban/lib/memberName";
import type { CardComment, Member } from "@/modules/kanban/types";

export interface CardCommentThreadProps {
  /** Désigne la source du fil (§11.6) : sans lui, le serveur ne sait où le lire. */
  boardId: string;
  cardId: string;
  members: readonly Member[];
  currentUserId: string | null;
  /** Un owner modère le fil : il peut supprimer le message d'un autre. */
  isOwner: boolean;
  /** Tableau archivé : le fil se lit, il ne s'écrit plus. */
  readOnly: boolean;
  locale: DateLocale;
  /** Fuseau des dates affichées, celui du tableau (`dateZoneFor`). */
  zone: DateZone;
}

/**
 * Fil de commentaires de la fiche de carte, repris de co-kanban (`CardCommentThread`). Il vit
 * HORS du `<form>` de la carte : commenter n'est pas enregistrer la carte, et Entrée dans un
 * `<textarea>` du formulaire ferait partir un `card/update`.
 */
export function CardCommentThread({ boardId, cardId, members, currentUserId, isOwner, readOnly, locale, zone }: CardCommentThreadProps) {
  const { t } = useTranslation("modules/kanban");
  const headingId = useId();
  const composerId = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  const { comments, total, isLoading, error, addComment, deleteComment } = useCardComments(boardId, cardId);
  const [text, setText] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  /*
   * L'instant courant n'existe que dans le navigateur : à 0, la date absolue, identique au rendu
   * serveur et au premier rendu client ; la date relative (au jour près) n'apparaît qu'ensuite.
   */
  const nowSeconds = useDayClock();

  useEffect(() => {
    // La confirmation qui apparaît prend le focus : sinon la personne au clavier reste sur un
    // bouton qui vient de disparaître.
    if (confirmingId !== null) confirmRef.current?.focus();
  }, [confirmingId]);

  function authorName(comment: CardComment): string {
    // Le profil joint par le serveur d'abord ; à défaut, celui du membre encore présent ; en
    // dernier ressort seulement, « auteur inconnu ».
    const fromMember = members.find((member) => member.userId === comment.authorId)?.profile;
    return memberDisplayName(comment.author ?? fromMember, t("comments.unknownAuthor"));
  }

  function canDelete(comment: CardComment): boolean {
    if (readOnly) return false;
    // Contrat `comment/delete` : l'auteur, ou un owner du tableau.
    return isOwner || (currentUserId !== null && comment.authorId === currentUserId);
  }

  function send() {
    const value = text.trim();
    if (value.length === 0) return;
    // Le champ n'est vidé qu'au SUCCÈS : en cas d'échec, le texte reste et peut être renvoyé.
    addComment.mutate({ text: value }, { onSuccess: () => setText("") });
  }

  return (
    <section aria-labelledby={headingId} className="border-t border-border pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <MessageSquare aria-hidden className="size-4" />
          {t("comments.title")}
        </h3>
        <output className="text-xs text-muted-foreground tabular-nums">{t("comments.count", { count: total })}</output>
      </div>

      {isLoading ? (
        <div className="mt-3 flex flex-col gap-3" aria-busy="true">
          <span className="sr-only">{t("common.loading")}</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-4/5" />
        </div>
      ) : error !== null ? (
        <FailureNotice error={error} announce="alert" className="mt-3" />
      ) : comments.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{t("comments.empty")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {comments.map((comment) => {
            const name = authorName(comment);
            const absolute = formatDateTime(comment.created, locale, zone);
            return (
              <li key={comment._id} className="flex gap-3">
                <MemberAvatar name={name} src={comment.author?.profilThumbImageUrl} size="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold text-foreground">{name}</span>
                    {/* `title` porte toujours la date exacte : le relatif est pratique, pas précis. */}
                    <time dateTime={new Date(comment.created * 1000).toISOString()} title={absolute} className="text-xs text-muted-foreground tabular-nums">
                      {nowSeconds > 0 ? formatRelativeDays(comment.created, locale, nowSeconds, zone) : absolute}
                    </time>
                  </p>
                  {/* Texte brut : aucune interpolation dans le DOM. */}
                  <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-foreground">{comment.text}</p>

                  {confirmingId === comment._id ? (
                    <div role="alert" className="mt-2 rounded-lg border border-border bg-warning/25 p-2.5">
                      <p className="text-xs font-medium text-foreground">{t("comments.confirmDelete")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button ref={confirmRef} type="button" variant="outline" size="sm" onClick={() => setConfirmingId(null)}>
                          {t("common.cancel")}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={deleteComment.isPending}
                          onClick={() => deleteComment.mutate({ commentId: comment._id }, { onSuccess: () => setConfirmingId(null) })}
                        >
                          {t("common.delete")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {canDelete(comment) && confirmingId !== comment._id ? (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={t("comments.delete")} className="text-muted-foreground pointer-coarse:size-11" onClick={() => setConfirmingId(comment._id)}>
                    <Trash2 aria-hidden />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* Le serveur plafonne la page à 100 messages : le dire plutôt que laisser croire le fil complet. */}
      {total > comments.length ? <p className="mt-2 text-xs text-muted-foreground">{t("comments.truncated", { shown: comments.length, total })}</p> : null}

      {readOnly ? (
        <p className="mt-4 text-xs text-muted-foreground">{t("comments.readOnly")}</p>
      ) : (
        <div className="mt-4">
          <Field label={t("comments.addLabel")} htmlFor={composerId}>
            <Textarea id={composerId} rows={3} value={text} placeholder={t("comments.placeholder")} onChange={(event) => setText(event.target.value)} />
          </Field>
          <div className="mt-2 flex justify-end">
            <Button type="button" aria-busy={addComment.isPending || undefined} disabled={text.trim().length === 0 || addComment.isPending} onClick={send} className="pointer-coarse:h-11">
              <Send aria-hidden />
              {addComment.isPending ? t("comments.sending") : t("comments.submit")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
