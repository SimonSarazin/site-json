import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CountBadgeProps {
  /**
   * Nombre à afficher
   */
  count: number;
  /**
   * Variante de style (utilise les variantes de Badge shadcn)
   */
  variant?: "default" | "secondary" | "destructive" | "outline";
  /**
   * Afficher le badge même si count = 0
   */
  showZero?: boolean;
  /**
   * Couleur de fond personnalisée (pour les couleurs non-standard)
   */
  colorScheme?: "muted" | "orange" | "blue" | "green" | "red";
  /**
   * Classes CSS additionnelles
   */
  className?: string;
}

const colorSchemes = {
  muted: "bg-muted text-muted-foreground",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

/**
 * Badge compteur réutilisable pour les onglets et listes
 * Utilise Badge de shadcn/ui avec des couleurs personnalisées
 */
export function CountBadge({
  count,
  variant,
  showZero = false,
  colorScheme,
  className,
}: CountBadgeProps) {
  // Ne pas afficher si count = 0 et showZero = false
  if (count === 0 && !showZero) {
    return null;
  }

  // Si un colorScheme personnalisé est fourni, on l'utilise
  if (colorScheme) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium",
          colorSchemes[colorScheme],
          className
        )}
      >
        {count}
      </span>
    );
  }

  // Sinon on utilise le Badge shadcn standard
  return (
    <Badge variant={variant || "secondary"} className={cn("ml-1", className)}>
      {count}
    </Badge>
  );
}
