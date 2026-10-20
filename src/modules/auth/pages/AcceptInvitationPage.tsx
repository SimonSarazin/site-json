import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CheckCircle, Loader2, UserMinus, UserPlus, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCocolight } from "@/hooks/useCocolight";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/auth/i18n";

import { AuthPageLayout } from "../components/AuthPageLayout";
import { chargeReponseParMail, lireOptionDeDemande, lireReponse } from "../lib/reponseParMail";
import { cheminFicheCible } from "../lib/ficheCible";

interface ByMailResult {
  result?: boolean;
  msg?: string;
  next?: string;
}

/**
 * Réponse depuis le lien Accepter/Refuser d'un e-mail
 * (`co2/link/validateinvitationbymail/userId/:userId/targetType/:targetType/targetId/:targetId/*`) :
 * l'INVITÉ répond à une invitation (`invitation.php`), ou un ADMINISTRATEUR tranche une DEMANDE
 * d'adhésion/d'administration (`askToBecome.php`, lien qui porte en plus `linkOption` et `key` —
 * cf. `lib/reponseParMail.ts`).
 *
 * L'action n'est déclenchée qu'AU CLIC (pas au montage) : un lien d'invitation ne porte AUCUNE clé
 * (faiblesse legacy documentée), et celui d'une demande porte sa signature en clair — dans les deux
 * cas, un déclenchement automatique laisserait un scanner anti-spam accepter/refuser à la place du
 * destinataire. La confirmation explicite ferme ce risque côté front.
 *
 * Selon la réponse `{result, msg, next}` :
 *  - `result:true` + `next` = lien `validateinvitation` (invité encore à inscrire) → on redirige vers
 *    la page de finalisation d'inscription (il pose son mot de passe) ;
 *  - `result:true` sinon → « réponse enregistrée » ;
 *  - `result:false` AVEC `next` → idempotence : l'invité avait DÉJÀ répondu (le flag n'existe plus) ;
 *  - `result:false` SANS `next` → lien invalide (user/target introuvable).
 */
export default function AcceptInvitationPage() {
  const params = useParams<{
    userId: string;
    targetType: string;
    targetId: string;
    answer?: string;
    "*"?: string;
  }>();
  const { userId, targetType, targetId } = params;
  // `answer` nommé si la route l'a capturé (formes historiques), sinon relu dans le splat.
  const answer = params.answer ?? lireReponse(params["*"]);
  // Lien d'une DEMANDE (askToBecome) : l'administrateur répond pour quelqu'un d'autre → libellés dédiés.
  const estDemande = lireOptionDeDemande(params["*"]) !== undefined;
  const { apiClient, api, me } = useCocolight();
  const navigate = useNavigate();
  useLoadNamespace("modules/auth");
  const t = useT("modules/auth");

  const [etat, setEtat] = useState<"idle" | "encours" | "ok" | "dejaRepondu" | "ko">("idle");
  const [message, setMessage] = useState("");
  // Après une acceptation, « Continuer » mène à la fiche rejointe ; sinon (refus, fiche introuvable),
  // à l'accueil.
  const [destination, setDestination] = useState("/");

  const accepte = answer === "true";
  const lienIncomplet = !userId || !targetType || !targetId || (answer !== "true" && answer !== "false");

  const repondre = async (): Promise<void> => {
    if (lienIncomplet || !apiClient) return;
    setEtat("encours");
    try {
      // callEndpoint et non userApi.validateInvitationByMail : cette méthode, écrite à la main, ne
      // déstructure que 4 champs et jetterait `linkOption`/`key` — la réponse à une DEMANDE retombait
      // alors sur `isInviting` côté backend et n'écrivait rien. Le contrat de l'endpoint n'a pas
      // `additionalProperties: false` et l'AJV du client n'a pas `removeAdditional` : les deux champs
      // traversent. Même contournement que ResetPasswordPage / useInvitationActions.
      // À rebasculer sur userApi le jour où le contrat du SDK déclarera les deux champs.
      const reponse = await apiClient.callEndpoint(
        "VALIDATE_INVITATION_BY_MAIL",
        chargeReponseParMail({ userId: userId!, targetType: targetType!, targetId: targetId!, answer: answer! }, params["*"]),
      );
      const res = (reponse?.data ?? reponse) as ByMailResult;
      // Accepter + invité pas encore inscrit → finalisation d'inscription (il pose son mot de passe).
      // On teste le préfixe `next` AVANT `result` : au 2e clic « Accepter », le back renvoie
      // result:false (isInviting déjà retiré) MAIS next reste la passerelle validateinvitation tant que
      // l'invité est pending → il faut quand même l'y router, sinon cul-de-sac « déjà répondu » sans
      // jamais pouvoir poser son mot de passe. Gardé par `accepte` pour ne pas router un refus.
      if (accepte && res?.next?.startsWith("/co2/person/validateinvitation")) {
        navigate(res.next);
        return;
      }
      if (res?.result || res?.next) {
        if (accepte) {
          // `me` porte les liens lus par le menu d'actions de la fiche : sans ce rafraîchissement, il y
          // proposerait encore « Accepter / Refuser » l'invitation qu'on vient de valider.
          // Non bloquant : la réponse est déjà enregistrée, un échec ici ne doit pas l'afficher comme ratée.
          // Indépendants : lancés ensemble, un seul aller-retour avant la confirmation.
          const [, chemin] = await Promise.all([
            Promise.resolve(me?.refresh?.()).catch(() => undefined),
            api ? cheminFicheCible(api, targetType!, targetId!).catch(() => null) : null,
          ]);
          if (chemin) setDestination(chemin);
        }
        // `next` sans `result` : idempotence, déjà répondu (user/target existent, flag retiré).
        setEtat(res?.result ? "ok" : "dejaRepondu");
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
      title={
        estDemande
          ? { fr: "Répondre à la demande", en: "Respond to the request" }
          : { fr: "Répondre à l'invitation", en: "Respond to the invitation" }
      }
      description={
        estDemande
          ? { fr: "Confirmez votre réponse à cette demande.", en: "Confirm your response to this request." }
          : { fr: "Confirmez votre réponse à cette invitation.", en: "Confirm your response to this invitation." }
      }
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
            <Button onClick={() => navigate(destination)}>{t("JoinByLink.continue")}</Button>
          </>
        ) : etat === "dejaRepondu" ? (
          <>
            <CheckCircle className="h-12 w-12 text-primary" aria-hidden />
            <p className="text-muted-foreground">
              {estDemande
                ? t("Cette demande a déjà été traitée.")
                : t("Vous aviez déjà répondu à cette invitation.")}
            </p>
            <Button variant="outline" onClick={() => navigate(destination)}>{t("JoinByLink.continue")}</Button>
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
              {estDemande
                ? accepte
                  ? t("Voulez-vous accepter cette demande ?")
                  : t("Voulez-vous refuser cette demande ?")
                : accepte
                  ? t("Voulez-vous accepter cette invitation ?")
                  : t("Voulez-vous décliner cette invitation ?")}
            </p>
            <Button onClick={repondre} disabled={etat === "encours"} variant={accepte ? "default" : "outline"}>
              {etat === "encours" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : accepte ? (
                estDemande ? t("Accepter la demande") : t("Accepter l'invitation")
              ) : estDemande ? (
                t("Refuser la demande")
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
