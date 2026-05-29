import React, {
  useState,
  useEffect,
  type ChangeEvent,
} from "react";

import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/auth/i18n";

import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";
import PasswordToggleTextInput from "@/components/form/PasswordToggleTextInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidEmail } from "@/helpers/isValidEmail";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import SSOLoginButton from "./SSOLoginButton";

type RadixCheckboxState = boolean | "indeterminate";

interface LoginFormProps {
  onSuccess?: () => void;
  hideBackButton?: boolean;
  // Mode modal : bascule interne au lieu de naviguer vers /register et
  // /recover-password (qui n'existent pas forcément selon la config).
  onSwitchToRegister?: () => void;
  onSwitchToRecover?: () => void;
}

export default function LoginForm({ onSuccess, hideBackButton = false, onSwitchToRegister, onSwitchToRecover }: LoginFormProps = {}): React.ReactNode {
  const [email, setEmail]           = useState<string>("");
  const [password, setPassword]     = useState<string>("");
  const [remember, setRemember]     = useState<boolean>(false);
  const [loadingLogin, setLoading]  = useState<boolean>(false);

  const navigate                     = useNavigate();
  const { userApi, loading, me, entity }     = useCocolight();
  const { config }                   = useSite();
  const { loaded }                   = useLoadNamespace("modules/auth");
  const t                            = useT("modules/auth");

  // Récupérer les textes personnalisés depuis config.prod.json
  const loginTitle = config.auth?.login?.title || { fr: "Se connecter", en: "Sign in" };
  const loginSubtitle = config.auth?.login?.subtitle || { fr: "Accédez à votre compte SiteForge", en: "Access your SiteForge account" };

  // Fournisseurs SSO configurés (optionnel)
  const ssoProviders: string[] = (entity?.serverData.costum as { sso?: string[] })?.sso || [];
  /* Redirige l’utilisateur déjà connecté -------------------------------- */
  useEffect(() => {
    if (!loading && me?.isConnected) navigate("/");
  }, [loading, me, navigate]);

  /* --------------------------------------------------------------------- */
  const handleLogin = async (): Promise<void> => {
    setLoading(true);

    // Si userApi n'est pas encore prêt, on arrête
    if (!userApi) {
      toast.error(t("Erreur"), {
        description: t("Impossible de se connecter pour le moment"),
      });
      setLoading(false);
      return;
    }
    
    /* Validation rapide -------------------------------------------------- */
    if (!email || !password) {
      toast.error(t("Erreur"), {
        description: t("Veuillez remplir l'email et le mot de passe"),
      });
      setLoading(false);
      return;
    }
    if (!isValidEmail(email)) {
      toast.error(t("Erreur"), {
        description: t("L'adresse e-mail n'est pas valide"),
      });
      setLoading(false);
      return;
    }

    /* Appel API ---------------------------------------------------------- */
    try {
      await userApi.login(email, password);     // ← optionnel
      if (userApi.isConnected) {
        onSuccess?.();
        if (!hideBackButton) navigate("/");
      }
    } catch (err: unknown) {
      /* On extrait le status si présent, sinon on retombe sur le message  */
      const status =
        (err as { response?: { status?: number } }).response?.status;

      const msg =
        status === 401 || status === 404
          ? t("Email ou mot de passe incorrect")
          : (err as Error).message;

      toast.error(t("Erreur"), {
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------------------------- */
  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-4 rounded-lg bg-card">
      <div className="text-center">
        <h2 className="text-3xl text-foreground font-bold mb-2">
          {t(loginTitle)}
        </h2>
        <p className="text-muted-foreground">
          {t(loginSubtitle)}
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleLogin();
        }}
      >
        <Input
          type="email"
          placeholder={t("Adresse e-mail")}
          value={email}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setEmail(e.target.value)
          }
          className="h-12"
        />

        <PasswordToggleTextInput
          placeholder={t("Mot de passe")}
          value={password}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setPassword(e.target.value)
          }
          className="h-12"
        />

        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember"
            checked={remember}
            /* Radix UI : boolean | "indeterminate" ----------------------- */
            onCheckedChange={(checked: RadixCheckboxState) =>
              setRemember(Boolean(checked))
            }
          />
          <Label
            htmlFor="remember"
            className="text-sm text-muted-foreground"
          >
            {t("Se souvenir de moi")}
          </Label>
        </div>

        <Button
          className="w-full"
          type="submit"
          disabled={loadingLogin}
          variant="default"
          size="lg"
        >
          {loadingLogin ? t("Connexion...") : t("Se connecter")}
        </Button>

        {ssoProviders.length > 0 && (
          <div className="space-y-2">
            <div className="relative flex items-center gap-2">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {t("ou continuer avec")}
              </span>
              <div className="flex-1 border-t border-border" />
            </div>
            {ssoProviders.map((provider) => (
              <SSOLoginButton
                key={provider}
                provider={provider}
                onSuccess={() => {
                  onSuccess?.();
                  if (!hideBackButton) navigate("/");
                }}
              />
            ))}
          </div>
        )}

        <div className="text-center space-y-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => (onSwitchToRecover ? onSwitchToRecover() : navigate("/recover-password"))}
            className="text-sm text-primary hover:text-primary/80"
          >
            {t("Mot de passe oublié ?")}
          </Button>

          <div className="text-sm text-muted-foreground">
            {t("Pas encore de compte ?")} {" "}
            <Button
              type="button"
              variant="ghost"
              onClick={() => (onSwitchToRegister ? onSwitchToRegister() : navigate("/register"))}
              className="text-primary hover:text-primary/80 p-0 h-auto font-normal"
            >
              {t("S'inscrire")}
            </Button>
          </div>

          {!hideBackButton && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/")}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t("Retour à l'accueil")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
