import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useNewsCommentsQuery } from "../../hooks/useNewsCommentsQuery";
import { useCocolight } from "@/hooks/useCocolight";
import { CommentInput } from "./CommentInput";
import { CommentItem } from "./CommentItem";
import { DeleteCommentDialog } from "./DeleteCommentDialog";
import { Comment, News, EntityTypes } from "@communecter/cocolight-api-client";
import {
  useAddComment,
  useEditComment,
  useDeleteComment,
  useReplyToComment,
} from "../../hooks/useCommentMutations";

interface NewsCommentsProps {
  news: News | null;
  entity: EntityTypes;
}

export function NewsComments({ news, entity }: NewsCommentsProps) {
  const t = useT("modules/profil");
  const { me } = useCocolight();

  const { data: commentsData, isLoading } = useNewsCommentsQuery(news);

  const isConnected = me?.isConnected;
  const userPhoto = me?.serverData?.profilThumbImageUrl;
  const userName = me?.serverData?.name || me?.serverData?.email || "U";

  // État pour le dialogue de confirmation de suppression
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null);

  // Mutations avec optimistic updates activés par défaut
  const addCommentMutation = useAddComment(news?.id || "", entity, { optimistic: true });
  const editCommentMutation = useEditComment(news?.id || "", entity, { optimistic: true });
  const deleteCommentMutation = useDeleteComment(news?.id || "", entity, { optimistic: true });
  const replyMutation = useReplyToComment(news?.id || "", entity, { optimistic: true });

  const handleSubmitComment = useCallback((text: string) => {
    if (!news?.id) return;
    addCommentMutation.mutate({ news, text });
  }, [news, addCommentMutation]);

  const handleEditComment = useCallback((newText: string, comment: Comment) => {
    if (!newText) return;
    editCommentMutation.mutate({ comment, newText });
  }, [editCommentMutation]);

  const handleDeleteComment = useCallback((_commentId: string, comment: Comment) => {
    setCommentToDelete(comment);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (commentToDelete) {
      deleteCommentMutation.mutate(
        { comment: commentToDelete },
        {
          onSuccess: () => {
            setDeleteDialogOpen(false);
            setCommentToDelete(null);
          },
        }
      );
    }
  }, [commentToDelete, deleteCommentMutation]);

  const handleReply = useCallback((text: string, comment: Comment) => {
    if (!comment?.id) return;
    replyMutation.mutate({ comment, text });
  }, [replyMutation]);

  const comments = commentsData ?? [];

  return (
    <div className="w-full bg-background rounded-b-xl">
      {isConnected ? (
        <CommentInput
          userPhoto={userPhoto}
          userName={userName}
          placeholder={t("NewsTab.writeComment")}
          onSubmit={handleSubmitComment}
          disabled={addCommentMutation.isPending}
        />
      ) : (
        <div className="w-full px-5 py-5 text-center text-sm text-muted-foreground">
          {t("NewsTab.loginToComment") || "Connectez-vous pour commenter"}
        </div>
      )}

      <div className="w-full">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm px-5">
            {t("NewsTab.noComments")}
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {comments.map((comment) => {
              const commentId = comment.serverData.id;
              return (
                <CommentItem
                  key={commentId}
                  commentItem={comment}
                  onEdit={handleEditComment}
                  onDelete={(id) => handleDeleteComment(id, comment)}
                  onReply={handleReply}
                />
              );
            })}
          </div>
        )}
      </div>

      <DeleteCommentDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        isPending={deleteCommentMutation.isPending}
      />
    </div>
  );
}
