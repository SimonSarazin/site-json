import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";

/**
 * Bouton de suppression d'un commun dans l'annuaire, carte et ligne — parité du geste legacy
 * `.commun-delete-btn` (`federationDesCae_index.js:479-484`).
 *
 * Sans état ni mutation : il ne fait que demander. La confirmation et la suppression vivent une
 * seule fois dans `AacDirectorySection`, pour que trente cartes n'installent pas trente dialogues
 * et qu'une suppression en cours ne soit pas rattachée à une carte qui va disparaître.
 */
export interface AacCommunDeleteButtonProps {
  /** Titre du commun — nomme l'action pour les lecteurs d'écran. */
  communTitle: string;
  onClick: () => void;
  /** Une suppression est en vol : on n'en accepte pas une seconde. */
  disabled?: boolean;
  className?: string;
}

export function AacCommunDeleteButton({
  communTitle,
  onClick,
  disabled,
  className,
}: AacCommunDeleteButtonProps) {
  const t = useT("modules/aac");

  return (
    <button
      type="button"
      // Le libellé accessible nomme le commun : dans une liste, « Supprimer » répété
      // trente fois ne dit pas ce qu'on supprime.
      aria-label={String(t("directory.card.deleteAria", undefined, { title: communTitle }))}
      title={String(t("delete.cta"))}
      onClick={(e) => {
        // La carte entière est un lien : sans ça, demander la suppression navigue
        // aussi vers le commun qu'on veut supprimer.
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full",
        // Fond plein et non transparent : le bouton est posé sur une image dont
        // on ne connaît ni la couleur ni le contraste.
        "bg-card/90 text-destructive shadow-sm ring-1 ring-destructive/30 backdrop-blur-[2px]",
        "transition-colors hover:bg-destructive hover:text-white hover:ring-destructive",
        "focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
