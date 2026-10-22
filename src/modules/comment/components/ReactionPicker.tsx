import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { voteTypes } from "../constants/voteTypes";

export interface ReactionPickerProps {
  /** La réaction déjà posée par l'utilisateur, mise en avant. */
  readonly current: string | null;
  readonly onPick: (reaction: string) => void;
}

/**
 * Choix d'une réaction parmi les huit.
 *
 * Grille 4×2 **avec libellé** : les huit émotions du produit ne sont pas des émojis universels
 * (« Ravi » et « Content » se ressemblent trop en icônes seules), et une grille d'icônes muettes
 * obligerait à survoler chacune pour comprendre. Le libellé est aussi ce que lit un lecteur
 * d'écran.
 *
 * Le serveur applique un **vote unique** (mesuré) : choisir une réaction remplace la
 * précédente, et rechoisir la même la retire. La pastille déjà posée est donc marquée, pour
 * que « annuler » soit une action visible plutôt qu'un effet de bord surprenant.
 */
export function ReactionPicker({ current, onPick }: ReactionPickerProps) {
  const t = useT("modules/comment");

  return (
    <div className="grid grid-cols-4 gap-1 p-1" role="group" aria-label={String(t("reactions.add"))}>
      {voteTypes.map(vote => {
        const Icon = vote.icon;
        const mine = current === vote.type;
        const label = vote.label ? String(t(vote.label)) : vote.type;

        return (
          <button
            key={vote.type}
            type="button"
            data-reaction-choice={vote.type}
            aria-pressed={mine}
            onClick={() => onPick(vote.type)}
            className={cn(
              "flex w-16 flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] font-medium",
              "transition-colors hover:bg-accent",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              mine ? "bg-primary/12 ring-1 ring-primary/40" : "",
            )}
          >
            <Icon className={cn("size-5", vote.iconClass)} aria-hidden />
            <span className="w-full truncate text-center text-muted-foreground">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
