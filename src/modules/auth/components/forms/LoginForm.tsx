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
import { useSSOAuth } from "../../hooks/useSSOAuth";

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

  const ssoProviders: string[] = (entity?.serverData.costum as { sso?: string[] })?.sso || [];
  /*
   * Si l'entité costum demande à se connecter uniquement via SSO, on masque
   * le formulaire email/pwd et on n'affiche que le(s) bouton(s) SSO.
   */
  const connectOnlyBySSO =
    ((entity?.serverData?.costum as { connectOnlyBySSO?: boolean })?.connectOnlyBySSO) === true;
  const ssoOnly = connectOnlyBySSO && ssoProviders.length > 0;

  /*
  * Auto-trigger SSO : si connectOnlyBySSO + un seul fournisseur, on déclenche
  * la popup SSO dès que le formulaire est monté (typiquement après clic sur
  * "Rejoindre" / "Se connecter" dans le header, donc encore dans la fenêtre
  * de user gesture du navigateur — pas de bloqueur de popup).
  **/
  const { openSSOPopup } = useSSOAuth();
  const [ssoAutoTriggered, setSsoAutoTriggered] = useState(false);
  const shouldAutoSSO = connectOnlyBySSO && ssoProviders.length === 1;

  /* 
   * Ferme le dialog et redirige dès que l'utilisateur est connecté ------
   * (quel que soit le chemin : email/pwd, SSO classique, SSO auto-trigger).
   * Évite la course entre le postMessage SSO et la détection popup.closed.
   */
  useEffect(() => {
    if (loading) return;
    if (!me?.isConnected) return;
    onSuccess?.();
    if (!hideBackButton) navigate("/");
  }, [loading, me, navigate, onSuccess, hideBackButton]);

  useEffect(() => {
    if (!loaded || loading) return;
    if (me?.isConnected) return;
    if (!shouldAutoSSO) return;
    if (ssoAutoTriggered) return;

    setSsoAutoTriggered(true);
    let cancelled = false;
    (async () => {
      const result = await openSSOPopup(ssoProviders[0]);
      if (cancelled) return;
      if (result.success) {
        onSuccess?.();
        if (!hideBackButton) navigate("/");
      } else if (result.error) {
        toast.error(t("Erreur"), { description: result.error });
        /* 
          * En cas d'erreur (popup bloquée, échec de connexion, etc.),
          * on retombe sur le formulaire classique pour laisser
          * l'utilisateur réessayer ou choisir une autre méthode de connexion.
        */
        setSsoAutoTriggered(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loaded, loading, me, shouldAutoSSO, ssoAutoTriggered, openSSOPopup, ssoProviders, onSuccess, hideBackButton, navigate, t]);

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
        {!ssoOnly && (
          <>
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
              <label
                htmlFor="remember"
                className="text-sm text-muted-foreground"
              >
                {t("Se souvenir de moi")}
              </label>
            </div>

            <Button
              className="w-full"
              onClick={handleLogin}
              disabled={loadingLogin}
              variant="default"
              size="lg"
            >
              {loadingLogin ? t("Connexion...") : t("Se connecter")}
            </Button>
          </>
        )}

        {ssoProviders.length > 0 && (
          <div className="space-y-2">
            {!ssoOnly && (
              <div className="relative flex items-center gap-2">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t("ou continuer avec")}
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
            )}
            {shouldAutoSSO && ssoAutoTriggered ? (
              <div className="flex items-center justify-center gap-3 py-4 text-muted-foreground">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>{t("Connexion en cours…")}</span>
              </div>
            ) : (
              ssoProviders.map((provider) => (
                <SSOLoginButton
                  key={provider}
                  provider={provider}
                  onSuccess={() => {
                    onSuccess?.();
                    if (!hideBackButton) navigate("/");
                  }}
                />
              ))
            )}
          </div>
        )}

        <div className="text-center space-y-2">
          {!ssoOnly && (
            <>
              <Button
                variant="ghost"
                onClick={() => navigate("/recover-password")}
                className="text-sm text-primary hover:text-primary/80"
              >
                {t("Mot de passe oublié ?")}
              </Button>

              <div className="text-sm text-muted-foreground">
                {t("Pas encore de compte ?")} {" "}
                <Button
                  variant="ghost"
                  onClick={() => navigate("/register")}
                  className="text-primary hover:text-primary/80 p-0 h-auto font-normal"
                >
                  {t("S'inscrire")}
                </Button>
              </div>
            </>
          )}

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
