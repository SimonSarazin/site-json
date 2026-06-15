import { useState } from "react";
import { User } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { cn } from "@/lib/utils";

interface CurrentUserAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  /** Taille d'affichage (classes Tailwind, ex. `h-8 w-8`). */
  className?: string;
  /** Couleurs du repli (initiales / icône) — selon le `tone`. */
  fallbackClassName?: string;
  /** Résolution source demandée à l'optimiseur `/img` (px). Défaut 32 (avatar header). */
  size?: number;
}

/** Initiales (≤2 lettres) dérivées du nom, ou `null`. */
function initialsOf(name?: string | null): string | null {
  if (!name) return null;
  const ini = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return ini ? ini.toUpperCase() : null;
}

/**
 * Avatar de l'utilisateur **courant** (`me`) : image de profil servie via
 * l'optimiseur `/img` (`OptimizedImage`), avec repli initiales → icône.
 *
 * Comportement « avatar » sans dépendre du suivi de chargement Radix : le repli
 * est rendu **en dessous**, donc visible tant que l'image n'a pas peint, et de
 * nouveau si elle échoue (`onError`). On mémorise l'URL en échec (pas un booléen)
 * pour que l'image réapparaisse si `avatarUrl` change.
 *
 * NB : réservé à l'utilisateur courant. Pour les avatars d'autres entités
 * (cards, commentaires, membres), utiliser directement `@/components/ui/avatar`.
 */
export function CurrentUserAvatar({
  avatarUrl,
  name,
  className,
  fallbackClassName,
  size = 32,
}: CurrentUserAvatarProps) {
  const [erroredUrl, setErroredUrl] = useState<string | null>(null);
  const initials = initialsOf(name);
  const showImage = !!avatarUrl && erroredUrl !== avatarUrl;

  return (
    <span
      className={cn(
        "relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground",
          fallbackClassName,
        )}
      >
        {initials ?? <User className="h-4 w-4" />}
      </span>
      {showImage && (
        <OptimizedImage
          src={avatarUrl}
          alt={name ?? "Profile"}
          width={size}
          height={size}
          className="absolute inset-0 h-full w-full rounded-full object-cover"
          onError={() => setErroredUrl(avatarUrl)}
        />
      )}
    </span>
  );
}
