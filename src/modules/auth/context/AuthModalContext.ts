import { createContext } from "react";

/** Modes d'affichage du modal d'authentification (basculés en interne, sans navigation). */
export type AuthMode = "login" | "register" | "recover";

/** Options passées à `openLogin()` — routées vers le `LoginForm` à l'ouverture. */
export interface AuthModalOptions {
  /** Joué quand la connexion réussit, AVANT la fermeture du modal (ex. `refetch`). */
  onSuccess?: () => void;
  /** Mode affiché à l'ouverture (défaut : `"login"`). */
  initialMode?: AuthMode;
}

export interface AuthModalContextValue {
  /** `true` si le modal de connexion est ouvert. */
  isOpen: boolean;
  /** Ouvre le modal de connexion global (overlay) avec des options optionnelles. */
  openLogin: (options?: AuthModalOptions) => void;
  /** Ferme le modal de connexion. */
  close: () => void;
}

export const AuthModalContext = createContext<AuthModalContextValue | null>(null);
