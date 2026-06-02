import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  /** Label pour l'a11y (souvent : "Vote pour la catégorie X, critère Y"). */
  ariaLabel?: string;
}

/**
 * Cellule de vote pour le tableau d'évaluation.
 *
 * Accessibilité : tous les modes sont clavier-navigables et annoncés au SR.
 *  - `colour` : `<button>` interne au `<td>` (pas onClick sur `<td>` qui n'est
 *    pas clavier-accessible) + `aria-pressed` pour l'état OK/vide
 *  - `emoji`/`star` : `<button aria-label aria-pressed>`
 *  - `note` : `<Select>` shadcn (Radix → ARIA correct par défaut)
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
  ariaLabel,
}: EvaluationVoteCellProps) {
  // Type "colour" - bouton interne au <td> pour clavier-accessibilité
  if (voteType === "colour") {
    const isOK = value === "OK";
    return (
      <td className="border border-border p-0">
        <button
          type="button"
          onClick={() => onChange(isOK ? "" : "OK")}
          disabled={disabled}
          aria-pressed={isOK}
          aria-label={ariaLabel ?? (isOK ? "Vote OK" : "Vote vide")}
          className={cn(
            "w-full h-10 min-w-15 text-center font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            disabled && "cursor-not-allowed opacity-50",
            isOK ? "text-white" : "hover:bg-muted/50 cursor-pointer"
          )}
          style={{
            backgroundColor: isOK ? colours.OK : undefined,
          }}
        >
          {isOK ? "O" : ""}
        </button>
      </td>
    );
  }

  // Type "emoji" - sélection d'un emoji
  if (voteType === "emoji") {
    return (
      <td className="text-center border border-border p-1">
        <div role="group" aria-label={ariaLabel} className="flex gap-1 justify-center flex-wrap">
          {emojis.map((emoji) => {
            const isSelected = value === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => !disabled && onChange(isSelected ? "" : emoji)}
                disabled={disabled}
                aria-pressed={isSelected}
                aria-label={`Vote ${emoji}`}
                className={cn(
                  "text-lg p-1 rounded hover:bg-muted/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected && "ring-2 ring-primary bg-primary/10",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            );
          })}
        </div>
      </td>
    );
  }

  // Type "note" - sélection d'une note (1 à noteMax) via Select shadcn
  if (voteType === "note") {
    const currentNote = typeof value === "number" ? value : null;
    return (
      <td className="text-center border border-border p-1">
        <Select
          value={currentNote != null ? String(currentNote) : ""}
          onValueChange={(v) => onChange(v ? Number(v) : "")}
          disabled={disabled}
        >
          <SelectTrigger
            aria-label={ariaLabel ?? "Note"}
            className="border-0 bg-transparent h-auto py-1 min-w-15 mx-auto"
          >
            <SelectValue placeholder="--" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: noteMax }, (_, i) => i + 1).map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
    );
  }

  // Type "star" - étoiles cliquables
  if (voteType === "star") {
    const currentStars = typeof value === "number" ? value : 0;
    return (
      <td className="text-center border border-border p-1">
        <div role="group" aria-label={ariaLabel ?? `Note de 1 à ${starCount} étoiles`} className="flex gap-0.5 justify-center">
          {Array.from({ length: starCount }, (_, i) => i + 1).map((n) => {
            const isActive = n <= currentStars;
            return (
              <button
                key={n}
                type="button"
                onClick={() => !disabled && onChange(currentStars === n ? "" : n)}
                disabled={disabled}
                aria-pressed={currentStars === n}
                aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                className={cn(
                  "p-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <Star
                  aria-hidden="true"
                  className={cn(
                    "w-5 h-5",
                    isActive
                      ? "fill-warning text-warning"
                      : "text-muted-foreground hover:text-warning"
                  )}
                />
              </button>
            );
          })}
        </div>
      </td>
    );
  }

  // Fallback
  return <td className="border border-border">-</td>;
}
