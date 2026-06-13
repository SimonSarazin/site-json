// Charge le bundle i18n du module (side-effect : addResourceBundle "modules/auth").
import "./i18n";

export { routes } from "./routes";

// Composants
export { default as AuthModal } from "./components/AuthModal";
export { AuthModalLazy } from "./components/AuthModalLazy";
export { default as LoginForm } from "./components/forms/LoginForm";
export { default as RegisterForm } from "./components/forms/RegisterForm";
export { default as RecoverPasswordForm } from "./components/forms/RecoverPasswordForm";
export { default as SSOLoginButton } from "./components/forms/SSOLoginButton";
export { AuthPageLayout } from "./components/AuthPageLayout";
export { AuthMenu } from "./components/AuthMenu";
export { LoginButton } from "./components/LoginButton";
export { LoginPrompt } from "./components/LoginPrompt";
export { AuthGate } from "./components/AuthGate";
export { CurrentUserAvatar } from "./components/CurrentUserAvatar";
export { AuthSeo } from "./AuthSeo";
export { resolveAuthVariant } from "./components/variants/registry";
export type { AuthVariantSet } from "./components/variants/registry";

// Sections (rendues via SectionRenderer)
export { default as LoginFormSection } from "./sections/LoginFormSection";
export { default as RegisterFormSection } from "./sections/RegisterFormSection";
export { default as RecoverPasswordFormSection } from "./sections/RecoverPasswordFormSection";

// Contexte global du modal de connexion
export { AuthModalProvider } from "./context/AuthModalProvider";
export type {
  AuthModalContextValue,
  AuthModalOptions,
  AuthMode,
} from "./context/AuthModalContext";

// Hooks
export { useSSOAuth } from "./hooks/useSSOAuth";
export { useAuthModal } from "./hooks/useAuthModal";
export { useAuthActions } from "./hooks/useAuthActions";

// Schémas + types
export * from "./schema";
