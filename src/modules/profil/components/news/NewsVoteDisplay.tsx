import { useState, useMemo } from "react";
import { NewsReactionsModal } from "./NewsReactionsModal";
import { useT } from "@/hooks/useT";
import { voteTypes } from "./constants";

interface NewsVoteDisplayProps {
  voteCount: Record<string, number>;
  newsId: string | null;
}

export function NewsVoteDisplay({ voteCount, newsId }: NewsVoteDisplayProps) {
  const t = useT("modules/profil");
  const [showModal, setShowModal] = useState(false);

  const totalVotes = useMemo(
    () => Object.values(voteCount).reduce((sum, count) => sum + count, 0),
    [voteCount]
  );

  if (totalVotes === 0) return null;

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      red: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20" },
      blue: { bg: "bg-info/10", text: "text-info", border: "border-info/20" },
      green: { bg: "bg-success/10", text: "text-success", border: "border-success/20" },
      teal: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
      yellow: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" },
      gray: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
      purple: { bg: "bg-chart-2/10", text: "text-chart-2", border: "border-chart-2/20" },
      indigo: { bg: "bg-chart-3/10", text: "text-chart-3", border: "border-chart-3/20" },
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
                    title={`${t(`NewsTab.reactionsTypes.${vote.type}`)} (${voteCount[vote.type]})`}
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
            {totalVotes} {t(totalVotes > 1 ? "NewsTab.reactions_plural" : "NewsTab.reactions")}
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
