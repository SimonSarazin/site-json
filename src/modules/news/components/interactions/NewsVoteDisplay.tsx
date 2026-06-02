import { useState, useMemo } from "react";
import { NewsReactionsModal } from "./NewsReactionsModal";
import { useT } from "@/hooks/useT";
import { voteTypes } from "../../constants/voteTypes";

interface NewsVoteDisplayProps {
  voteCount: Record<string, number>;
  newsId: string | null;
}

export function NewsVoteDisplay({ voteCount, newsId }: NewsVoteDisplayProps) {
  const t = useT("modules/news");
  const [showModal, setShowModal] = useState(false);

  const totalVotes = useMemo(
    () => Object.values(voteCount).reduce((sum, count) => sum + count, 0),
    [voteCount]
  );

  if (totalVotes === 0) return null;

  return (
    <>
      <div className="px-6 pb-3">
        <div className="flex items-center gap-2 text-sm">
          <div className="flex -space-x-1 hover:space-x-1 transition-all duration-300">
            {voteTypes
              .filter(vote => voteCount[vote.type] > 0)
              .slice(0, 3)
              .map((vote) => {
                const Icon = vote.icon;
                return (
                  <div
                    key={vote.type}
                    className={`w-7 h-7 rounded-full ${vote.bgClass} border-2 border-background flex items-center justify-center cursor-pointer hover:scale-125 hover:z-10 transition-all duration-200`}
                    title={`${t(`reactionsTypes.${vote.type}`)} (${voteCount[vote.type]})`}
                  >
                    <Icon className={`w-4 h-4 ${vote.iconClass}`} />
                  </div>
                );
              })}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="text-muted-foreground hover:underline"
          >
            {totalVotes} {t(totalVotes > 1 ? "reactions.reactions_plural" : "reactions.reactions")}
          </button>
        </div>
      </div>

      <NewsReactionsModal
        open={showModal}
        onOpenChange={setShowModal}
        voteCount={voteCount}
        newsId={newsId}
      />
    </>
  );
}