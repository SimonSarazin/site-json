import { Heart, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { Button } from "@/components/ui/button";
import type { MeeteemCard as MeeteemCardType } from "../../../types";

interface MeeteemCardProps {
  card: MeeteemCardType;
  activeFilters: string[];
  onToggleFilter: (tag: string) => void;
  onSelectUser: (userName: string) => void;
  /** Variante d'affichage : `large` (vue annuaire) ou `compact` (vue split). */
  variant?: "large" | "compact";
  /** Délai d'animation (ms) — utilisé en vue large pour le slide-in séquentiel. */
  animationDelay?: number;
}

/**
 * Carte d'une réponse Cocolight côté Meeteem.
 * Factorise les variantes `large` (vue annuaire — header + content + footer) et
 * `compact` (vue split — single row). Utilise tokens sémantiques pour le mode sombre.
 */
export function MeeteemCard({
  card,
  activeFilters,
  onToggleFilter,
  onSelectUser,
  variant = "large",
  animationDelay,
}: MeeteemCardProps) {
  const t = useT("modules/ampli");
  const { answer, data, user } = card;
  const isCompact = variant === "compact";
  const fallbackUser = String(t("MeeteemSection.card.noUser"));
  const fallbackDate = String(t("MeeteemSection.card.noDate"));

  return (
    <div
      className={cn(
        "rounded-xl border border-border shadow-md overflow-hidden hover:shadow-lg",
        "border-l-4 border-l-primary/75",
        isCompact ? "flex items-center p-4" : "flex flex-col items-start p-4 opacity-0",
        !isCompact && "animate-[cardSlideIn_0.6s_cubic-bezier(0.4,0,0.2,1)_forwards]",
      )}
      style={!isCompact && animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      <div className={isCompact ? "flex-1" : "w-full"}>
        {/* Tags */}
        <div className="flex gap-2 mb-2 flex-wrap">
          {data.tags?.map((tag) => {
            const active = activeFilters.includes(tag);
            return (
              <Button
                key={tag}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onToggleFilter(tag)}
                aria-pressed={active}
                aria-label={String(t("a11y.toggleTag", undefined, { tag }))}
                className={cn(
                  "h-auto rounded-full text-xs font-medium border transition-colors",
                  isCompact ? "px-2 py-1" : "px-3 py-1",
                  active
                    ? "bg-primary text-primary-foreground border-primary hover:bg-primary"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted",
                )}
              >
                {tag}
              </Button>
            );
          })}
        </div>

        {/* Titre */}
        {isCompact ? (
          <h4 className="text-sm font-semibold text-foreground m-0 mb-1 cursor-pointer hover:text-primary">
            {data.name}
          </h4>
        ) : (
          <h3 className="text-base font-semibold text-foreground m-0 mb-1 leading-snug cursor-pointer hover:text-primary transition-colors border-b border-border pb-2">
            {data.name}
          </h3>
        )}

        {/* Description */}
        <p className={cn(
          "text-foreground m-0 line-clamp-2",
          isCompact ? "text-xs" : "text-sm leading-relaxed pr-4",
        )}>
          {data.description}
        </p>

        {/* Footer : auteur + stats */}
        <div className={cn(
          "flex items-center w-full justify-between",
          isCompact ? "gap-3 mt-3" : "gap-4 pt-3",
        )}>
          {/* Auteur */}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onSelectUser(user?.name || "")}
            aria-label={String(t("a11y.selectUser", undefined, { name: user?.name || fallbackUser }))}
            className="h-auto justify-start gap-2 rounded-lg p-1 hover:bg-primary/10 text-left"
          >
            <div className={cn(
              "rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold",
              isCompact ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-sm",
            )}>
              {user?.initial}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className={cn("font-semibold text-foreground", isCompact ? "text-sm" : "text-xs")}>
                {user?.name || fallbackUser}
              </span>
              <span className={cn("text-muted-foreground", isCompact ? "text-[11px]" : "text-[11px]")}>
                {answer.serverData.created?.toLocaleDateString() ?? fallbackDate}
              </span>
            </div>
          </Button>

          {/* Stats */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1 rounded-xl px-2 py-1 border border-destructive text-destructive hover:-translate-y-0.5 hover:shadow-sm transition-all",
              isCompact ? "text-[12px]" : "text-xs",
            )}>
              <Heart className="w-3.5 h-3.5" />
              <span>{answer.serverData.vote ? Object.keys(answer.serverData.vote).length : 0}</span>
            </div>
            <div className={cn(
              "flex items-center gap-1 rounded-xl px-2 py-1 border text-primary border-primary hover:-translate-y-0.5 hover:shadow-sm transition-all",
              isCompact ? "text-[12px]" : "text-xs",
            )}>
              <MessageCircle className="w-3.5 h-3.5 text-primary" />
              <span>{answer.serverData.comments ? Object.keys(answer.serverData.comments).length : 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
