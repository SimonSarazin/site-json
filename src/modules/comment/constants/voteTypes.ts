import { Heart, ThumbsUp, Smile, Laugh, Angry, Frown, HandMetal } from "lucide-react";
import { Frown as Scared } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface VoteType {
  type: string;
  /**
   * Identifiant sémantique de couleur (pas un token shadcn — palette de
   * réactions emotionnelles spécifique au domaine, sans équivalent dans
   * `--primary`/`--destructive`/etc.). Voir `iconClass`, `bgClass`,
   * `borderClass`, `bgHover` pour les classes Tailwind effectives.
   */
  color: string;
  icon: LucideIcon;
  label?: string;
  /** Classe Tailwind pour la couleur de l'icône (utilisée dans le picker). */
  iconClass: string;
  /** Classes bg fond clair + dark (utilisées dans la modale de réactions). */
  bgClass: string;
  /** Classes border clair + dark (modale). */
  borderClass: string;
  /** Classes hover bg clair + dark (picker). */
  bgHover: string;
}

/**
 * Palette de 8 réactions emotionnelles avec couleurs sémantiques par type.
 *
 * **Note design tokens** : ces couleurs sont volontairement des classes
 * Tailwind core (red-500, blue-500, etc.) plutôt que des tokens shadcn
 * (`--primary`/`--destructive`/etc.) parce qu'elles encodent un sens
 * spécifique au domaine — un cœur rouge, un pouce bleu, etc. — qui ne
 * peut pas être remappé sans perdre la signification visuelle. Une seule
 * exception : `glad` utilise `--primary` (couleur de marque du site).
 *
 * Toutes les classes sont centralisées ici (vs. dupliquées dans 3
 * composants comme c'était le cas avant `0960b87`).
 */
export const voteTypes: VoteType[] = [
  {
    type: "love",
    color: "red",
    icon: Heart,
    label: "reactionsTypes.love",
    iconClass: "text-red-500",
    bgClass: "bg-red-100 dark:bg-red-900/20",
    borderClass: "border-red-200 dark:border-red-800",
    bgHover: "hover:bg-red-50 dark:hover:bg-red-900/20",
  },
  {
    type: "like",
    color: "blue",
    icon: ThumbsUp,
    label: "reactionsTypes.like",
    iconClass: "text-blue-500",
    bgClass: "bg-blue-100 dark:bg-blue-900/20",
    borderClass: "border-blue-200 dark:border-blue-800",
    bgHover: "hover:bg-blue-50 dark:hover:bg-blue-900/20",
  },
  {
    type: "enjoy",
    color: "green",
    icon: Smile,
    label: "reactionsTypes.enjoy",
    iconClass: "text-green-500",
    bgClass: "bg-green-100 dark:bg-green-900/20",
    borderClass: "border-green-200 dark:border-green-800",
    bgHover: "hover:bg-green-50 dark:hover:bg-green-900/20",
  },
  {
    type: "glad",
    color: "primary",
    icon: Laugh,
    label: "reactionsTypes.glad",
    iconClass: "text-primary",
    bgClass: "bg-primary/10 dark:bg-primary/20",
    borderClass: "border-primary/30 dark:border-primary/40",
    bgHover: "hover:bg-primary/10 dark:hover:bg-primary/20",
  },
  {
    type: "bothered",
    color: "yellow",
    icon: Angry,
    label: "reactionsTypes.bothered",
    iconClass: "text-yellow-500",
    bgClass: "bg-yellow-100 dark:bg-yellow-900/20",
    borderClass: "border-yellow-200 dark:border-yellow-800",
    bgHover: "hover:bg-yellow-50 dark:hover:bg-yellow-900/20",
  },
  {
    type: "sad",
    color: "gray",
    icon: Frown,
    label: "reactionsTypes.sad",
    iconClass: "text-muted-foreground",
    bgClass: "bg-muted dark:bg-muted/60",
    borderClass: "border-border",
    bgHover: "hover:bg-muted/70 dark:hover:bg-muted",
  },
  {
    type: "scared",
    color: "purple",
    icon: Scared,
    label: "reactionsTypes.scared",
    iconClass: "text-purple-500",
    bgClass: "bg-purple-100 dark:bg-purple-900/20",
    borderClass: "border-purple-200 dark:border-purple-800",
    bgHover: "hover:bg-purple-50 dark:hover:bg-purple-900/20",
  },
  {
    type: "support",
    color: "indigo",
    icon: HandMetal,
    label: "reactionsTypes.support",
    iconClass: "text-indigo-500",
    bgClass: "bg-indigo-100 dark:bg-indigo-900/20",
    borderClass: "border-indigo-200 dark:border-indigo-800",
    bgHover: "hover:bg-indigo-50 dark:hover:bg-indigo-900/20",
  },
];

/** Map par type pour accès O(1) depuis les composants consommateurs. */
export const voteTypeMap: Record<string, VoteType> = Object.fromEntries(
  voteTypes.map((v) => [v.type, v]),
);
