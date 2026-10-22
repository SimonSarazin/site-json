import type { MouseEvent } from "react";
import { Heart, MapPin, MapPinOff, MessageCircle } from "lucide-react";
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
  /** Vue split : focalise le marqueur de cette réponse sur la carte. Absent =
   *  pas de carte à côté (vue annuaire) ou réponse non localisée. */
  onLocate?: () => void;
  /** Vue split : la réponse n'a pas d'adresse → pas de marqueur. Signalé
   *  explicitement, sinon un clic sans effet passerait pour un bug. */
  showNoLocation?: boolean;
  /** Ouvre le détail de la réponse. Absent = carte non cliquable. */
  onOpenDetails?: () => void;
  /** Nombre de réactions à afficher — piloté par la section (bascule optimiste
   *  incluse, cf. `useMeeteemReactions`). Absent = compte figé lu dans
   *  `serverData.vote`. */
  reactionCount?: number;
  /** L'utilisateur courant a-t-il réagi ? (cœur plein + `aria-pressed`) */
  hasReacted?: boolean;
  /** Aller-retour serveur en cours pour cette réaction. */
  reactionPending?: boolean;
  /** Bascule ajout/retrait de la réaction. Absent = compteur non cliquable. */
  onToggleReaction?: () => void;
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
  onLocate,
  showNoLocation,
  onOpenDetails,
  reactionCount,
  hasReacted,
  reactionPending,
  onToggleReaction,
}: MeeteemCardProps) {
  const t = useT("modules/ampli");
  const { answer, data, user } = card;
  const isCompact = variant === "compact";
  const fallbackUser = String(t("MeeteemSection.card.noUser"));
  const fallbackDate = String(t("MeeteemSection.card.noDate"));
  // Sans pilotage par la section (fixtures de test, rendu sans interaction), on
  // retombe sur le compte serveur — l'affichage reste correct, juste figé.
  const reactions =
    reactionCount ?? (answer.serverData.vote ? Object.keys(answer.serverData.vote).length : 0);
  const reactionLabel = String(
    t(hasReacted ? "MeeteemSection.card.unreact" : "MeeteemSection.card.react"),
  );

  // Les boutons internes (tag, auteur, localiser) vivent DANS la zone
  // cliquable : sans cette garde, un clic sur un tag ouvrirait aussi le détail.
  const openFromCard = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    onOpenDetails?.();
  };

  return (
    // PAS de `role="button"` sur la racine : ARIA rendrait présentationnels tous
    // ses enfants et son `aria-label` remplacerait le contenu lu — tags, auteur
    // et réaction disparaîtraient du lecteur d'écran et du clavier. Le clic sur
    // toute la carte reste un confort souris ; l'accès au détail passe par le
    // TITRE, un vrai bouton étiré (même patron que la carte de `/ampli`).
    <div
      onClick={onOpenDetails ? openFromCard : undefined}
      className={cn(
        "relative rounded-xl border border-border shadow-md overflow-hidden hover:shadow-lg",
        onOpenDetails && "focus-within:ring-2 focus-within:ring-ring",
        onOpenDetails && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "border-l-4 border-l-primary/75",
        isCompact ? "flex items-center p-4" : "flex flex-col items-start p-4 opacity-0",
        !isCompact && "animate-[cardSlideIn_0.6s_cubic-bezier(0.4,0,0.2,1)_forwards]",
        // Sans slide-in, la carte doit rester visible malgré `opacity-0`.
        !isCompact && "motion-reduce:animate-none motion-reduce:opacity-100",
      )}
      style={!isCompact && animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      {/* `min-w-0` : sans lui, les noms longs poussent les stats hors de la carte. */}
      <div className={cn("min-w-0", isCompact ? "flex-1" : "w-full")}>
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
                  // `relative z-10` : au-dessus du bouton étiré du titre.
                  "relative z-10 h-auto rounded-full text-xs font-medium border transition-colors",
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

        {/* Titre — porte l'ouverture du détail (bouton étiré sur la carte) */}
        {(() => {
          const titre = onOpenDetails ? (
            <button
              type="button"
              onClick={onOpenDetails}
              aria-label={String(t("MeeteemSection.card.open", undefined, { name: data.name ?? "" }))}
              className="text-left outline-none after:absolute after:inset-0 after:content-[''] hover:text-primary"
            >
              {data.name}
            </button>
          ) : (
            data.name
          );
          return isCompact ? (
            <h4 className="text-sm font-semibold text-foreground m-0 mb-1 wrap-break-word">{titre}</h4>
          ) : (
            <h3 className="text-base font-semibold text-foreground m-0 mb-1 leading-snug wrap-break-word transition-colors border-b border-border pb-2">
              {titre}
            </h3>
          );
        })()}

        {/* Description */}
        <p className={cn(
          "text-foreground m-0 line-clamp-2 wrap-break-word",
          isCompact ? "text-xs" : "text-sm leading-relaxed pr-4",
        )}>
          {data.description}
        </p>

        {/* Footer : auteur + stats */}
        <div className={cn(
          "flex items-center w-full justify-between flex-wrap",
          isCompact ? "gap-2 mt-3" : "gap-2 pt-3",
        )}>
          {/* Auteur */}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onSelectUser(user?.name || "")}
            aria-label={String(t("a11y.selectUser", undefined, { name: user?.name || fallbackUser }))}
            className="relative z-10 h-auto min-w-0 max-w-full justify-start gap-2 rounded-lg p-1 hover:bg-primary/10 text-left"
          >
            <div className={cn(
              "rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold",
              isCompact ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-sm",
            )}>
              {user?.initial}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className={cn("font-semibold text-foreground truncate", isCompact ? "text-sm" : "text-xs")}>
                {user?.name || fallbackUser}
              </span>
              <span className={cn("text-muted-foreground", isCompact ? "text-[11px]" : "text-[11px]")}>
                {answer.serverData.created?.toLocaleDateString() ?? fallbackDate}
              </span>
            </div>
          </Button>

          {/* Stats */}
          <div className="flex items-center gap-2">
            {/* Vue split : pointer la réponse sur la carte, ou dire pourquoi
                c'est impossible (adresse absente) plutôt que rester muet. */}
            {onLocate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onLocate}
                aria-label={String(t("MeeteemSection.card.locate"))}
                title={String(t("MeeteemSection.card.locate"))}
                className="relative z-10 h-auto rounded-xl border border-primary px-2 py-1 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <MapPin className="w-3.5 h-3.5" />
              </Button>
            )}
            {showNoLocation && (
              <span
                title={String(t("MeeteemSection.card.noLocation"))}
                className="flex items-center rounded-xl border border-border px-2 py-1 text-muted-foreground"
              >
                <MapPinOff className="w-3.5 h-3.5" />
                <span className="sr-only">{String(t("MeeteemSection.card.noLocation"))}</span>
              </span>
            )}
            {/* Réaction : UNE seule action pour ajouter ET retirer — le backend
                bascule (cf. `useMeeteemReactions`). Sans handler, le compteur
                reste un simple affichage. */}
            {onToggleReaction ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onToggleReaction}
                disabled={reactionPending}
                aria-pressed={Boolean(hasReacted)}
                aria-label={reactionLabel}
                title={reactionLabel}
                className={cn(
                  // `relative z-10` : au-dessus du bouton étiré du titre.
                  "relative z-10 h-auto flex items-center gap-1 rounded-xl px-2 py-1 border border-destructive text-destructive",
                  "hover:-translate-y-0.5 hover:shadow-sm hover:bg-destructive/10 hover:text-destructive transition-all",
                  // `disabled` ne doit pas faire disparaître la carte du regard :
                  // on garde le contraste, on retire juste l'interactivité.
                  "disabled:opacity-100 disabled:pointer-events-none",
                  isCompact ? "text-[12px]" : "text-xs",
                )}
              >
                <Heart className={cn("w-3.5 h-3.5", hasReacted && "fill-current")} />
                <span>{reactions}</span>
              </Button>
            ) : (
              <div className={cn(
                "flex items-center gap-1 rounded-xl px-2 py-1 border border-destructive text-destructive hover:-translate-y-0.5 hover:shadow-sm transition-all",
                isCompact ? "text-[12px]" : "text-xs",
              )}>
                <Heart className="w-3.5 h-3.5" />
                <span>{reactions}</span>
              </div>
            )}
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
