import { Check, Clock } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { cn } from "@/lib/utils";

/**
 * Statut de publication d'un commun dans l'annuaire de CET appel — lisible par TOUS, admin
 * compris : le bouton de l'admin ne remplace plus la pastille, il s'ajoute à côté
 * (`CommunActionBar`). L'écriture elle-même vit dans `useCommunSelectionAction`.
 *
 * Forme reprise de la pilule d'`AacCommunRow` (mêmes tokens `accent`) pour que « En attente » se
 * lise pareil dans l'annuaire et sur la fiche.
 *
 * `null` ⇒ rien : on ne sait pas sous quelle clé regarder (pas de question `choose` résolue, ou
 * pas de contexte), et afficher un statut serait une affirmation sans fondement. Une réponse
 * dépourvue d'étape d'évaluation, elle, vaut « En attente » — cf. `parseAacAnswer`.
 */
export function CommunSelectionBadge({
  isSelected,
  className,
}: {
  isSelected: boolean | null;
  className?: string;
}) {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");

  if (isSelected === null) return null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        // Aplat plein et non `bg-primary/10 text-primary` : à 11 px on est hors du seuil « grand
        // texte », et sur le thème du site AAC ce couple tombe à 4.04:1 — sous les 4.5:1 de
        // WCAG 1.4.3 AA. La paire `primary`/`primary-foreground` est garantie par construction
        // des tokens, contrairement à une teinte à 10 % d'opacité.
        isSelected
          ? "bg-primary text-primary-foreground"
          : "bg-accent/80 text-accent-foreground",
        className
      )}
    >
      {isSelected ? <Check className="size-3" /> : <Clock className="size-3" />}
      {String(t(isSelected ? "detail.selection.selected" : "detail.selection.pending"))}
    </span>
  );
}
