import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { voteTypeMap } from "../constants/voteTypes";

export interface ReactionPillsProps {
  readonly reactions: Readonly<Record<string, number>>;
  /** La réaction de l'utilisateur courant, mise en avant. */
  readonly myReaction: string | null;
  readonly canReact: boolean;
  readonly onToggle?: (reaction: string) => void;
  /** Ouvre la liste des votants (J6). */
  readonly onShowVoters?: () => void;
  /** −1 hors du message actif : les pastilles suivent le roving tabindex du fil. */
  readonly tabIndex?: number;
}

/**
 * Pastilles de réaction sous un message.
 *
 * Deux garde-fous de thème, tirés de l'expérience Transiter :
 *   - la pastille est ronde par identité, donc `rounded-full` : sur les quatre sites où
 *     `theme.borderRadius` n'est pas défini, `--radius` est indéfini et `rounded-md` rendrait
 *     un rectangle ;
 *   - le FOND reste en jetons (`bg-muted` / `bg-primary/12`) et seule l'icône porte la couleur
 *     d'émotion, sans quoi la palette des huit réactions écraserait le thème du site.
 */
export function ReactionPills({
  reactions,
  myReaction,
  canReact,
  onToggle,
  onShowVoters,
  tabIndex = 0,
}: ReactionPillsProps) {
  const t = useT("modules/comment");
  const entries = Object.entries(reactions).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1" data-comment-reactions="">
      {entries.map(([reaction, count]) => {
        const meta = voteTypeMap[reaction];
        const Icon = meta?.icon;
        const mine = myReaction === reaction;
        const label = meta?.label ? String(t(meta.label)) : reaction;

        return (
          <button
            key={reaction}
            type="button"
            disabled={!canReact}
            tabIndex={tabIndex}
            data-reaction={reaction}
            data-mine={mine || undefined}
            onClick={() => onToggle?.(reaction)}
            onContextMenu={onShowVoters ? e => { e.preventDefault(); onShowVoters(); } : undefined}
            aria-pressed={mine}
            aria-label={String(t("a11y.reactionCount", undefined, { reaction: label, count }))}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              "transition-colors disabled:cursor-default",
              // Même anneau que les listes du panneau : l'anneau par défaut du navigateur
              // varie d'un moteur à l'autre, et se perd sur le fond `bg-muted` d'une pastille.
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              mine
                ? "bg-primary/12 text-foreground ring-1 ring-primary/40"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {Icon ? <Icon className={cn("size-3.5 shrink-0", meta?.iconClass)} aria-hidden /> : null}
            <span className="tabular-nums">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
