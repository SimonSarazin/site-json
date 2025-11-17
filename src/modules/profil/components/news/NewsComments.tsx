import { useState } from "react";
import { Loader2, Send, SmilePlus, Flag } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useNewsComments } from "../../hooks/useNewsComments";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useLocalization } from "@/hooks/useLocalization";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";

interface NewsCommentsProps {
  newsId: string | null;
}

export function NewsComments({ newsId }: NewsCommentsProps) {
  const t = useT("modules/profil");
  const { currentLocale } = useLocalization();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const { data: commentsData, isLoading } = useNewsComments(newsId);

  const formatCommentDate = (timestamp: number) => {
    const locale = currentLocale === "fr" ? fr : enUS;
    return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true, locale });
  };

  const handleSubmitComment = () => {
    console.log("Submit comment:", commentText, "replyingTo:", replyingTo);
    setCommentText("");
    setReplyingTo(null);
  };

  const comments = commentsData ? Object.values(commentsData) : [];

  return (
    <div className="w-full bg-background rounded-b-xl">
      <div className="w-full flex px-5 py-5 md:px-5 md:py-5">
        <Avatar className="md:size-12 size-8 shrink-0">
          <AvatarFallback className="bg-linear-to-br from-teal-400 to-teal-600 text-white font-bold">
            U
          </AvatarFallback>
        </Avatar>
        <div className="relative md:pl-4 pl-2 w-full">
          <div className="flex items-center bg-muted rounded-xl shadow-sm p-1">
            <div className="relative w-full">
              <Textarea
                rows={1}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t("NewsTab.writeComment")}
                aria-label={t("NewsTab.writeComment")}
                className="bg-transparent no-scrollbar border-0 shadow-none font-normal md:pl-5 pl-2 md:px-4 px-0 py-2 md:text-sm text-xs focus-visible:ring-0 p-3 md:pr-4 pr-1 mt-1 min-h-0 h-auto rounded-xl resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && commentText.trim()) {
                    e.preventDefault();
                    handleSubmitComment();
                  }
                }}
              />
            </div>
            <div className="flex space-x-2 text-muted-foreground justify-center items-center mx-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!commentText.trim()}
                aria-label="Send comment"
                onClick={handleSubmitComment}
                className={`transition-colors mr-1 size-8 ${
                  commentText.trim()
                    ? 'text-blue-500 hover:text-blue-600'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
              >
                <SmilePlus className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>
      </div>

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
              const totalVotes = comment.voteCount
                ? Object.values(comment.voteCount).reduce((sum, count) => sum + count, 0)
                : 0;

              return (
                <div key={commentId}>
                  <div className="w-full flex py-4 md:px-5 px-3 font-bold">
                    <Avatar className="md:size-12 size-8 shrink-0">
                      {comment.author.profilThumbImageUrl ? (
                        <AvatarImage
                          src={comment.author.profilThumbImageUrl}
                          alt={comment.author.name}
                        />
                      ) : null}
                      <AvatarFallback className="bg-linear-to-br from-teal-400 to-teal-600 text-white font-bold text-xs">
                        {comment.author.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="ml-4 grow">
                      <div className="inline-block p-3 rounded-xl bg-muted">
                        <div className="flex justify-between -mt-1">
                          <h1 className="text-foreground md:text-sm text-xs font-semibold">
                            {comment.author.name}
                          </h1>
                        </div>
                        <p className="md:text-sm text-[11px] font-medium text-foreground mt-1 break-all leading-relaxed">
                          {comment.text}
                        </p>
                      </div>

                      <div className="flex flex-row md:space-x-5 space-x-1 items-center py-1">
                        <p className="text-muted-foreground md:text-xs text-[9px] text-center justify-start">
                          {formatCommentDate(comment.created)}
                        </p>
                        <div className="flex divide-x-2 divide-border">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="bg-background md:text-xs text-[9px] h-auto py-1 px-2 hover:bg-transparent"
                          >
                            {totalVotes > 0 && <span className="mr-1">{totalVotes}</span>}
                            {t("NewsTab.like")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReplyingTo(replyingTo === commentId ? null : commentId)}
                            className="bg-background md:text-xs text-[9px] h-auto py-1 px-2 hover:bg-transparent"
                          >
                            {t("NewsTab.reply")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Signaler un abus"
                            className="bg-background md:text-xs text-[9px] h-auto py-1 px-2 hover:bg-transparent"
                          >
                            <Flag className="w-3 h-3 inline" />
                          </Button>
                        </div>
                      </div>

                      {replyingTo === commentId && (
                        <div className="mt-3 w-full flex">
                          <Avatar className="size-8 shrink-0">
                            <AvatarFallback className="bg-linear-to-br from-teal-400 to-teal-600 text-white text-xs font-bold">
                              U
                            </AvatarFallback>
                          </Avatar>
                          <div className="relative pl-2 w-full">
                            <div className="flex items-center bg-muted rounded-xl shadow-sm p-1">
                              <Textarea
                                rows={1}
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder={t("NewsTab.writeReply")}
                                className="bg-transparent border-0 shadow-none font-normal pl-3 px-2 py-2 text-xs focus-visible:ring-0 min-h-0 h-auto rounded-xl resize-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey && commentText.trim()) {
                                    e.preventDefault();
                                    handleSubmitComment();
                                  }
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleSubmitComment}
                                disabled={!commentText.trim()}
                                className={`mx-2 size-6 ${
                                  commentText.trim() ? 'text-blue-500 hover:text-blue-600' : 'opacity-50'
                                }`}
                              >
                                <Send className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
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

                            <div className="ml-3 flex-grow">
                              <div className="inline-block p-2.5 rounded-xl bg-muted">
                                <h1 className="text-foreground text-xs font-semibold">
                                  {reply.author.name}
                                </h1>
                                <p className="text-xs font-medium text-foreground mt-1 break-all leading-relaxed">
                                  {reply.text}
                                </p>
                              </div>

                              <div className="flex flex-row md:space-x-5 space-x-1 items-center py-1">
                                <p className="text-muted-foreground text-[9px]">
                                  {formatCommentDate(reply.created)}
                                </p>
                                <div className="flex divide-x-2 divide-border">
                                  <button className="bg-background text-[9px] text-muted-foreground px-2 hover:text-foreground">
                                    {replyVotes > 0 && <span className="mr-1">{replyVotes}</span>}
                                    {t("NewsTab.like")}
                                  </button>
                                  <button
                                    aria-label="Signaler un abus"
                                    className="bg-background text-[9px] text-muted-foreground px-2 hover:text-foreground"
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}
