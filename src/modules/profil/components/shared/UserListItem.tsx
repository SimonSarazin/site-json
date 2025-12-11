import { forwardRef } from "react";
import { Link } from "react-router";
import type { User, Organization } from "@communecter/cocolight-api-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserListItemProps {
  /**
   * Utilisateur ou organisation à afficher
   */
  user: User | Organization;
  /**
   * Sous-titre optionnel (ex: @username, email, etc.)
   */
  subtitle?: string;
  /**
   * Badge ou indicateur de statut
   */
  badge?: React.ReactNode;
  /**
   * Actions (boutons, menu, etc.)
   */
  actions?: React.ReactNode;
  /**
   * Callback au clic
   */
  onClick?: () => void;
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
 * Composant réutilisable pour afficher un utilisateur dans une liste
 * Utilise Avatar de shadcn/ui
 */
export const UserListItem = forwardRef<HTMLDivElement, UserListItemProps>(
  function UserListItem(
    {
      user,
      subtitle,
      badge,
      actions,
      onClick,
      className,
      variant = "default",
    },
    ref
  ) {
    const name = user.serverData?.name || "?";
    const avatarUrl =
      user.serverData?.profilThumbImageUrl || user.serverData?.profilImageUrl;
    const fallback = name.charAt(0).toUpperCase();
    const slug = user.serverData?.slug;

    // Sous-titre par défaut: username ou email
    const displaySubtitle =
      subtitle ??
      (user.serverData?.username
        ? `@${user.serverData.username}`
        : user.serverData?.email);

    const containerClasses = cn(
      "flex items-center justify-between",
      {
        "p-4 hover:bg-muted/50": variant === "default",
        "p-2": variant === "compact",
        "p-3 border rounded-lg": variant === "card",
      },
      onClick && "cursor-pointer",
      className
    );

    const avatarSizes = {
      default: "h-12 w-12",
      compact: "h-8 w-8",
      card: "h-10 w-10",
    };

    return (
      <div ref={ref} className={containerClasses} onClick={onClick}>
        <div className="flex items-center gap-3">
          <Avatar className={avatarSizes[variant]}>
            <AvatarImage src={avatarUrl} alt={name} />
            <AvatarFallback>{fallback}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            {slug ? (
              <Link
                to={`/profil/${slug}`}
                className="font-medium text-foreground truncate block hover:underline"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                {name}
              </Link>
            ) : (
              <h3 className="font-medium text-foreground truncate">{name}</h3>
            )}
            {displaySubtitle && (
              <p className="text-sm text-muted-foreground truncate">
                {displaySubtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          {badge}
          {actions}
        </div>
      </div>
    );
  }
);
