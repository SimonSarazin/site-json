import { useState, useMemo } from "react";
import { useT } from "@/hooks/useT";
import { voteTypes } from "./constants";
import { CommentReactionsModal } from "./CommentReactionsModal";

interface CommentVoteDisplayProps {
  voteCount: Record<string, number>;
  commentId: string;
}

export function CommentVoteDisplay({ voteCount, commentId }: CommentVoteDisplayProps) {
  const t = useT("modules/profil");
  const [showModal, setShowModal] = useState(false);

  const totalVotes = useMemo(
    () => {
      if (!voteCount || typeof voteCount !== 'object') return 0;
      return Object.values(voteCount).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0);
    },
    [voteCount]
  );

  if (totalVotes === 0 || !voteCount) return null;

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
      <div className="flex items-center gap-1.5 text-xs mt-1.5">
        <div className="flex -space-x-1 hover:space-x-0.5 transition-all duration-300">
          {voteTypes
            .filter(vote => voteCount[vote.type] > 0)
            .slice(0, 3)
            .map((vote) => {
              const Icon = vote.icon;
              const colors = getColorClasses(vote.color);
              return (
                <div
                  key={vote.type}
                  className={`w-5 h-5 rounded-full ${colors.bg} border-2 border-background flex items-center justify-center hover:scale-110 hover:z-10 transition-all duration-200`}
                  title={`${t(`NewsTab.reactionsTypes.${vote.type}`)} (${voteCount[vote.type]})`}
                >
                  <Icon className={`w-3 h-3 ${colors.text}`} />
                </div>
              );
            })}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="text-muted-foreground hover:underline text-[10px] cursor-pointer"
        >
          {totalVotes}
        </button>
      </div>

      <CommentReactionsModal
        open={showModal}
        onOpenChange={setShowModal}
        voteCount={voteCount}
        commentId={commentId}
      />
    </>
  );
}
