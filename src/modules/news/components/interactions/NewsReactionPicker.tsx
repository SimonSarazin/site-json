import { useT } from "@/hooks/useT";
import { voteTypes } from "../../constants/voteTypes";

interface NewsReactionPickerProps {
  onSelect: (type: string) => void;
}

export function NewsReactionPicker({ onSelect }: NewsReactionPickerProps) {
  const t = useT("modules/news");

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
            title={String(t(`reactionsTypes.${vote.type}`))}
            aria-label={String(t(`reactionsTypes.${vote.type}`))}
          >
            <Icon className={`w-6 h-6 ${vote.iconClass}`} />
          </button>
        );
      })}
    </div>
  );
}