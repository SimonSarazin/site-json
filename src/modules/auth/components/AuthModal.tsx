import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import LoginForm from "./forms/LoginForm";
import RegisterForm from "./forms/RegisterForm";
import RecoverPasswordForm from "./forms/RecoverPasswordForm";

type AuthMode = "login" | "register" | "recover";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal d'authentification multi-mode (login / inscription / récupération mot
 * de passe) pour les sites où l'auth se fait en overlay plutôt qu'en pages
 * dédiées. Les 3 forms basculent en interne (callbacks onSwitchTo*) au lieu de
 * naviguer — donc pas besoin des pages /register et /recover-password en config.
 *
 * Les mêmes forms, montés sans callbacks (sections loginForm/registerForm/
 * recoverPasswordForm), conservent leur navigation par pages.
 */
export default function AuthModal({ open, onOpenChange }: AuthModalProps) {
  useLoadNamespace("modules/auth");
  const t = useT("modules/auth");
  const [mode, setMode] = useState<AuthMode>("login");

  // Repart sur le login à chaque réouverture du modal.
  useEffect(() => {
    if (open) setMode("login");
  }, [open]);

  const close = () => onOpenChange(false);

  const title =
    mode === "register"
      ? t("S'inscrire")
      : mode === "recover"
        ? t("Mot de passe oublié ?")
        : t("Se connecter");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {mode === "login" && (
          <LoginForm
            onSuccess={close}
            hideBackButton
            onSwitchToRegister={() => setMode("register")}
            onSwitchToRecover={() => setMode("recover")}
          />
        )}

        {mode === "register" && (
          <RegisterForm onSwitchToLogin={() => setMode("login")} />
        )}

        {mode === "recover" && (
          <RecoverPasswordForm onSwitchToLogin={() => setMode("login")} />
        )}
      </DialogContent>
    </Dialog>
  );
}
