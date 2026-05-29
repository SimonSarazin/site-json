// Charge le bundle i18n du module (side-effect : addResourceBundle "modules/auth").
import "./i18n";

export { routes } from "./routes";

// Composants
export { default as AuthModal } from "./components/AuthModal";
export { default as LoginForm } from "./components/forms/LoginForm";
export { default as RegisterForm } from "./components/forms/RegisterForm";
export { default as RecoverPasswordForm } from "./components/forms/RecoverPasswordForm";
export { default as SSOLoginButton } from "./components/forms/SSOLoginButton";
export { AuthPageLayout } from "./components/AuthPageLayout";
export { AuthSeo } from "./AuthSeo";
export { resolveAuthVariant } from "./components/variants/registry";
export type { AuthVariantSet } from "./components/variants/registry";

// Sections (rendues via SectionRenderer)
export { default as LoginFormSection } from "./sections/LoginFormSection";
export { default as RegisterFormSection } from "./sections/RegisterFormSection";
export { default as RecoverPasswordFormSection } from "./sections/RecoverPasswordFormSection";

// Hooks
export { useSSOAuth } from "./hooks/useSSOAuth";

// Schémas + types
export * from "./schema";
