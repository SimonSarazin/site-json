import React, {
  useState,
  useEffect,
  useMemo,
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
import { useNavigate, useLocation } from "react-router";
import SSOLoginButton from "./SSOLoginButton";
import { useSSOAuth } from "../../hooks/useSSOAuth";
import { returnToOrHome } from "@/lib/authRedirect";

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
  const location                     = useLocation();
  // Page visée mémorisée par la garde (usePageGuards) — repli sur l'accueil, comportement
  // historique. `returnToOrHome` refuse toute destination externe (cf. lib/authRedirect).
  const returnTo                     = returnToOrHome(location.state);
  const { userApi, loading, me, entity }     = useCocolight();
  const { config }                   = useSite();
  const { loaded }                   = useLoadNamespace("modules/auth");
  const t                            = useT("modules/auth");

  // Récupérer les textes personnalisés depuis config.prod.json
  const loginTitle = config.auth?.login?.title || { fr: "Se connecter", en: "Sign in" };
  // Défaut NEUTRE : « SiteForge » est le nom du générateur, il ne doit jamais
  // fuiter sur un site — chaque site personnalise via config.auth.login.
  const loginSubtitle = config.auth?.login?.subtitle || { fr: "Accédez à votre compte", en: "Access your account" };

  const ssoProviders: string[] = useMemo(
    () => (entity?.serverData.costum as { sso?: string[] })?.sso || [],
    [entity],
  );
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
   *
   * État tri-valué : "idle" (pas encore tenté), "running" (popup ouverte),
   * "failed" (annulation ou erreur). On ne re-déclenche jamais automatiquement
   * une fois sorti de "idle" : l'utilisateur retombe sur le bouton SSO manuel
   * pour réessayer. Évite la boucle de popups et le spinner figé.
   */
  const { openSSOPopup } = useSSOAuth();
  const [autoSSO, setAutoSSO] = useState<"idle" | "running" | "failed">("idle");
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
    if (!hideBackButton) navigate(returnTo);
  }, [loading, me, navigate, onSuccess, hideBackButton, returnTo]);

  useEffect(() => {
    if (!loaded || loading) return;
    if (me?.isConnected) return;
    if (!shouldAutoSSO) return;
    if (autoSSO !== "idle") return;

    setAutoSSO("running");
    let cancelled = false;
    (async () => {
      const result = await openSSOPopup(ssoProviders[0]);
      if (cancelled) return;
      // Succès : la redirection est gérée par l'effect centralisé ci-dessus.
      if (result.success) return;
      // Erreur explicite (popup bloquée, échec SSO…) : on prévient l'utilisateur.
      if (result.error) {
        toast.error(t("Erreur"), { description: result.error });
      }
      /*
       * Annulation (success:false sans error) ou erreur : on bascule sur
       * "failed" → le bouton SSO manuel réapparaît pour permettre un nouvel
       * essai, sans re-déclencher la popup automatiquement en boucle.
       */
      setAutoSSO("failed");
    })();
    return () => { cancelled = true; };
  }, [loaded, loading, me, shouldAutoSSO, autoSSO, openSSOPopup, ssoProviders, t]);

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
        if (!hideBackButton) navigate(returnTo);
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
            {shouldAutoSSO && autoSSO === "running" ? (
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
                    if (!hideBackButton) navigate(returnTo);
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
                type="button"
                variant="ghost"
                onClick={() => (onSwitchToRecover ? onSwitchToRecover() : navigate("/recover-password", { state: location.state }))}
                className="text-sm text-primary hover:text-primary/80"
              >
                {t("Mot de passe oublié ?")}
              </Button>

              <div className="text-sm text-muted-foreground">
                {t("Pas encore de compte ?")} {" "}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => (onSwitchToRegister ? onSwitchToRegister() : navigate("/register", { state: location.state }))}
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
