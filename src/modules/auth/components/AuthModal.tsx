import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import LoginForm from "./forms/LoginForm";
import RegisterForm from "./forms/RegisterForm";
import RecoverPasswordForm from "./forms/RecoverPasswordForm";

type AuthMode = "login" | "register" | "recover";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Joué quand la connexion réussit, avant fermeture (ex. `refetch` côté CoForm). */
  onSuccess?: () => void;
  /** Mode affiché à l'ouverture (défaut : `"login"`). */
  initialMode?: AuthMode;
}

/**
 * Modal d'authentification multi-mode (login / inscription / récupération mot
 * de passe). Les 3 forms basculent en interne (callbacks onSwitchTo*) au lieu de
 * naviguer — donc pas besoin des pages /register et /recover-password en config.
 *
 * Responsive : `Sheet` bas sur mobile, `Dialog` centré sur desktop (via
 * `useIsMobile`, même pattern que `NotificationBellImpl` / `CommandPalette`).
 *
 * Les mêmes forms, montés sans callbacks (sections loginForm/registerForm/
 * recoverPasswordForm), conservent leur navigation par pages.
 */
export default function AuthModal({
  open,
  onOpenChange,
  onSuccess,
  initialMode = "login",
}: AuthModalProps) {
  useLoadNamespace("modules/auth");
  const t = useT("modules/auth");
  const isMobile = useIsMobile();
  // Repart sur le mode initial à chaque ouverture : `AuthModalLazy` démonte la
  // modal quand elle est fermée (`{open && …}`), donc ce state est réinitialisé
  // au remontage — pas besoin d'un effet de reset.
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const close = () => onOpenChange(false);
  const handleSuccess = () => {
    onSuccess?.();
    close();
  };

  const title =
    mode === "register"
      ? t("S'inscrire")
      : mode === "recover"
        ? t("Mot de passe oublié ?")
        : t("Se connecter");

  const content = (
    <>
      {mode === "login" && (
        <LoginForm
          onSuccess={handleSuccess}
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
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[90vh] gap-0 overflow-y-auto rounded-t-2xl border-border bg-card p-4"
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  );
}
