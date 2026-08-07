import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CheckCircle, KeyRound, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCocolight } from "@/hooks/useCocolight";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/auth/i18n";

import { AuthPageLayout } from "../components/AuthPageLayout";
import { useAuthModal } from "../hooks/useAuthModal";

/**
 * Nouveau mot de passe depuis le lien de récupération reçu par e-mail
 * (`/recover/:user/:code`, émis par `PASSWORD_RECOVERY`).
 *
 * Le code est à USAGE UNIQUE et expire au bout de 24 h : c'est le backend qui
 * le vérifie et applique le mot de passe dans une seule écriture conditionnelle
 * (`PASSWORD_RESET`). Aucun message ne distingue « code faux » de
 * « code expiré » (anti-énumération) — on affiche donc le `msg` du serveur.
 *
 * ⚠️ L'appel passe par `callEndpoint` avec la constante en clair car
 * `PASSWORD_RESET` est un endpoint NEUF : il n'existe pas encore dans
 * la version publiée de la lib (`@communecter/cocolight-api-client@1.0.179`).
 * À basculer sur la méthode typée `endpointApi.passwordReset` dès la
 * prochaine publication (cf. cocolight-backend/docs/23, étage C).
 */
export default function ResetPasswordPage() {
  const { user, code } = useParams<{ user: string; code: string }>();
  const { apiClient } = useCocolight();
  const { openLogin } = useAuthModal();
  const navigate = useNavigate();
  useLoadNamespace("modules/auth");
  const t = useT("modules/auth");

  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [etat, setEtat] = useState<"idle" | "encours" | "ok" | "ko">("idle");
  const [message, setMessage] = useState("");

  const lienIncomplet = !user || !code;

  const envoyer = async (): Promise<void> => {
    if (!apiClient) {
      toast.error(t("Erreur"), { description: t("Impossible de se connecter pour le moment") });
      return;
    }
    if (motDePasse.length < 8) {
      toast.error(t("Erreur"), { description: t("Le mot de passe doit contenir au moins 8 caractères") });
      return;
    }
    if (motDePasse !== confirmation) {
      toast.error(t("Erreur"), { description: t("Les mots de passe ne correspondent pas") });
      return;
    }
    setEtat("encours");
    try {
      const reponse = await apiClient.callEndpoint("PASSWORD_RESET", {
        user,
        code,
        newPassword: motDePasse,
      });
      const corps = (reponse?.data ?? reponse) as { result?: boolean; msg?: string };
      if (corps?.result) {
        setEtat("ok");
        setMessage(corps.msg ?? "");
        toast.success(t("Mot de passe modifié"), { description: t("Vous pouvez maintenant vous connecter.") });
      } else {
        setEtat("ko");
        setMessage(corps?.msg ?? t("Le lien de récupération est invalide ou a expiré."));
      }
    } catch {
      setEtat("ko");
      setMessage(t("Le lien de récupération est invalide ou a expiré."));
    }
  };

  const seConnecter = (): void => {
    openLogin();
    navigate("/");
  };

  return (
    <AuthPageLayout
      title={{ fr: "Nouveau mot de passe", en: "New password" }}
      description={{
        fr: "Choisissez un nouveau mot de passe pour votre compte.",
        en: "Choose a new password for your account.",
      }}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        {etat === "ok" ? (
          <>
            <CheckCircle className="h-12 w-12 text-green-600" aria-hidden />
            <p className="text-muted-foreground">{message || t("Votre mot de passe a été modifié.")}</p>
            <Button onClick={seConnecter}>{t("Se connecter")}</Button>
          </>
        ) : lienIncomplet ? (
          <>
            <XCircle className="h-12 w-12 text-destructive" aria-hidden />
            <p className="text-muted-foreground">
              {t("Ce lien de récupération est incomplet. Ouvrez-le depuis l'e-mail reçu.")}
            </p>
            <Button variant="outline" onClick={() => navigate("/recover-password")}>
              {t("Renvoyer l'e-mail")}
            </Button>
          </>
        ) : (
          <>
            <KeyRound className="h-12 w-12 text-primary" aria-hidden />
            <div className="w-full space-y-3 text-left">
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={t("Nouveau mot de passe")}
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
              />
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={t("Confirmer le mot de passe")}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </div>
            {etat === "ko" && <p className="text-sm text-destructive">{message}</p>}
            <Button className="w-full" onClick={envoyer} disabled={etat === "encours"}>
              {etat === "encours" ? t("Enregistrement...") : t("Changer mon mot de passe")}
            </Button>
          </>
        )}
      </div>
    </AuthPageLayout>
  );
}
