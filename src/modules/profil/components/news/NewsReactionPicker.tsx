import { Heart, ThumbsUp, Smile, Laugh, Angry, Frown, HandMetal } from "lucide-react";
import { Frown as Scared } from "lucide-react";

const voteTypes = [
  { type: "love", color: "red", icon: Heart, label: "J'adore", bgHover: "hover:bg-red-50 dark:hover:bg-red-900/20" },
  { type: "like", color: "blue", icon: ThumbsUp, label: "J'aime", bgHover: "hover:bg-blue-50 dark:hover:bg-blue-900/20" },
  { type: "enjoy", color: "green", icon: Smile, label: "Content", bgHover: "hover:bg-green-50 dark:hover:bg-green-900/20" },
  { type: "glad", color: "teal", icon: Laugh, label: "Ravi", bgHover: "hover:bg-teal-50 dark:hover:bg-teal-900/20" },
  { type: "bothered", color: "yellow", icon: Angry, label: "Énervé", bgHover: "hover:bg-yellow-50 dark:hover:bg-yellow-900/20" },
  { type: "sad", color: "gray", icon: Frown, label: "Triste", bgHover: "hover:bg-gray-50 dark:hover:bg-gray-700" },
  { type: "scared", color: "purple", icon: Scared, label: "Inquiet", bgHover: "hover:bg-purple-50 dark:hover:bg-purple-900/20" },
  { type: "support", color: "indigo", icon: HandMetal, label: "Soutien", bgHover: "hover:bg-indigo-50 dark:hover:bg-indigo-900/20" },
];

interface NewsReactionPickerProps {
  onSelect: (type: string) => void;
}

export function NewsReactionPicker({ onSelect }: NewsReactionPickerProps) {
  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      red: "text-red-500",
      blue: "text-blue-500",
      green: "text-green-500",
      teal: "text-teal-500",
      yellow: "text-yellow-500",
      gray: "text-gray-500",
      purple: "text-purple-500",
      indigo: "text-indigo-500",
    };
    return colorMap[color] || "text-gray-500";
  };

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-background border border-border rounded-full shadow-2xl p-2 flex gap-1 animate-in fade-in zoom-in duration-200 z-50">
      {voteTypes.map((vote) => {
        const Icon = vote.icon;

        return (
          <button
            key={vote.type}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(vote.type);
            }}
            className={`p-2 rounded-full transition-all duration-200 hover:scale-125 ${vote.bgHover}`}
            title={vote.label}
          >
            <Icon className={`w-6 h-6 ${getColorClass(vote.color)}`} />
          </button>
        );
      })}
    </div>
  );
}
