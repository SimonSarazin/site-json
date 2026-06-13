import { type ReactNode } from "react";
import { LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { LoginButton } from "./LoginButton";
import { type AuthModalOptions } from "../context/AuthModalContext";

interface LoginPromptProps {
  /** Message d'incitation (ex. « Connectez-vous pour commenter »). */
  message?: ReactNode;
  /** Libellé du bouton (défaut : « Se connecter »). */
  loginLabel?: ReactNode;
  /** Options passées au modal (ex. `onSuccess` pour rejouer l'action). */
  openOptions?: AuthModalOptions;
  /** `inline` (bandeau discret) ou `card` (encadré centré). */
  variant?: "inline" | "card";
  className?: string;
}

/**
 * Invite l'utilisateur non connecté à se connecter, sur place — au lieu d'un
 * bouton désactivé ou d'un `toast.error`. Le bouton ouvre le modal global.
 * S'utilise tel quel ou via `<AuthGate fallback>`.
 */
export function LoginPrompt({
  message,
  loginLabel,
  openOptions,
  variant = "inline",
  className,
}: LoginPromptProps) {
  useLoadNamespace("components/layout");
  const t = useT("components/layout");

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 p-6 text-center",
          className,
        )}
      >
        <LogIn className="h-6 w-6 text-muted-foreground" />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <LoginButton label={loginLabel} openOptions={openOptions} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3",
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">
        {message ?? t("Se connecter")}
      </span>
      <LoginButton
        label={loginLabel}
        size="sm"
        variant="outline"
        openOptions={openOptions}
      />
    </div>
  );
}
