import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /**
   * Icône à afficher
   */
  icon?: LucideIcon;
  /**
   * Titre principal
   */
  title: string;
  /**
   * Description secondaire
   */
  description?: string;
  /**
   * Action optionnelle (bouton, lien, etc.)
   */
  action?: React.ReactNode;
  /**
   * Classes CSS additionnelles
   */
  className?: string;
  /**
   * Variante de style
   */
  variant?: "default" | "compact" | "card";
}

/**
 * Composant d'état vide réutilisable
 * Style cohérent pour tous les états vides du module profil
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  const containerClasses = cn(
    "text-center",
    {
      "py-12": variant === "default",
      "py-6": variant === "compact",
      "py-8 bg-card rounded-lg border border-border": variant === "card",
    },
    className
  );

  const iconClasses = cn("mx-auto text-muted-foreground", {
    "h-12 w-12 mb-4": variant === "default" || variant === "card",
    "h-8 w-8 mb-2": variant === "compact",
  });

  const titleClasses = cn("font-medium text-foreground", {
    "text-lg mb-2": variant === "default" || variant === "card",
    "text-base mb-1": variant === "compact",
  });

  const descriptionClasses = cn("text-muted-foreground", {
    "text-sm": true,
    "max-w-md mx-auto": variant === "default" || variant === "card",
  });

  return (
    <div className={containerClasses}>
      {Icon && <Icon className={iconClasses} />}
      <p className={titleClasses}>{title}</p>
      {description && <p className={descriptionClasses}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
