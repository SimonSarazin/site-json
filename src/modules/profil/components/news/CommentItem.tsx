import { useState } from "react";
import { Flag, MoreVertical, Trash2, Edit } from "lucide-react";
import { useT } from "@/hooks/useT";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useLocalization } from "@/hooks/useLocalization";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommentInput } from "./CommentInput";

interface CommentAuthor {
  id: string;
  name: string;
  profilThumbImageUrl?: string;
}

interface Reply {
  _id: { $id: string };
  text: string;
  created: number;
  author: CommentAuthor;
  voteCount?: Record<string, number>;
}

interface CommentItemProps {
  commentId: string;
  text: string;
  created: number;
  author: CommentAuthor;
  voteCount?: Record<string, number>;
  replies?: Reply[];
  isConnected: boolean;
  currentUserId?: string;
  userPhoto?: string;
  userName: string;
  onEdit: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onReply: (text: string, commentId: string) => void;
}

export function CommentItem({
  commentId,
  text,
  created,
  author,
  voteCount,
  replies = [],
  isConnected,
  currentUserId,
  userPhoto,
  userName,
  onEdit,
  onDelete,
  onReply,
}: CommentItemProps) {
  const t = useT("modules/profil");
  const { currentLocale } = useLocalization();
  const [replyingTo, setReplyingTo] = useState(false);

  const formatCommentDate = (timestamp: number) => {
    const locale = currentLocale === "fr" ? fr : enUS;
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale });
  };

  const totalVotes = voteCount
    ? Object.values(voteCount).reduce((sum, count) => sum + count, 0)
    : 0;

  const isAuthor = isConnected && author.id === currentUserId;

  const handleReplySubmit = (replyText: string) => {
    onReply(replyText, commentId);
    setReplyingTo(false);
  };

  return (
    <div>
      <div className="w-full flex py-4 md:px-5 px-3 font-bold">
        <Avatar className="md:size-12 size-8 shrink-0">
          {author.profilThumbImageUrl ? (
            <AvatarImage
              src={author.profilThumbImageUrl}
              alt={author.name}
            />
          ) : null}
          <AvatarFallback className="bg-linear-to-br from-teal-400 to-teal-600 text-white font-bold text-xs">
            {author.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="ml-4 grow">
          <div className="inline-block w-full p-3 rounded-xl bg-muted relative group">
            <div className="flex justify-between items-start -mt-1">
              <h1 className="text-foreground md:text-sm text-xs font-semibold">
                {author.name}
              </h1>
              {isAuthor && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="ml-2 p-1 hover:bg-background/50 rounded transition-colors opacity-0 group-hover:opacity-100">
                      <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => onEdit(commentId)}>
                      <Edit className="mr-2 h-3.5 w-3.5" />
                      <span className="text-xs">{t("NewsTab.edit")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(commentId)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      <span className="text-xs">{t("NewsTab.delete")}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <p className="md:text-sm text-[11px] font-medium text-foreground mt-1 break-all leading-relaxed">
              {text}
            </p>
          </div>

          <div className="flex flex-row md:space-x-5 space-x-1 items-center py-1">
            <p className="text-muted-foreground md:text-xs text-[9px] text-center justify-start">
              {formatCommentDate(created)}
            </p>
            <div className="flex divide-x-2 divide-border">
              <Button
                variant="ghost"
                size="sm"
                disabled={!isConnected}
                className="bg-background md:text-xs text-[9px] h-auto py-1 px-2 hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {totalVotes > 0 && <span className="mr-1">{totalVotes}</span>}
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

      {replies.length > 0 && (
        <div className="ml-12 md:ml-16 space-y-4">
          {replies.map((reply) => {
            const replyId = reply._id.$id;
            const replyVotes = reply.voteCount
              ? Object.values(reply.voteCount).reduce((sum, count) => sum + count, 0)
              : 0;
            const isReplyAuthor = isConnected && reply.author.id === currentUserId;

            return (
              <div key={replyId} className="w-full flex py-2 md:px-5 px-3 font-bold">
                <div className="shrink-0">
                  {reply.author.profilThumbImageUrl ? (
                    <img
                      src={reply.author.profilThumbImageUrl}
                      alt={reply.author.name}
                      className="block md:size-10 size-7 object-cover rounded-full"
                    />
                  ) : (
                    <div className="md:size-10 size-7 rounded-full bg-linear-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                      {reply.author.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="ml-3 grow">
                  <div className="inline-block w-full p-2.5 rounded-xl bg-muted relative group">
                    <div className="flex justify-between items-start">
                      <h1 className="text-foreground text-xs font-semibold">
                        {reply.author.name}
                      </h1>
                      {isReplyAuthor && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="ml-2 p-0.5 hover:bg-background/50 rounded transition-colors opacity-0 group-hover:opacity-100">
                              <MoreVertical className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => onEdit(replyId)}>
                              <Edit className="mr-2 h-3 w-3" />
                              <span className="text-xs">{t("NewsTab.edit")}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDelete(replyId)}
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
                      {formatCommentDate(reply.created)}
                    </p>
                    <div className="flex divide-x-2 divide-border">
                      <button
                        disabled={!isConnected}
                        className="bg-background text-[9px] text-muted-foreground px-2 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {replyVotes > 0 && <span className="mr-1">{replyVotes}</span>}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
