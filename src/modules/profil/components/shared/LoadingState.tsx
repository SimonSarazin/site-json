import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/useT";

interface LoadingStateProps {
  /**
   * Variante d'affichage
   * - "spinner": Cercle animé avec message (par défaut)
   * - "skeleton": Lignes skeleton shadcn
   * - "list": Skeleton pour liste d'utilisateurs (avatar + texte)
   */
  variant?: "spinner" | "skeleton" | "list";
  /**
   * Nombre de lignes/items à afficher
   */
  rows?: number;
  /**
   * Message à afficher (pour variant "spinner")
   */
  message?: string;
  /**
   * Clé i18n pour le message
   */
  messageKey?: string;
  /**
   * Taille du spinner
   */
  size?: "sm" | "md" | "lg";
  /**
   * Classes CSS additionnelles
   */
  className?: string;
}

const spinnerSizes = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

/**
 * Composant d'état de chargement réutilisable
 * Utilise Skeleton de shadcn/ui
 */
export function LoadingState({
  variant = "spinner",
  rows = 3,
  message,
  messageKey,
  size = "md",
  className = "",
}: LoadingStateProps) {
  const t = useT("modules/profil");

  const displayMessage = message || (messageKey ? t(messageKey) : t("common.loading"));

  if (variant === "spinner") {
    return (
      <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
        <div
          className={`animate-spin rounded-full border-b-2 border-teal-600 ${spinnerSizes[size]}`}
        />
        {displayMessage && (
          <p className="text-muted-foreground mt-2 text-sm">{displayMessage}</p>
        )}
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  // variant === "list"
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
