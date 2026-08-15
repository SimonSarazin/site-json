import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CheckCircle, Loader2, UserMinus, UserPlus, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCocolight } from "@/hooks/useCocolight";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/auth/i18n";

import { AuthPageLayout } from "../components/AuthPageLayout";

interface ByMailResult {
  result?: boolean;
  msg?: string;
  next?: string;
}

/**
 * Réponse à une invitation depuis le lien Accepter/Refuser d'un e-mail
 * (`co2/link/validateinvitationbymail/userId/:userId/targetType/:targetType/targetId/:targetId/answer/:answer[/*]`).
 *
 * L'action n'est déclenchée qu'AU CLIC (pas au montage) : le lien ne porte AUCUNE `validationKey`
 * (faiblesse legacy documentée) — un déclenchement automatique laisserait un scanner anti-spam
 * accepter/refuser à la place de l'invité. La confirmation explicite ferme ce risque côté front.
 *
 * Selon la réponse `{result, msg, next}` :
 *  - `result:true` + `next` = lien `validateinvitation` (invité encore à inscrire) → on redirige vers
 *    la page de finalisation d'inscription (il pose son mot de passe) ;
 *  - `result:true` sinon → « réponse enregistrée » ;
 *  - `result:false` AVEC `next` → idempotence : l'invité avait DÉJÀ répondu (le flag n'existe plus) ;
 *  - `result:false` SANS `next` → lien invalide (user/target introuvable).
 */
export default function AcceptInvitationPage() {
  const { userId, targetType, targetId, answer } = useParams<{
    userId: string;
    targetType: string;
    targetId: string;
    answer: string;
  }>();
  const { userApi } = useCocolight();
  const navigate = useNavigate();
  useLoadNamespace("modules/auth");
  const t = useT("modules/auth");

  const [etat, setEtat] = useState<"idle" | "encours" | "ok" | "dejaRepondu" | "ko">("idle");
  const [message, setMessage] = useState("");

  const accepte = answer === "true";
  const lienIncomplet = !userId || !targetType || !targetId || (answer !== "true" && answer !== "false");

  const repondre = async (): Promise<void> => {
    if (lienIncomplet || !userApi) return;
    setEtat("encours");
    try {
      const res = (await userApi.validateInvitationByMail({
        userId: userId!,
        targetType: targetType!,
        targetId: targetId!,
        answer: answer as "true" | "false",
      })) as ByMailResult;
      // Accepter + invité pas encore inscrit → finalisation d'inscription (il pose son mot de passe).
      // On teste le préfixe `next` AVANT `result` : au 2e clic « Accepter », le back renvoie
      // result:false (isInviting déjà retiré) MAIS next reste la passerelle validateinvitation tant que
      // l'invité est pending → il faut quand même l'y router, sinon cul-de-sac « déjà répondu » sans
      // jamais pouvoir poser son mot de passe. Gardé par `accepte` pour ne pas router un refus.
      if (accepte && res?.next?.startsWith("/co2/person/validateinvitation")) {
        navigate(res.next);
        return;
      }
      if (res?.result) {
        setEtat("ok");
      } else if (res?.next) {
        setEtat("dejaRepondu"); // idempotence : déjà répondu (user/target existent, flag retiré)
      } else {
        setEtat("ko");
        setMessage(res?.msg ?? t("Impossible d'enregistrer votre réponse."));
      }
    } catch {
      setEtat("ko");
      setMessage(t("Impossible d'enregistrer votre réponse."));
    }
  };

  return (
    <AuthPageLayout
      title={{ fr: "Répondre à l'invitation", en: "Respond to the invitation" }}
      description={{
        fr: "Confirmez votre réponse à cette invitation.",
        en: "Confirm your response to this invitation.",
      }}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        {lienIncomplet ? (
          <>
            <XCircle className="h-12 w-12 text-destructive" aria-hidden />
            <p className="text-muted-foreground">
              {t("Ce lien de réponse est incomplet. Ouvrez-le depuis l'e-mail reçu.")}
            </p>
            <Button variant="outline" onClick={() => navigate("/")}>{t("Retour à l'accueil")}</Button>
          </>
        ) : etat === "ok" ? (
          <>
            <CheckCircle className="h-12 w-12 text-green-600" aria-hidden />
            <p className="text-muted-foreground">{t("Votre réponse a été enregistrée.")}</p>
            <Button onClick={() => navigate("/")}>{t("JoinByLink.continue")}</Button>
          </>
        ) : etat === "dejaRepondu" ? (
          <>
            <CheckCircle className="h-12 w-12 text-primary" aria-hidden />
            <p className="text-muted-foreground">{t("Vous aviez déjà répondu à cette invitation.")}</p>
            <Button variant="outline" onClick={() => navigate("/")}>{t("JoinByLink.continue")}</Button>
          </>
        ) : etat === "ko" ? (
          <>
            <XCircle className="h-12 w-12 text-destructive" aria-hidden />
            <p className="text-muted-foreground">{message}</p>
            <Button variant="outline" onClick={() => navigate("/")}>{t("Retour à l'accueil")}</Button>
          </>
        ) : (
          <>
            {accepte ? (
              <UserPlus className="h-12 w-12 text-primary" aria-hidden />
            ) : (
              <UserMinus className="h-12 w-12 text-muted-foreground" aria-hidden />
            )}
            <p className="text-muted-foreground">
              {accepte
                ? t("Voulez-vous accepter cette invitation ?")
                : t("Voulez-vous décliner cette invitation ?")}
            </p>
            <Button onClick={repondre} disabled={etat === "encours"} variant={accepte ? "default" : "outline"}>
              {etat === "encours" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : accepte ? (
                t("Accepter l'invitation")
              ) : (
                t("Décliner l'invitation")
              )}
            </Button>
          </>
        )}
      </div>
    </AuthPageLayout>
  );
}
