import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { Heart, ThumbsUp, Smile, Laugh, Angry, Frown, HandMetal } from "lucide-react";
import { Frown as Scared } from "lucide-react";
import { useT } from "@/hooks/useT";

const voteTypes = [
  { type: "love", color: "red", icon: Heart, label: "reactionsTypes.love" },
  { type: "like", color: "blue", icon: ThumbsUp, label: "reactionsTypes.like" },
  { type: "enjoy", color: "green", icon: Smile, label: "reactionsTypes.enjoy" },
  { type: "glad", color: "teal", icon: Laugh, label: "reactionsTypes.glad" },
  { type: "bothered", color: "yellow", icon: Angry, label: "reactionsTypes.bothered" },
  { type: "sad", color: "gray", icon: Frown, label: "reactionsTypes.sad" },
  { type: "scared", color: "purple", icon: Scared, label: "reactionsTypes.scared" },
  { type: "support", color: "indigo", icon: HandMetal, label: "reactionsTypes.support" },
];

interface NewsReactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voteCount: Record<string, number>;
}

export function NewsReactionsModal({ open, onOpenChange, voteCount }: NewsReactionsModalProps) {
  const t = useT("modules/profil");

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

  const totalVotes = Object.values(voteCount).reduce((sum, count) => sum + count, 0);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <ModalHeader>
          <ModalTitle>{t("NewsTab.allReactions")} ({totalVotes})</ModalTitle>
        </ModalHeader>

        <div className="space-y-4 mt-4">
          {voteTypes.map((vote) => {
            const count = voteCount[vote.type] || 0;
            if (count === 0) return null;

            const Icon = vote.icon;
            const colors = getColorClasses(vote.color);

            return (
              <div key={vote.type} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <span className="font-medium">{t(`NewsTab.${vote.label}`)}</span>
                </div>
                <span className="text-lg font-bold text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            {t("NewsTab.reactorsList")}
          </p>
        </div>
      </ModalContent>
    </Modal>
  );
}
