import type { ComponentType } from "react";
import { Github, Twitter, Linkedin, Facebook, Instagram, Youtube, Mail, Globe } from "lucide-react";
import NavLink from "../NavLink";
import { cn } from "@/lib/utils";

/** Map plateforme → icône lucide, consolidée (auparavant dupliquée/divergente
 * entre FooterRich et FooterSidebarColumns). Plateforme inconnue → `Globe`. */
const SOCIAL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  github: Github,
  twitter: Twitter,
  x: Twitter,
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  mail: Mail,
};

const DEFAULT_ITEM_CLASS =
  "inline-flex items-center justify-center rounded-md size-9 text-muted-foreground transition-colors hover:text-primary hover:bg-muted";

interface SocialLinksProps {
  socials?: { platform: string; url: string }[];
  /** Conteneur (défaut : `flex items-center gap-2`). */
  className?: string;
  /** Style de chaque lien social ; remplace le look par défaut (icône-bouton ghost). */
  itemClassName?: string;
  /** Style de l'icône (défaut : `h-4 w-4`). */
  iconClassName?: string;
}

/**
 * Rangée de liens sociaux partagée (pieds de page). Rend un `NavLink` externe
 * par réseau (donc `target="_blank" rel="noopener noreferrer"` + garde `#`/vide).
 * La map plateforme→icône est l'unique source de vérité ; le style des items
 * reste piloté par le footer via `itemClassName`/`iconClassName`.
 */
export default function SocialLinks({ socials, className, itemClassName, iconClassName }: SocialLinksProps) {
  if (!socials?.length) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {socials.map((social, idx) => {
        const Icon = SOCIAL_ICONS[social.platform.toLowerCase()] ?? Globe;
        return (
          <NavLink
            key={idx}
            to={social.url}
            external
            aria-label={social.platform}
            className={itemClassName ?? DEFAULT_ITEM_CLASS}
          >
            <Icon className={cn("h-4 w-4", iconClassName)} />
          </NavLink>
        );
      })}
    </div>
  );
}
