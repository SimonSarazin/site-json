import { useState } from "react";
import { Flag, MoreVertical, Trash2, Edit } from "lucide-react";
import { useT } from "@/hooks/useT";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommentInput } from "./CommentInput";
import type { Comment } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useFormatComment } from "../../hooks/useFormatComment";

interface CommentItemProps {
  commentItem: Comment;
  onEdit: (newText: string, comment: Comment) => void;
  onDelete: (commentId: string) => void;
  onReply: (text: string, comment: Comment) => void;
}

export function CommentItem({
  commentItem,
  onEdit,
  onDelete,
  onReply
}: CommentItemProps) {
  const t = useT("modules/profil");
  const { me } = useCocolight();
  const [replyingTo, setReplyingTo] = useState(false);
  const [editingComment, setEditingComment] = useState(false);

  // Utilisation du hook de formatage pour simplifier l'accès aux données
  const formattedComment = useFormatComment(commentItem);

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

  // Si le commentaire n'a pas pu être formaté, ne rien afficher
  if (!formattedComment) return null;

  return (
    <div>
      <div className="w-full flex py-4 md:px-5 px-3 font-bold">
        <Avatar className="md:size-12 size-8 shrink-0">
          {formattedComment.authorPhoto ? (
            <AvatarImage
              src={formattedComment.authorPhoto}
              alt={formattedComment.authorName}
            />
          ) : null}
          <AvatarFallback className="bg-gradient-to-br from-teal-400 to-teal-600 text-white font-bold text-xs">
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
                    <button className="ml-2 p-1 hover:bg-background/50 rounded transition-colors opacity-0 group-hover:opacity-100">
                      <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={handleEditClick}>
                      <Edit className="mr-2 h-3.5 w-3.5" />
                      <span className="text-xs">{t("NewsTab.edit")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(formattedComment.id)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      <span className="text-xs">{t("NewsTab.delete")}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {editingComment ? (
              <CommentInput
                userPhoto={userPhoto}
                userName={userName}
                placeholder={t("NewsTab.editComment")}
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
                className="bg-background md:text-xs text-[9px] h-auto py-1 px-2 hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formattedComment.totalVotes > 0 && <span className="mr-1">{formattedComment.totalVotes}</span>}
                {t("NewsTab.like")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!isConnected}
                onClick={() => isConnected && setReplyingTo(!replyingTo)}
                className="bg-background md:text-xs text-[9px] h-auto py-1 px-2 hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("NewsTab.reply")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!isConnected}
                aria-label="Signaler un abus"
                className="bg-background md:text-xs text-[9px] h-auto py-1 px-2 hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Flag className="w-3 h-3 inline" />
              </Button>
            </div>
          </div>

          {replyingTo && isConnected && (
            <div className="mt-3">
              <CommentInput
                userPhoto={userPhoto}
                userName={userName}
                placeholder={t("NewsTab.writeReply")}
                onSubmit={handleReplySubmit}
                autoFocus
                size="small"
              />
            </div>
          )}
        </div>
      </div>

      {formattedComment.replies.length > 0 && (
        <div className="ml-12 md:ml-16 space-y-4">
          {formattedComment.replies.map((reply) => (
            <div key={reply.id} className="w-full flex py-2 md:px-5 px-3 font-bold">
              <div className="shrink-0">
                {reply.authorPhoto ? (
                  <img
                    src={reply.authorPhoto}
                    alt={reply.authorName}
                    className="block md:size-10 size-7 object-cover rounded-full"
                  />
                ) : (
                  <div className="md:size-10 size-7 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                    {reply.authorName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="ml-3 grow">
                <div className="inline-block w-full p-2.5 rounded-xl bg-muted relative group">
                  <div className="flex justify-between items-start">
                    <h1 className="text-foreground text-xs font-semibold">
                      {reply.authorName}
                    </h1>
                    {reply.isAuthor && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="ml-2 p-0.5 hover:bg-background/50 rounded transition-colors opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => {
                            // TODO: Implement reply edit
                          }}>
                            <Edit className="mr-2 h-3 w-3" />
                            <span className="text-xs">{t("NewsTab.edit")}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(reply.id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-3 w-3" />
                            <span className="text-xs">{t("NewsTab.delete")}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <p className="text-xs font-medium text-foreground mt-1 break-all leading-relaxed">
                    {reply.text}
                  </p>
                </div>

                <div className="flex flex-row md:space-x-5 space-x-1 items-center py-1">
                  <p className="text-muted-foreground text-[9px]">
                    {reply.formattedDate}
                  </p>
                  <div className="flex divide-x-2 divide-border">
                    <button
                      disabled={!isConnected}
                      className="bg-background text-[9px] text-muted-foreground px-2 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reply.totalVotes > 0 && <span className="mr-1">{reply.totalVotes}</span>}
                      {t("NewsTab.like")}
                    </button>
                    <button
                      disabled={!isConnected}
                      aria-label="Signaler un abus"
                      className="bg-background text-[9px] text-muted-foreground px-2 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Flag className="w-2.5 h-2.5 inline" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
