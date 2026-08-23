import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CheckCircle, XCircle, MailCheck, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCocolight } from "@/hooks/useCocolight";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/auth/i18n";

import { AuthPageLayout } from "../components/AuthPageLayout";
import { useAuthModal } from "../hooks/useAuthModal";
import { useAuthActions } from "../hooks/useAuthActions";

/**
 * Validation de compte depuis un lien d'e-mail.
 *
 * Sert les DEUX formes de liens en circulation (cf. cocolight-backend/docs/23) :
 *  - backend Node : `/validate/:user/:validationKey`
 *  - legacy PHP   : `/co2/person/activate/user/:user/validationKey/:validationKey/*`
 *    (le splat absorbe les suffixes Yii `/costum/true`, `/redirect/…`, `/toredirect/…`)
 * Les e-mails déjà envoyés restent donc valides quand le domaine d'un costum
 * pointe sur site-json — aucun changement côté envoi.
 *
 * On passe par `endpointApi.personActivate`, donc par la garde `callNoConnected`
 * du contrat (`onlyAuthNone`) : c'est VOULU. Un visiteur ne peut pas être
 * connecté AVEC le compte qu'il valide — `canUserLogin` refuse la connexion tant
 * que `roles.tobeactivated` est posé (backend `src/auth/roles.ts:20`, port de
 * `Role::canUserLogin`). Le seul cas où un token existe est un AUTRE compte
 * ouvert dans le même navigateur : on le traite explicitement (déconnexion
 * proposée) plutôt que de valider un compte sous la session d'autrui.
 *
 * L'activation part sur un CLIC, jamais au montage : c'est une mutation non
 * idempotente et les scanners anti-spam suivent les liens des e-mails.
 */
export default function ActivateAccountPage() {
  const { user, validationKey } = useParams<{ user: string; validationKey?: string }>();
  const { api } = useCocolight();
  const { isConnected, logout } = useAuthActions();
  const { openLogin } = useAuthModal();
  const navigate = useNavigate();
  useLoadNamespace("modules/auth");
  const t = useT("modules/auth");

  const [etat, setEtat] = useState<"idle" | "encours" | "ok" | "ko">("idle");
  const [message, setMessage] = useState<string>("");

  const lienIncomplet = !user || !validationKey;

  const activer = async (): Promise<void> => {
    if (!api) {
      toast.error(t("Erreur"), { description: t("Impossible de se connecter pour le moment") });
      return;
    }
    setEtat("encours");
    try {
      const corps = (await api.endpointApi.personActivate({ user: user!, validationKey: validationKey! })) as {
        result?: boolean;
        msg?: string;
      };
      if (corps?.result) {
        setEtat("ok");
        setMessage(corps.msg ?? "");
        toast.success(t("Compte validé"), { description: t("Vous pouvez maintenant vous connecter.") });
      } else {
        setEtat("ko");
        setMessage(corps?.msg ?? t("Le lien de validation est invalide ou a expiré."));
      }
    } catch {
      setEtat("ko");
      setMessage(t("Le lien de validation est invalide ou a expiré."));
    }
  };

  const seConnecter = (): void => {
    openLogin();
    navigate("/");
  };

  return (
    <AuthPageLayout
      title={{ fr: "Validation de votre compte", en: "Account activation" }}
      description={{
        fr: "Confirmez la validation de votre compte pour pouvoir vous connecter.",
        en: "Confirm your account activation to be able to sign in.",
      }}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        {etat === "ok" ? (
          <>
            <CheckCircle className="h-12 w-12 text-green-600" aria-hidden />
            <p className="text-muted-foreground">{message || t("Votre compte est validé.")}</p>
            <Button onClick={seConnecter}>{t("Se connecter")}</Button>
          </>
        ) : etat === "ko" ? (
          <>
            <XCircle className="h-12 w-12 text-destructive" aria-hidden />
            <p className="text-muted-foreground">{message}</p>
            <Button variant="outline" onClick={() => navigate("/")}>
              {t("Retour à l'accueil")}
            </Button>
          </>
        ) : lienIncomplet ? (
          <>
            <XCircle className="h-12 w-12 text-destructive" aria-hidden />
            <p className="text-muted-foreground">
              {t("Ce lien de validation est incomplet. Ouvrez-le depuis l'e-mail reçu.")}
            </p>
            <Button variant="outline" onClick={() => navigate("/")}>
              {t("Retour à l'accueil")}
            </Button>
          </>
        ) : isConnected ? (
          /* Un autre compte est ouvert dans ce navigateur : on ne valide pas sous sa session. */
          <>
            <LogOut className="h-12 w-12 text-primary" aria-hidden />
            <p className="text-muted-foreground">
              {t("Un compte est déjà connecté dans ce navigateur. Déconnectez-vous pour valider ce compte.")}
            </p>
            <Button onClick={logout}>{t("Se déconnecter")}</Button>
          </>
        ) : (
          <>
            <MailCheck className="h-12 w-12 text-primary" aria-hidden />
            <p className="text-muted-foreground">{t("Cliquez pour confirmer la validation de votre compte.")}</p>
            <Button onClick={activer} disabled={etat === "encours"}>
              {etat === "encours" ? t("Validation...") : t("Valider mon compte")}
            </Button>
          </>
        )}
      </div>
    </AuthPageLayout>
  );
}
