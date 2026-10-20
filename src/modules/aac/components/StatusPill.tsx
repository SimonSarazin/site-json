import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  // Aplat plein et non `bg-primary/10 text-primary` : à 11 px on est hors du seuil « grand texte »,
  // et sur le thème du site AAC ce couple tombe à 4.04:1 — sous les 4.5:1 de WCAG 1.4.3 AA. La paire
  // `primary`/`primary-foreground` est garantie par construction des tokens, contrairement à une
  // teinte à 10 % d'opacité.
  primary: "bg-primary text-primary-foreground",
  accent: "bg-accent/80 text-accent-foreground",
} as const;

const SIZES = {
  /** Sur la fiche, à côté des boutons de la barre d'actions. */
  md: "px-2.5 py-1",
  /** Dans une ligne de l'annuaire, à côté du titre. */
  sm: "px-2 py-0.5",
} as const;

/**
 * Pastille de statut d'un commun. UNE forme pour l'annuaire (`AacCommunRow`) et pour la fiche
 * (`CommunSelectionBadge`, `CommunProjectBadge`) : « En attente » se lit pareil aux deux endroits.
 */
export function StatusPill({
  tone,
  size = "md",
  className,
  children,
}: {
  tone: keyof typeof TONES;
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap",
        SIZES[size],
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
