import { type ReactNode } from "react";
import { ClientOnly } from "@/components/layout/ClientOnly";
import { useAuthActions } from "../hooks/useAuthActions";
import { LoginPrompt } from "./LoginPrompt";
import { type AuthModalOptions } from "../context/AuthModalContext";

interface AuthGateProps {
  /** Rendu si l'utilisateur est connecté. */
  children: ReactNode;
  /** Rendu sinon (défaut : `<LoginPrompt message={message} />`). */
  fallback?: ReactNode;
  /** Message du `LoginPrompt` par défaut. */
  message?: ReactNode;
  /** Options passées au modal de login par défaut. */
  openOptions?: AuthModalOptions;
}

/**
 * Garde d'accès générique : montre `children` si connecté, sinon une invite de
 * connexion (ou un `fallback` custom). Sous `ClientOnly` : pas de flash de
 * contenu privé en SSR (cf. gotcha #10). Généralise le pattern de
 * `CoFormAccessGuard` (cas `not_logged_in`).
 */
export function AuthGate({ children, fallback, message, openOptions }: AuthGateProps) {
  const { isConnected } = useAuthActions();

  return (
    <ClientOnly fallback={null}>
      {() =>
        isConnected ? (
          <>{children}</>
        ) : (
          fallback ?? <LoginPrompt message={message} openOptions={openOptions} />
        )
      }
    </ClientOnly>
  );
}
