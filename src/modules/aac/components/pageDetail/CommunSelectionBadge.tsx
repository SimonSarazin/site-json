import { Check, Clock } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { StatusPill } from "../StatusPill";

/**
 * Statut de publication d'un commun dans l'annuaire de CET appel — lisible par TOUS, admin
 * compris : le bouton de l'admin ne remplace plus la pastille, il s'ajoute à côté
 * (`CommunActionBar`). L'écriture elle-même vit dans `useCommunSelectionAction`.
 *
 * Même pastille que la ligne de l'annuaire (`StatusPill`) : « En attente » se lit pareil dans
 * l'annuaire et sur la fiche.
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
    <StatusPill tone={isSelected ? "primary" : "accent"} className={className}>
      {isSelected ? <Check className="size-3" /> : <Clock className="size-3" />}
      {String(t(isSelected ? "detail.selection.selected" : "detail.selection.pending"))}
    </StatusPill>
  );
}
