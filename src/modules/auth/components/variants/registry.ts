import { lazy } from "vite-preload";

// Tout le set est chargé en lazy() vite-preload : ni la modal ni les formulaires
// ne sont dans le bundle initial. Les chunks sont tirés à l'usage —
//  - AuthModal au clic sur « Se connecter » (cf. AuthModalLazy),
//  - chaque formulaire en visitant /login, /register, /recover-password (les
//    pages restent des routes core eager, mais leur contenu est lazy via Suspense
//    dans AuthPageLayout).
// lazy() est évalué une seule fois (constantes module-level) pour rester stable
// entre les rendus. Pattern identique aux sections / RootLayout / profil.
const LoginForm = lazy(() => import("../forms/LoginForm"));
const RegisterForm = lazy(() => import("../forms/RegisterForm"));
const RecoverPasswordForm = lazy(() => import("../forms/RecoverPasswordForm"));
const AuthModal = lazy(() => import("../AuthModal"));

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
