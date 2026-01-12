import { useT } from "@/hooks/useT";
import { voteTypes } from "./constants";

interface NewsReactionPickerProps {
  onSelect: (type: string) => void;
}

export function NewsReactionPicker({ onSelect }: NewsReactionPickerProps) {
  const t = useT("modules/profil");
  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      red: "text-destructive",
      blue: "text-info",
      green: "text-success",
      teal: "text-primary",
      yellow: "text-warning",
      gray: "text-muted-foreground",
      purple: "text-chart-2",
      indigo: "text-chart-3",
    };
    return colorMap[color] || "text-muted-foreground";
  };

  return (
    <div className="bg-background border border-border rounded-full shadow-2xl p-2 flex gap-1">
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
            title={t(`NewsTab.reactionsTypes.${vote.type}`)}
          >
            <Icon className={`w-6 h-6 ${getColorClass(vote.color)}`} />
          </button>
        );
      })}
    </div>
  );
}
