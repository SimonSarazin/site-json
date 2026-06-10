import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useAuthModal } from "../hooks/useAuthModal";
import { type AuthModalOptions } from "../context/AuthModalContext";

interface LoginButtonProps {
  /** Libellé déjà résolu ; à défaut, « Se connecter ». */
  label?: ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  /** Options passées au modal global (`onSuccess`, `initialMode`). */
  openOptions?: AuthModalOptions;
  /** Effet de bord avant ouverture (ex. refermer le menu mobile). */
  onClick?: () => void;
}

/**
 * Bouton générique « Se connecter » : ouvre le modal d'authentification global
 * (`useAuthModal().openLogin`). Réutilisable partout (headers, sections, gardes)
 * pour offrir un chemin de login cohérent à l'utilisateur non connecté.
 */
export function LoginButton({
  label,
  variant = "default",
  size = "sm",
  className,
  openOptions,
  onClick,
}: LoginButtonProps) {
  useLoadNamespace("components/layout");
  const t = useT("components/layout");
  const { openLogin } = useAuthModal();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        onClick?.();
        openLogin(openOptions);
      }}
    >
      {label ?? t("Se connecter")}
    </Button>
  );
}
