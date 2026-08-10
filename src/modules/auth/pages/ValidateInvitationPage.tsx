import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Loader2, XCircle, LogIn, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCocolight } from "@/hooks/useCocolight";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/auth/i18n";

import { AuthPageLayout } from "../components/AuthPageLayout";
import { useAuthModal } from "../hooks/useAuthModal";
import RegisterForm from "../components/forms/RegisterForm";

interface InvitationInfo {
  result?: boolean;
  panel?: "register" | "login";
  email?: string;
  name?: string;
  pendingUserId?: string;
  invitor?: string;
  error?: string;
  msg?: string;
}

/**
 * Validation d'un lien d'INVITATION reçu par e-mail — ≠ activation de compte (`ActivateAccountPage`).
 *
 * Forme du lien (module `auth`, chargé sur tous les sites) :
 *   `co2/person/validateinvitation/user/:user/validationKey/:validationKey[/*]`
 *   (le splat absorbe les suffixes Yii `/invitation/1`, `/costum/true`, `/redirect/…`).
 * Reste donc valide quand le domaine d'un costum pointe sur site-json — aucun changement côté envoi.
 *
 * On appelle `userApi.validateInvitation` AU MONTAGE : c'est une PASSERELLE qui **n'écrit RIEN** côté
 * serveur (contrairement à l'activation, non idempotente et appelée sur clic). Selon `panel` :
 *  - `"register"` (invité `pending`) → on affiche le formulaire d'INSCRIPTION **pré-rempli** (email
 *    verrouillé, name) ; l'invité pose son mot de passe → le register **FINALISE son compte pending**
 *    PAR EMAIL (il garde son adhésion d'invitation, pas de doublon) ;
 *  - `"login"` (compte déjà finalisé) → on propose la CONNEXION.
 */
export default function ValidateInvitationPage() {
  const { user, validationKey } = useParams<{ user: string; validationKey?: string }>();
  const { userApi } = useCocolight();
  const { openLogin } = useAuthModal();
  const navigate = useNavigate();
  useLoadNamespace("modules/auth");
  const t = useT("modules/auth");

  const [etat, setEtat] = useState<"encours" | "register" | "login" | "erreur">("encours");
  const [info, setInfo] = useState<InvitationInfo>({});

  const lienIncomplet = !user || !validationKey;

  useEffect(() => {
    if (!userApi) return; // en attente de l'init de l'API
    if (lienIncomplet) {
      setEtat("erreur");
      return;
    }
    let annule = false;
    void (async () => {
      try {
        const res = (await userApi.validateInvitation({ user: user!, validationKey: validationKey! })) as InvitationInfo;
        if (annule) return;
        setInfo(res ?? {});
        if (res?.panel === "register") setEtat("register");
        else if (res?.panel === "login") setEtat("login");
        else setEtat("erreur");
      } catch {
        if (!annule) setEtat("erreur");
      }
    })();
    return () => {
      annule = true;
    };
  }, [user, validationKey, userApi, lienIncomplet]);

  const seConnecter = (): void => {
    openLogin();
    navigate("/");
  };

  return (
    <AuthPageLayout
      title={{ fr: "Votre invitation", en: "Your invitation" }}
      description={{
        fr: "Finalisez votre inscription pour rejoindre l'espace.",
        en: "Complete your registration to join the space.",
      }}
    >
      {etat === "encours" ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <p className="text-muted-foreground">{t("Vérification de votre invitation...")}</p>
        </div>
      ) : etat === "register" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-primary">
            <MailCheck className="h-5 w-5 shrink-0" aria-hidden />
            <p className="text-sm">{t("Choisissez un mot de passe pour finaliser votre inscription.")}</p>
          </div>
          <RegisterForm prefill={{ email: info.email, name: info.name }} onSwitchToLogin={seConnecter} />
        </div>
      ) : etat === "login" ? (
        <div className="flex flex-col items-center gap-6 text-center">
          <LogIn className="h-12 w-12 text-primary" aria-hidden />
          <p className="text-muted-foreground">
            {t("Votre compte existe déjà. Connectez-vous pour continuer.")}
          </p>
          <Button onClick={seConnecter}>{t("Se connecter")}</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 text-center">
          <XCircle className="h-12 w-12 text-destructive" aria-hidden />
          <p className="text-muted-foreground">
            {lienIncomplet
              ? t("Ce lien d'invitation est incomplet. Ouvrez-le depuis l'e-mail reçu.")
              : t("Cette invitation est invalide ou a expiré.")}
          </p>
          <Button variant="outline" onClick={() => navigate("/")}>
            {t("Retour à l'accueil")}
          </Button>
        </div>
      )}
    </AuthPageLayout>
  );
}
