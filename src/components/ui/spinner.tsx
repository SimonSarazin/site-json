import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerBaseProps {
  /** Taille en classes Tailwind ("h-4 w-4" par défaut). */
  className?: string;
}

type SpinnerProps = SpinnerBaseProps &
  (
    | {
        /** Label accessible (lu par les screen readers). Défaut : "Chargement". */
        label?: string;
        showLabel?: false;
      }
    | {
        /** Label AFFICHÉ : à fournir traduit — le défaut, écrit en français, n'est pas fait pour l'écran. */
        label: string;
        /** Affiche le label à côté de l'icône, au lieu de le réserver aux lecteurs d'écran. */
        showLabel: true;
      }
  );

/**
 * Spinner accessible — wrapper autour de `<Loader2>` de lucide-react avec
 * les attributs ARIA standards (`role="status"` + label `sr-only`, ou affiché avec `showLabel`).
 *
 * Remplace les 4+ implémentations divergentes du module (SVG inline,
 * `<div className="animate-spin">`, etc.) par un composant unique.
 *
 * @example
 * <Spinner />                                      // taille par défaut
 * <Spinner className="h-8 w-8" label="Envoi..." /> // taille + label custom
 * <Spinner showLabel label="Recherche en cours…" /> // label affiché : un seul texte, une seule annonce
 */
export function Spinner({ className, label = "Chargement", showLabel = false }: SpinnerProps) {
  return (
    <span role="status" className={cn("inline-flex items-center", showLabel && "gap-2")}>
      <Loader2 aria-hidden="true" className={cn("h-4 w-4 animate-spin", className)} />
      <span className={showLabel ? undefined : "sr-only"}>{label}</span>
    </span>
  );
}
