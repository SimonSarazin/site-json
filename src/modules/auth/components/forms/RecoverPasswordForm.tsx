import React, {
  useState,
  useEffect,
  type ChangeEvent,
} from "react";

import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useSite } from "@/hooks/useSite";
import "@/modules/auth/i18n";

import { useCocolight } from "@/hooks/useCocolight";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/helpers/isValidEmail";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { CheckCircle, ArrowLeft } from "lucide-react";

interface RecoverPasswordFormProps {
  // Mode modal : bascule vers le login interne au lieu de naviguer vers /login.
  onSwitchToLogin?: () => void;
}

export default function RecoverPasswordForm({ onSwitchToLogin }: RecoverPasswordFormProps = {}): React.ReactNode {
  /* ------------------------------------------------------------------- */
  const [email, setEmail]           = useState<string>("");
  const [loadingRecover, setLoad]   = useState<boolean>(false);
  const [emailSent, setEmailSent]   = useState<boolean>(false);

  const navigate                     = useNavigate();
  const { userApi, loading, me }     = useCocolight();
  
  const { loaded }                   = useLoadNamespace("modules/auth");
  const t                            = useT("modules/auth");
  const { config }                   = useSite();

  // Mécanisme : défaut "legacy" (le backend régénère un mdp et l'envoie par e-mail — pas de lien) ;
  // "node" (opt-in config) = flux à lien /recover/:user/:code. Pilote toute la formulation ci-dessous.
  const isNodeReset = config.auth?.recover?.mode === "node";

  const recoverTitle = config.auth?.recover?.title || { fr: "Mot de passe oublié", en: "Forgot password" };
  const recoverSubtitle =
    config.auth?.recover?.subtitle ||
    (isNodeReset
      ? { fr: "Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation", en: "Enter your email to receive a reset link" }
      : { fr: "Saisissez votre adresse e-mail : un nouveau mot de passe vous sera envoyé", en: "Enter your email: a new password will be sent to you" });

  // Clés i18n de confirmation/bouton selon le mécanisme (legacy = mdp régénéré ; node = lien de reset).
  const sentTitle = isNodeReset ? "E-mail envoyé" : "Nouveau mot de passe envoyé";
  const sentDescription = isNodeReset
    ? "Un e-mail de récupération a été envoyé à votre adresse."
    : "Un nouveau mot de passe a été envoyé à votre adresse.";
  const sentInstruction = isNodeReset
    ? "Vérifiez votre boîte de réception et suivez les instructions pour réinitialiser votre mot de passe."
    : "Connectez-vous avec ce nouveau mot de passe, puis modifiez-le depuis vos réglages.";
  const submitLabel = isNodeReset ? "Envoyer le lien de récupération" : "Réinitialiser mon mot de passe";

  /* Redirige si l’utilisateur est déjà connecté ------------------------ */
  useEffect(() => {
    if (!loading && me?.isConnected) navigate("/");
  }, [loading, me, navigate]);

  /* ------------------------------------------------------------------- */
  const handleRecoverPassword = async (): Promise<void> => {

    // Si userApi n'est pas encore prêt, on arrête
    if (!userApi) {
      toast.error(t("Erreur"), {
        description: t("Impossible de se connecter pour le moment"),
      });
      return;
    }

    if (!email) {
      toast.error(t("Erreur"), {
        description: t("Veuillez saisir votre adresse e-mail"),
      });
      return;
    }

    if (!isValidEmail(email)) {
      toast.error(t("Erreur"), {
        description: t("L'adresse e-mail n'est pas valide"),
      });
      return;
    }

    setLoad(true);

    try {
      const response = await userApi.recoverPassword(email);

      if (response.result) {
        setEmailSent(true);
        toast.success(t(sentTitle), {
          description: t(sentDescription),
        });
      } else if (response.errId === "UNKNOWN_ACCOUNT_ID") {
        toast.error(t("Compte introuvable"), {
          description: t("Aucun compte n'est associé à cette adresse e-mail."),
        });
      } else {
        toast.error(t("Erreur"), {
          description:
            response.msg ||
            t("Une erreur est survenue lors de l'envoi de l'e-mail"),
        });
      }
    } catch (err: unknown) {
      /* Extraction facultative du message d'erreur --------------------- */
      const msg =
        (err as { response?: { data?: { msg?: string } } }).response?.data?.msg ||
        (err as Error).message ||
        t("Une erreur est survenue lors de l'envoi de l'e-mail");

      toast.error(t("Erreur"), {
        description: msg,
      });
    } finally {
      setLoad(false);
    }
  };

  /* ------------------------------------------------------------------- */
  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (emailSent) {
    return (
      <div className="w-full space-y-6 p-4 rounded-lg bg-card">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">
            {t(sentTitle)}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t(sentDescription)} <strong>{email}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            {t(sentInstruction)}
          </p>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={() => (onSwitchToLogin ? onSwitchToLogin() : navigate("/login"))}
            variant="default"
            size="lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("Retour à la connexion")}
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              setEmailSent(false);
              setEmail("");
            }}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {t("Renvoyer l'e-mail")}
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------- */
  return (
    <div className="w-full space-y-6 p-4 rounded-lg bg-card">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          {t(recoverTitle)}
        </h2>
        <p className="text-muted-foreground">
          {t(recoverSubtitle)}
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleRecoverPassword();
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

        <Button
          className="w-full"
          type="submit"
          disabled={loadingRecover}
          variant="default"
          size="lg"
        >
          {loadingRecover
            ? t("Envoi en cours...")
            : t(submitLabel)}
        </Button>

        <div className="text-center space-y-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => (onSwitchToLogin ? onSwitchToLogin() : navigate("/login"))}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("Retour à la connexion")}
          </Button>

          {/* "Retour à l'accueil" : sans objet en modal (la croix ferme). */}
          {!onSwitchToLogin && (
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
