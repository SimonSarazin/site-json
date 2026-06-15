import { useContext } from "react";
import { AuthModalContext } from "../context/AuthModalContext";

/**
 * Accès au modal d'authentification global (monté par `AuthModalProvider`).
 * N'importe quel composant sous le provider peut ouvrir la connexion :
 * `const { openLogin } = useAuthModal(); openLogin({ onSuccess })`.
 */
export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal doit être utilisé sous <AuthModalProvider>");
  }
  return ctx;
}
