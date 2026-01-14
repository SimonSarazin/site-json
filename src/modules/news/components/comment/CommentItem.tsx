import { useState } from "react";
import { Flag, MoreVertical, Trash2, Edit, ChevronDown, ChevronRight } from "lucide-react";
import { useT } from "@/hooks/useT";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommentInput } from "./CommentInput";
import { ReportDialog } from "../ReportDialog";
import type { Comment, EntityTypes } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useFormatComment } from "../../hooks/useFormatComment";
import { useAddCommentVote } from "../../hooks/useCommentMutations";

interface CommentItemProps {
  commentItem: Comment;
  newsId: string;
  entity: EntityTypes;
  onEdit: (newText: string, comment: Comment) => void;
  onDelete: (commentId: string, comment: Comment, parentCommentId?: string) => void;
  onReply: (text: string, comment: Comment) => void;
  depth?: number;
  maxDepth?: number;
}

export function CommentItem({
  commentItem,
  newsId,
  entity,
  onEdit,
  onDelete,
  onReply,
  depth = 0,
  maxDepth = 3,
}: CommentItemProps) {
  const t = useT("modules/news");
  const { me } = useCocolight();
  const [replyingTo, setReplyingTo] = useState(false);
  const [editingComment, setEditingComment] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [commentToReport, setCommentToReport] = useState<Comment | null>(null);

  // Mutation pour gérer les votes sur les commentaires
  const addCommentVoteMutation = useAddCommentVote(newsId, { optimistic: true });


  // Utilisation du hook de formatage pour simplifier l'accès aux données
  const formattedComment = useFormatComment(commentItem, entity);

  const isConnected = me?.isConnected;
  const userPhoto = me?.serverData?.profilThumbImageUrl;
  const userName = me?.serverData?.name || me?.serverData?.email || "U";

  const handleReplySubmit = (replyText: string) => {
    if (formattedComment?.id && commentItem) {
      onReply(replyText, commentItem);
      setReplyingTo(false);
    }
  };

  const handleEditClick = () => {
    setEditingComment(true);
  };

  const handleEditSubmit = (newText: string) => {
    if (newText.trim() && commentItem) {
      onEdit(newText, commentItem);
      setEditingComment(false);
    }
  };

  const handleCommentLike = (comment: Comment) => {
    if (!isConnected) return;
    addCommentVoteMutation.mutate({ comment, voteType: "like" });
  };

  const handleReportComment = (comment: Comment) => {
    setCommentToReport(comment);
    setReportDialogOpen(true);
  };

  // Si le commentaire n'a pas pu être formaté, ne rien afficher
  if (!formattedComment) return null;

  const hasReplies = formattedComment.replies.length > 0;
  const isMaxDepth = depth >= maxDepth;

  // Classes d'indentation statiques pour Tailwind (seulement si depth > 0)
  const indentClasses: Record<number, string> = {
    1: "ml-8 md:ml-12",
    2: "ml-16 md:ml-24",
    3: "ml-24 md:ml-36",
  };
  const indentClass = depth > 0 ? (indentClasses[Math.min(depth, 3)] || indentClasses[3]) : "";

  return (
    <div className={indentClass}>
      <div className="w-full flex py-4 md:px-5 px-3 font-bold">
        <Avatar className="md:size-12 size-8 shrink-0">
          {formattedComment.authorPhoto ? (
            <AvatarImage
              src={formattedComment.authorPhoto}
              alt={formattedComment.authorName}
            />
          ) : null}
          <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-bold text-xs">
            {formattedComment.authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="ml-4 grow">
          <div className="inline-block w-full p-3 rounded-xl bg-muted relative group">
            <div className="flex justify-between items-start -mt-1">
              <h1 className="text-foreground md:text-sm text-xs font-semibold">
                {formattedComment.authorName}
              </h1>
              {formattedComment.isAuthor && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="ml-2 p-1 hover:bg-background/50 rounded transition-colors opacity-0 group-hover:opacity-100">
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleEditClick}>
                      <Edit />
                      <span className="text-xs sm:text-sm">{t("comments.edit")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(formattedComment.id, commentItem)}
                      variant="destructive"
                    >
                      <Trash2 />
                      <span className="text-xs sm:text-sm">{t("comments.delete")}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {editingComment ? (
              <CommentInput
                userPhoto={userPhoto}
                userName={userName}
                placeholder={t("comments.editComment")}
                onSubmit={handleEditSubmit}
                initialValue={formattedComment.text}
                autoFocus
                size="small"
              />
            ) : (
              <p className="md:text-sm text-[11px] font-medium text-foreground mt-1 break-all leading-relaxed">
                {formattedComment.text}
              </p>
            )}
          </div>

          <div className="flex flex-row md:space-x-5 space-x-1 items-center py-1">
            <p className="text-muted-foreground md:text-xs text-[9px] text-center justify-start">
              {formattedComment.formattedDate}
            </p>
            <div className="flex divide-x-2 divide-border">
              <Button
                variant="ghost"
                size="sm"
                disabled={!isConnected}
                onClick={() => handleCommentLike(commentItem)}
                className="bg-background md:text-xs text-[9px] h-auto py-1 px-2 hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formattedComment.totalVotes > 0 && <span className="mr-1">{formattedComment.totalVotes}</span>}
                {t("comments.like")}
              </Button>
              {!isMaxDepth && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!isConnected}
                  onClick={() => isConnected && setReplyingTo(!replyingTo)}
                  className="bg-background md:text-xs text-[9px] h-auto py-1 px-2 hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("comments.reply")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={!isConnected}
                onClick={() => isConnected && handleReportComment(commentItem)}
                aria-label="Signaler un abus"
                className="bg-background md:text-xs text-[9px] h-auto py-1 px-2 hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Flag className="w-3 h-3 inline" />
              </Button>
              {hasReplies && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="bg-background md:text-xs text-[9px] h-auto py-1 px-2 hover:bg-transparent"
                >
                  {isCollapsed ? (
                    <>
                      <ChevronRight className="w-3 h-3 inline mr-1" />
                      {t("comments.expandThread")} ({formattedComment.repliesCount})
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 inline mr-1" />
                      {t("comments.collapseThread")}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {replyingTo && isConnected && (
            <div className="mt-3">
              <CommentInput
                userPhoto={userPhoto}
                userName={userName}
                placeholder={t("comments.writeReply")}
                onSubmit={handleReplySubmit}
                autoFocus
                size="small"
              />
            </div>
          )}
        </div>
      </div>

      {/* Rendu récursif des replies */}
      {hasReplies && !isCollapsed && (
        <div className="space-y-2 mt-2">
          {formattedComment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              commentItem={reply.comment}
              newsId={newsId}
              entity={entity}
              onEdit={onEdit}
              onDelete={onDelete}
              onReply={onReply}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}

      <ReportDialog
        type="comment"
        item={commentToReport}
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
      />
    </div>
  );
}