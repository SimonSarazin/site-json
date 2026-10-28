import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  type ChangeEvent,
} from "react";
import cocolightApiClient from "@communecter/cocolight-api-client";

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
  // Mode modal : bascule interne au lieu de naviguer vers /register et /recover-password
  // (routes.tsx les enregistre pour tous les sites ; seule /recover/:user/:code dépend de config.auth.recover.mode).
  onSwitchToRegister?: () => void;
  /** Reçoit l'e-mail saisi, pour préremplir la récupération. */
  onSwitchToRecover?: (email?: string) => void;
}

export default function LoginForm({ onSuccess, hideBackButton = false, onSwitchToRegister, onSwitchToRecover }: LoginFormProps = {}): React.ReactNode {
  const [email, setEmail]           = useState<string>("");
  const [password, setPassword]     = useState<string>("");
  const [remember, setRemember]     = useState<boolean>(false);
  const [loadingLogin, setLoading]  = useState<boolean>(false);

  /*
   * Double authentification (cocolight-backend docs/34-2FA-LOT1.md). Après un mot de passe correct
   * sur un compte SOUMIS, le serveur ne connecte pas : il répond par un défi (401 twoFactorRequired,
   * levé par la lib en `TwoFactorRequiredError`) et envoie un code par e-mail. On affiche alors
   * l'étape « code » à la place du formulaire ; `verifyTwoFactor` termine la connexion exactement
   * comme `login` (jetons posés par la lib). La règle « compte soumis » vit côté serveur : un site
   * dont aucun compte n'est soumis ne voit jamais cette étape.
   */
  // `expireAtMs` / `resendAtMs` : horloge LOCALE (ms). Le serveur rend `expireAt` en epoch secondes ; un
  // défi vivant de moins de 60 s est RÉUTILISÉ tel quel (même expireAt, pas de nouveau mail), donc le
  // temps restant et le délai avant renvoi se déduisent d'expireAt (TTL 5 min, 60 s entre deux envois).
  const [twoFactor, setTwoFactor]   = useState<{ challenge: string; sentTo: string; expireAtMs: number; resendAtMs: number } | null>(null);
  const [code, setCode]             = useState<string>("");
  const [twoFactorMsg, setTwoFactorMsg] = useState<{ text: string; tone: "error" | "info" } | null>(null);
  const [now, setNow]               = useState<number>(() => Date.now());
  const [verifying, setVerifying]   = useState<boolean>(false);
  const resending                   = useRef<boolean>(false);

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
  const twoFactorTitle = config.auth?.twoFactor?.title || { fr: "Vérification en deux étapes", en: "Two-step verification" };
  const twoFactorHelp = config.auth?.twoFactor?.help;

  // Une seule horloge pendant l'étape « code » : délai avant renvoi (60 s entre deux envois) et temps
  // restant avant expiration du défi (5 min). Un intervalle, nettoyé au démontage et en StrictMode.
  useEffect(() => {
    if (!twoFactor) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [twoFactor]);
  const resendIn  = twoFactor ? Math.max(0, Math.ceil((twoFactor.resendAtMs - now) / 1000)) : 0;
  const expiresIn = twoFactor ? Math.max(0, Math.floor((twoFactor.expireAtMs - now) / 1000)) : 0;

  // Défi expiré côté client : on ne laisse pas saisir un code que le serveur refusera (challengeExpired).
  useEffect(() => {
    if (!twoFactor || expiresIn > 0) return;
    setTwoFactor(null);
    setCode("");
    setTwoFactorMsg(null);
    toast.error(t("Erreur"), { description: t("Ce code n'est plus valable, reconnectez-vous") });
  }, [twoFactor, expiresIn, t]);

  /**
   * Ouvre l'étape « code » depuis le défi rendu par le serveur. `expireAt` (epoch s) sert à placer les
   * deux comptes à rebours : un défi neuf expire dans 300 s et autorise un renvoi dans 60 s ; un défi
   * RÉUTILISÉ (reconnexion < 60 s : même défi, pas de nouveau mail) expire plus tôt et se renvoie plus
   * tôt. Hors de cette fenêtre (horloge du poste décalée), on retombe sur les valeurs d'un défi neuf.
   */
  const openTwoFactor = (challenge: string, sentTo: string, expireAt: number): void => {
    const TTL = 300_000;
    const RESEND = 60_000;
    const nowMs = Date.now();
    let expireAtMs = expireAt * 1000;
    if (!(expireAtMs - nowMs > 0 && expireAtMs - nowMs <= TTL)) expireAtMs = nowMs + TTL;
    const sentAtMs = expireAtMs - TTL;
    setTwoFactor({ challenge, sentTo, expireAtMs, resendAtMs: sentAtMs + RESEND });
    setCode("");
    setTwoFactorMsg(null);
  };

  /** Refus SERVEUR (`{error}` / `{result:false}`), par opposition au serveur injoignable (réseau, breaker, file). */
  const isServerRefusal = (err: unknown): err is { message: string; responseData?: Record<string, unknown> } =>
    err instanceof cocolightApiClient.error.ApiResponseError;

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
        // Les jetons sont posés et `userLoggedIn` est émis par les postActions du contrat
        // (AUTHENTICATE_URL), que CocolightProvider écoute : rien à émettre ici — un second `emit`
        // faisait tourner deux fois le rafraîchissement de `me`/`entity` (vérifié : requêtes en double).
        onSuccess?.();
        if (!hideBackButton) navigate(returnTo);
      }
    } catch (err: unknown) {
      /* Compte soumis au second facteur : on passe à l'étape « code », sans erreur. */
      if (err instanceof cocolightApiClient.error.TwoFactorRequiredError) {
        openTwoFactor(err.challenge, err.sentTo, err.expireAt);
        return;
      }

      /* Compte soumis SANS mot de passe (créé « par code e-mail ») : le serveur refuse avec passwordMissing, sans
         défi ni mail. Un « identifiants incorrects » serait sans issue : on explique et on propose la récupération. */
      if (err instanceof cocolightApiClient.error.PasswordMissingError) {
        // Le texte suit le MODE de récupération du site : legacy (défaut) = un nouveau mot de passe est ENVOYÉ par e-mail ;
        // node = un lien permet de le DÉFINIR (cf. RecoverPasswordForm).
        const isNodeReset = config.auth?.recover?.mode === "node";
        toast.error(t("Pas encore de mot de passe"), {
          description: isNodeReset
            ? t("Ce compte n'a pas encore de mot de passe. Définissez-en un avec « Mot de passe oublié », puis connectez-vous avec votre mot de passe et un code")
            : t("Ce compte n'a pas encore de mot de passe. Demandez-en un avec « Mot de passe oublié », il vous sera envoyé par e-mail, puis connectez-vous avec ce mot de passe et un code"),
          duration: 10000,
          action: {
            label: isNodeReset ? t("Définir un mot de passe") : t("Recevoir un mot de passe"),
            onClick: () => (onSwitchToRecover ? onSwitchToRecover(email) : navigate("/recover-password", { state: { ...(location.state ?? {}), email } })),
          },
        });
        return;
      }

      /* On extrait le status si présent, sinon on retombe sur le message  */
      const e = err as { status?: number; message?: string; response?: { status?: number }; responseData?: { retryIn?: number } };
      const status = e.status ?? e.response?.status;

      const msg =
        e.message === "twoFactorMailFailed"
          ? t("Le code n'a pas pu être envoyé par e-mail, réessayez plus tard")
          : e.message === "twoFactorTooMany"
            ? t("Trop de tentatives, réessayez dans {{minutes}} min", undefined, { minutes: Math.max(1, Math.ceil((e.responseData?.retryIn ?? 900) / 60)) })
            : status === 401 || status === 404
              ? t("Email ou mot de passe incorrect")
              : status === 429
                ? t("Trop de tentatives, réessayez plus tard")
                : isServerRefusal(err)
                  ? (err as Error).message
                  : t("Impossible de se connecter pour le moment");

      toast.error(t("Erreur"), {
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  /* Seconde étape : le code reçu par e-mail ------------------------------- */
  const handleVerify = async (): Promise<void> => {
    if (!twoFactor || !userApi || verifying) return;
    const trimmed = code.trim();
    if (!/^[0-9]{6}$/.test(trimmed)) {
      setTwoFactorMsg({ text: t("Code incorrect"), tone: "error" });
      return;
    }
    setVerifying(true);
    try {
      await userApi.verifyTwoFactor(twoFactor.challenge, trimmed);
      if (userApi.isConnected) {
        // Même suite que `login` : TWO_FACTOR_VERIFY porte les mêmes postActions (jetons + userLoggedIn).
        setTwoFactor(null);
        onSuccess?.();
        if (!hideBackButton) navigate(returnTo);
      } else {
        setTwoFactorMsg({ text: t("Impossible de se connecter pour le moment"), tone: "error" });
      }
    } catch (err: unknown) {
      if (!isServerRefusal(err)) {
        // Réseau coupé, breaker ouvert, requête mise en file : le défi et le code restent valables.
        setTwoFactorMsg({ text: t("Impossible de se connecter pour le moment"), tone: "error" });
        return;
      }
      if (err.message === "codeInvalid") {
        const left = err.responseData?.attemptsLeft;
        setTwoFactorMsg({
          text: typeof left === "number"
            ? t("Code incorrect, il vous reste {{count}} essai(s)", undefined, { count: left })
            : t("Code incorrect"),
          tone: "error",
        });
        return;
      }
      if (err.message !== "challengeExpired") {
        // Autre refus serveur (p. ex. limiteur de requêtes) : le défi tient toujours, on l'affiche en place.
        setTwoFactorMsg({ text: err.message, tone: "error" });
        return;
      }
      // challengeExpired (inconnu, 5 min passées, déjà utilisé, 5 échecs) : on repart du mot de passe.
      setTwoFactor(null);
      setCode("");
      toast.error(t("Erreur"), { description: t("Ce code n'est plus valable, reconnectez-vous") });
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    if (!twoFactor || !userApi || resendIn > 0 || verifying || resending.current) return;
    resending.current = true; // un double clic = une seule requête
    const setResendIn = (seconds: number) =>
      setTwoFactor((tf) => (tf ? { ...tf, resendAtMs: Date.now() + seconds * 1000 } : tf));
    try {
      await userApi.resendTwoFactor(twoFactor.challenge);
      setCode("");
      setResendIn(60);
      setTwoFactorMsg({ text: t("Un nouveau code vient d'être envoyé"), tone: "info" });
    } catch (err: unknown) {
      if (!isServerRefusal(err)) {
        setTwoFactorMsg({ text: t("Impossible de se connecter pour le moment"), tone: "error" });
        return;
      }
      switch (err.message) {
        case "resendTooSoon": {
          const retryIn = Math.max(1, Math.round(Number(err.responseData?.retryIn ?? 60)));
          setResendIn(retryIn);
          setTwoFactorMsg({ text: t("Patientez encore {{seconds}} s avant de renvoyer un code", undefined, { seconds: retryIn }), tone: "info" });
          return;
        }
        case "resendLimit":
          setTwoFactorMsg({ text: t("Plus de renvoi possible, le dernier code reçu reste valable"), tone: "info" });
          return;
        case "resendTooLate":
          setTwoFactorMsg({ text: t("Trop tard pour renvoyer un code, reconnectez-vous"), tone: "info" });
          return;
        case "twoFactorMailFailed":
          setTwoFactorMsg({ text: t("Le code n'a pas pu être envoyé par e-mail, réessayez plus tard"), tone: "error" });
          return;
        case "challengeExpired":
          setTwoFactor(null);
          setCode("");
          toast.error(t("Erreur"), { description: t("Ce code n'est plus valable, reconnectez-vous") });
          return;
        default:
          setTwoFactorMsg({ text: err.message, tone: "error" });
      }
    } finally {
      resending.current = false;
    }
  };

  const handleBack = (): void => {
    setTwoFactor(null);
    setCode("");
    setTwoFactorMsg(null);
    setPassword("");
  };

  /* --------------------------------------------------------------------- */
  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (twoFactor) {
    return (
      <div className="w-full space-y-6 p-4 rounded-lg bg-card" data-testid="two-factor-step">
        <div className="text-center">
          <h2 className="text-3xl text-foreground font-bold mb-2">
            {t(twoFactorTitle)}
          </h2>
          <p className="text-muted-foreground">
            {twoFactorHelp
              ? t(twoFactorHelp)
              : t("Un code à 6 chiffres a été envoyé à {{sentTo}}. Saisissez-le pour terminer votre connexion.", undefined, { sentTo: twoFactor.sentTo })}
          </p>
          {twoFactorHelp && twoFactor.sentTo && (
            <p className="text-sm text-muted-foreground">{twoFactor.sentTo}</p>
          )}
          <p className="text-xs text-muted-foreground" data-testid="two-factor-validity">
            {t("Code valable encore {{minutes}} min", undefined, { minutes: Math.max(1, Math.ceil(expiresIn / 60)) })}
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleVerify();
          }}
        >
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            autoFocus
            aria-label={t("Code de vérification")}
            aria-invalid={twoFactorMsg?.tone === "error" ? true : undefined}
            aria-describedby={twoFactorMsg ? "two-factor-message" : undefined}
            placeholder={t("Code de vérification")}
            value={code}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              // Pas de `maxLength` : il tronquerait un collage AVANT le retrait des espaces (« 123 456 »).
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              if (twoFactorMsg?.tone === "error") setTwoFactorMsg(null);
            }}
            className="h-12 text-center text-2xl tracking-[0.5em]"
          />

          {twoFactorMsg && (
            <p
              id="two-factor-message"
              role={twoFactorMsg.tone === "error" ? "alert" : "status"}
              className={twoFactorMsg.tone === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
            >
              {twoFactorMsg.text}
            </p>
          )}

          <Button className="w-full" type="submit" disabled={verifying || code.length !== 6} variant="default" size="lg">
            {verifying ? t("Vérification...") : t("Valider le code")}
          </Button>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={resendIn > 0 || verifying}
              onClick={() => void handleResend()}
              className="text-sm text-primary hover:text-primary/80"
            >
              {resendIn > 0
                ? t("Renvoyer le code ({{seconds}} s)", undefined, { seconds: resendIn })
                : t("Renvoyer le code")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t("Retour")}
            </Button>
          </div>
        </form>
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
                onClick={() => (onSwitchToRecover ? onSwitchToRecover(email || undefined) : navigate("/recover-password", { state: { ...(location.state ?? {}), ...(email ? { email } : {}) } }))}
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
