import { useState, useMemo } from "react";
import { NewsReactionsModal } from "./NewsReactionsModal";
import { useT } from "@/hooks/useT";
import { voteTypes } from "../constants";

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

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      red: { bg: "bg-red-100 dark:bg-red-900/20", text: "text-red-500", border: "border-red-200 dark:border-red-800" },
      blue: { bg: "bg-blue-100 dark:bg-blue-900/20", text: "text-blue-500", border: "border-blue-200 dark:border-blue-800" },
      green: { bg: "bg-green-100 dark:bg-green-900/20", text: "text-green-500", border: "border-green-200 dark:border-green-800" },
      teal: { bg: "bg-teal-100 dark:bg-teal-900/20", text: "text-teal-500", border: "border-teal-200 dark:border-teal-800" },
      yellow: { bg: "bg-yellow-100 dark:bg-yellow-900/20", text: "text-yellow-500", border: "border-yellow-200 dark:border-yellow-800" },
      gray: { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-500 dark:text-gray-400", border: "border-gray-200 dark:border-gray-600" },
      purple: { bg: "bg-purple-100 dark:bg-purple-900/20", text: "text-purple-500", border: "border-purple-200 dark:border-purple-800" },
      indigo: { bg: "bg-indigo-100 dark:bg-indigo-900/20", text: "text-indigo-500", border: "border-indigo-200 dark:border-indigo-800" },
    };
    return colorMap[color] || colorMap.gray;
  };

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
                const colors = getColorClasses(vote.color);
                return (
                  <div
                    key={vote.type}
                    className={`w-7 h-7 rounded-full ${colors.bg} border-2 border-background flex items-center justify-center cursor-pointer hover:scale-125 hover:z-10 transition-all duration-200`}
                    title={`${t(`reactionsTypes.${vote.type}`)} (${voteCount[vote.type]})`}
                  >
                    <Icon className={`w-4 h-4 ${colors.text}`} />
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