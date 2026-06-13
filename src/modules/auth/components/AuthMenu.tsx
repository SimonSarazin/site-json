import { useNavigate } from "react-router";
import { ChevronDown, User, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ClientOnly } from "@/components/layout/ClientOnly";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { cn } from "@/lib/utils";
import type { LocalizedString } from "@/types/site-schema";
import { useAuthActions } from "../hooks/useAuthActions";
import { CurrentUserAvatar } from "./CurrentUserAvatar";
import { LoginButton } from "./LoginButton";

interface AuthMenuProps {
  /** Densité (avatar + nom). Surchargée par `config.auth.menu.density` si présent. */
  density?: "compact" | "normal";
  /** Couleur : `default` (tokens) ou `onColor` (texte blanc sur barre sombre/colorée). */
  tone?: "default" | "onColor";
  /** `menu` = dropdown desktop ; `stack` = boutons pleine largeur (menu mobile). */
  layout?: "menu" | "stack";
  /** Identité visuelle du bouton déconnecté. */
  loginVariant?: "ghost" | "solid" | "outline";
  /** Override de libellé (ex. `header.ctaButton.label`). */
  loginLabel?: LocalizedString;
  /** Extras visuels du bouton login (ex. `shadow-glow`). */
  loginClassName?: string;
  /** Affiche le nom à côté de l'avatar (défaut : densité `normal`). */
  showName?: boolean;
  /** Affiche un en-tête nom + email dans le dropdown. */
  showDropdownHeader?: boolean;
  /** Affiche le chevron sur le trigger (défaut `true`). */
  showChevron?: boolean;
  /** Joué après une action (ex. refermer le menu mobile). */
  onAction?: () => void;
  className?: string;
}

const LOGIN_VARIANT_MAP = {
  ghost: "ghost",
  solid: "default",
  outline: "outline",
} as const;

/**
 * Widget d'authentification des headers — connecté : avatar + dropdown
 * (Profil / Déconnexion) ; déconnecté : bouton qui ouvre le modal global.
 *
 * Self-contained : lit `useAuthActions()` + ouvre le modal via `LoginButton`
 * (→ `useAuthModal`). Le header ne passe que de la présentation. Toujours sous
 * `ClientOnly` (pas de flash de contenu privé en SSR).
 */
export function AuthMenu({
  density: densityProp,
  tone = "default",
  layout = "menu",
  loginVariant = "ghost",
  loginLabel,
  loginClassName,
  showName: showNameProp,
  showDropdownHeader: showDropdownHeaderProp,
  showChevron = true,
  onAction,
  className,
}: AuthMenuProps) {
  useLoadNamespace("components/layout");
  const t = useT("components/layout");
  const navigate = useNavigate();
  const { config } = useSite();
  const { isConnected, logout, profileUrl, name, avatarUrl, email } = useAuthActions();

  // Précédence : config (bascule tous les headers) > prop (défaut du header) > défaut.
  const menuCfg = config.auth?.menu;
  const density = menuCfg?.density ?? densityProp ?? "normal";
  const showName = menuCfg?.showName ?? showNameProp ?? density === "normal";
  const showDropdownHeader =
    menuCfg?.showDropdownHeader ?? showDropdownHeaderProp ?? false;

  const resolvedLabel = loginLabel
    ? t(loginLabel)
    : menuCfg?.loginLabel
      ? t(menuCfg.loginLabel)
      : undefined;

  const avatarSize = density === "compact" ? "h-7 w-7 lg:h-8 lg:w-8" : "h-8 w-8";
  const onColor = tone === "onColor";
  const triggerColor = onColor
    ? "text-white hover:bg-white/10"
    : "text-foreground hover:bg-muted dark:hover:bg-muted";
  const avatarFallback = onColor
    ? "bg-white/20 text-white"
    : "bg-secondary text-secondary-foreground";

  // ----- Déconnecté ---------------------------------------------------------
  const loginButton = (
    <LoginButton
      label={resolvedLabel}
      variant={LOGIN_VARIANT_MAP[loginVariant]}
      className={cn(layout === "stack" && "w-full justify-start", loginClassName)}
      onClick={onAction}
    />
  );

  // ----- Connecté : layout "stack" (mobile) ---------------------------------
  if (layout === "stack") {
    return (
      <ClientOnly fallback={<div className={cn("h-10", className)} />}>
        {() =>
          isConnected ? (
            <div className={cn("space-y-1 border-t pt-2", className)}>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  onAction?.();
                  navigate(profileUrl);
                }}
              >
                <User className="mr-2 h-4 w-4" />
                {t("Profil")}
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  onAction?.();
                  logout();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t("Se déconnecter")}
              </Button>
            </div>
          ) : (
            <div className={cn("border-t pt-2", className)}>{loginButton}</div>
          )
        }
      </ClientOnly>
    );
  }

  // ----- Connecté : layout "menu" (desktop) ---------------------------------
  return (
    <ClientOnly
      fallback={
        <Button variant="ghost" size="sm" disabled className={className}>
          …
        </Button>
      }
    >
      {() =>
        isConnected ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={name || email || t("Mon compte")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full p-1 transition",
                  triggerColor,
                  className,
                )}
              >
                <CurrentUserAvatar
                  avatarUrl={avatarUrl}
                  name={name}
                  className={avatarSize}
                  fallbackClassName={avatarFallback}
                />
                {showName && name && (
                  <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
                    {name}
                  </span>
                )}
                {showChevron && <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {showDropdownHeader && (
                <>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {name || t("Mon compte")}
                    </p>
                    {email && (
                      <p className="truncate text-xs text-muted-foreground">{email}</p>
                    )}
                  </div>
                  <div className="-mx-1 my-1 h-px bg-muted" />
                </>
              )}
              <DropdownMenuItem onClick={() => navigate(profileUrl)}>
                <User className="mr-2 h-4 w-4" />
                {t("Profil")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                {t("Se déconnecter")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          loginButton
        )
      }
    </ClientOnly>
  );
}
