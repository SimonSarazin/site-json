import { Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useNewsComments } from "../../hooks/useNewsComments";
import { useCocolight } from "@/hooks/useCocolight";
import { CommentInput } from "./CommentInput";
import { CommentItem } from "./CommentItem";

interface NewsCommentsProps {
  newsId: string | null;
}

export function NewsComments({ newsId }: NewsCommentsProps) {
  const t = useT("modules/profil");
  const { me } = useCocolight();

  const { data: commentsData, isLoading } = useNewsComments(newsId);

  const isConnected = me?.isConnected;
  const userPhoto = me?.serverData?.profilThumbImageUrl;
  const userName = me?.serverData?.name || me?.serverData?.email || "U";
  const currentUserId = me?.serverData?.id;

  const handleSubmitComment = (text: string) => {
    console.log("Submit comment:", text);
    // TODO:
  };

  const handleEditComment = (commentId: string) => {
    console.log("Edit comment:", commentId);
    // TODO:
  };

  const handleDeleteComment = (commentId: string) => {
    console.log("Delete comment:", commentId);
    // TODO:
  };

  const handleReply = (text: string, commentId: string) => {
    console.log("Reply to comment:", commentId, "with text:", text);
    // TODO:
  };

  const comments = commentsData ? Object.values(commentsData) : [];

  return (
    <div className="w-full bg-background rounded-b-xl">
      {isConnected ? (
        <CommentInput
          userPhoto={userPhoto}
          userName={userName}
          placeholder={t("NewsTab.writeComment")}
          onSubmit={handleSubmitComment}
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
              const commentId = comment._id.$id;
              const replies = comment.replies ? Object.values(comment.replies) : [];

              return (
                <CommentItem
                  key={commentId}
                  commentId={commentId}
                  text={comment.text}
                  created={comment.created}
                  author={comment.author}
                  voteCount={comment.voteCount}
                  replies={replies}
                  isConnected={isConnected || false}
                  currentUserId={currentUserId}
                  userPhoto={userPhoto}
                  userName={userName}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  onReply={handleReply}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
