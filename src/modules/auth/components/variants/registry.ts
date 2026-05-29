import LoginForm from "../forms/LoginForm";
import RegisterForm from "../forms/RegisterForm";
import RecoverPasswordForm from "../forms/RecoverPasswordForm";
import AuthModal from "../AuthModal";

/**
 * Jeu de composants d'auth pour un variant de design donné.
 */
export interface AuthVariantSet {
  LoginForm: typeof LoginForm;
  RegisterForm: typeof RegisterForm;
  RecoverPasswordForm: typeof RecoverPasswordForm;
  AuthModal: typeof AuthModal;
}

const DEFAULT_SET: AuthVariantSet = {
  LoginForm,
  RegisterForm,
  RecoverPasswordForm,
  AuthModal,
};

/**
 * Résout le jeu de composants d'auth selon le variant déclaré en config
 * (`config.auth.variant`). Aujourd'hui un seul variant `default` ; le switch est
 * extensible (ajouter `case "tiers-lieux": return TIERS_LIEUX_SET`). Calqué sur
 * le switch `SiteHeader.tsx` qui résout le header par `header.type`.
 */
export function resolveAuthVariant(variant?: string): AuthVariantSet {
  switch (variant) {
    default:
      return DEFAULT_SET;
  }
}
