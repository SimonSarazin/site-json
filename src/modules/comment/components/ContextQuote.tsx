import { CornerUpRight } from "lucide-react";
import { useT } from "@/hooks/useT";

export interface ContextQuoteProps {
  readonly author: string;
  readonly excerpt: string;
  /** Remonte au message cité et l'illumine brièvement. */
  readonly onJump?: () => void;
  /** −1 hors du message actif : la citation suit le roving tabindex du fil. */
  readonly tabIndex?: number;
}

/**
 * Ligne de contexte citant le message parent.
 *
 * C'est l'affordance qui **remplace le retrait** au-delà de la profondeur visuelle maximale :
 * la donnée reste un arbre illimité, mais l'écran cesse d'indenter et affiche d'où vient la
 * réponse. Sans elle, une discussion profonde finirait collée au bord droit sur mobile.
 */
export function ContextQuote({ author, excerpt, onJump, tabIndex = 0 }: ContextQuoteProps) {
  const t = useT("modules/comment");

  return (
    <button
      type="button"
      onClick={onJump}
      disabled={!onJump}
      tabIndex={tabIndex}
      data-comment-context=""
      aria-label={String(t("thread.inReplyTo", undefined, { author }))}
      className="group/quote flex w-full items-center gap-1.5 truncate rounded-sm pb-0.5 text-left text-xs text-muted-foreground
                 hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none
                 disabled:cursor-default disabled:hover:text-muted-foreground"
    >
      <CornerUpRight className="size-3 shrink-0 opacity-70" aria-hidden />
      <span className="font-medium">{author}</span>
      {/* `truncate` suffit ici : le texte est déjà tronqué à la source par `flattenThread`,
          cette coupe n'est qu'un garde-fou de largeur. */}
      <span className="truncate opacity-80">{excerpt}</span>
    </button>
  );
}
