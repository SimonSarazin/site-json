import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps {
  /** Taille en classes Tailwind ("h-4 w-4" par défaut). */
  className?: string;
  /** Label accessible (lu par les screen readers). Défaut : "Chargement". */
  label?: string;
}

/**
 * Spinner accessible — wrapper autour de `<Loader2>` de lucide-react avec
 * les attributs ARIA standards (`role="status"` + label `sr-only`).
 *
 * Remplace les 4+ implémentations divergentes du module (SVG inline,
 * `<div className="animate-spin">`, etc.) par un composant unique.
 *
 * @example
 * <Spinner />                                      // taille par défaut
 * <Spinner className="h-8 w-8" label="Envoi..." /> // taille + label custom
 */
export function Spinner({ className, label = "Chargement" }: SpinnerProps) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 aria-hidden="true" className={cn("h-4 w-4 animate-spin", className)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
