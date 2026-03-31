import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import type { EvaluationVoteType, EvaluationVoteValue } from "../types";

interface EvaluationVoteCellProps {
  voteType: EvaluationVoteType;
  value: EvaluationVoteValue;
  onChange: (value: EvaluationVoteValue) => void;
  disabled?: boolean;
  /** Couleurs pour type "colour" */
  colours?: { OK: string; NotOK: string };
  /** Emojis disponibles pour type "emoji" */
  emojis?: string[];
  /** Valeur max pour type "note" */
  noteMax?: number;
  /** Nombre d'étoiles pour type "star" */
  starCount?: number;
}

/**
 * Cellule de vote pour le tableau d'évaluation
 * Supporte 4 types: colour, emoji, note, star
 */
export function EvaluationVoteCell({
  voteType,
  value,
  onChange,
  disabled = false,
  colours = { OK: "#9fbd38", NotOK: "#D7193B" },
  emojis = ["😀", "🙂", "😐", "🙁", "😢"],
  noteMax = 10,
  starCount = 5,
}: EvaluationVoteCellProps) {
  // Type "colour" - clic pour toggle OK/vide
  if (voteType === "colour") {
    const isOK = value === "OK";
    return (
      <td
        onClick={() => !disabled && onChange(isOK ? "" : "OK")}
        className={cn(
          "text-center font-bold cursor-pointer transition-colors min-w-15 h-10 border border-border",
          disabled && "cursor-not-allowed opacity-50",
          isOK ? "text-white" : "hover:bg-muted/50"
        )}
        style={{
          backgroundColor: isOK ? colours.OK : undefined,
        }}
      >
        {isOK ? "O" : ""}
      </td>
    );
  }

  // Type "emoji" - sélection d'un emoji
  if (voteType === "emoji") {
    return (
      <td className="text-center border border-border p-1">
        <div className="flex gap-1 justify-center flex-wrap">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => !disabled && onChange(value === emoji ? "" : emoji)}
              disabled={disabled}
              className={cn(
                "text-lg p-1 rounded hover:bg-muted/50 transition-colors",
                value === emoji && "ring-2 ring-primary bg-primary/10",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </td>
    );
  }

  // Type "note" - sélection d'une note (1 à noteMax)
  if (voteType === "note") {
    const currentNote = typeof value === "number" ? value : 0;
    return (
      <td className="text-center border border-border p-1">
        <select
          value={currentNote || ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v ? Number(v) : "");
          }}
          disabled={disabled}
          className={cn(
            "border-0 bg-transparent text-center cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary rounded px-2 py-1",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <option value="">--</option>
          {Array.from({ length: noteMax }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </td>
    );
  }

  // Type "star" - étoiles cliquables
  if (voteType === "star") {
    const currentStars = typeof value === "number" ? value : 0;
    return (
      <td className="text-center border border-border p-1">
        <div className="flex gap-0.5 justify-center">
          {Array.from({ length: starCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => !disabled && onChange(currentStars === n ? "" : n)}
              disabled={disabled}
              className={cn(
                "p-0.5 transition-colors",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              <Star
                className={cn(
                  "w-5 h-5",
                  n <= currentStars
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground hover:text-yellow-400"
                )}
              />
            </button>
          ))}
        </div>
      </td>
    );
  }

  // Fallback
  return <td className="border border-border">-</td>;
}
