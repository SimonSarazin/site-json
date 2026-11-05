import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CheckCircle, XCircle, MailX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { getApiClient } from "@/lib/apiClient";
import { getSlug } from "@/lib/constant/common";
import "@/modules/auth/i18n";

import { AuthPageLayout } from "../components/AuthPageLayout";

/**
 * « Ne plus recevoir de mail » — lien posé au pied des mailings d'admin (backend docs/36).
 *
 * Forme du lien, construite PAR LE SERVEUR à l'enqueue sur le domaine du costum, comme les liens
 * d'activation : `/co2/person/unsubscribe/user/:user/validationKey/:validationKey/costum/<slug>` (le splat
 * absorbe `/costum/<slug>`, relu ici ; à défaut, le site courant). La clé est une signature HMAC : la page ne
 * fait que la rapporter au backend (`MAIL_UNSUBSCRIBE`), qui la vérifie.
 *
 * Deux portées : « ce site » (défaut) retire le site de l'opt-in mail du compte ; « toute la plateforme » pose
 * en plus le refus global, que le legacy honore déjà à l'envoi. L'action part sur un CLIC, jamais au montage :
 * les scanners anti-spam suivent les liens des e-mails. Fonctionne connecté ou non (le lien vient d'une boîte
 * mail ; un autre compte ouvert dans le navigateur n'y change rien, la clé désigne le compte).
 *
 * Appel par `callEndpoint` (pas `endpointApi.mailUnsubscribe`) : la page ne doit pas planter si la lib
 * installée est antérieure à 1.0.207 — elle affiche alors l'erreur.
 */
export default function UnsubscribePage() {
  const params = useParams<{ user: string; validationKey?: string; "*"?: string }>();
  const { user, validationKey } = params;
  const splat = params["*"] ?? "";
  const slugDuLien = /(?:^|\/)costum\/([A-Za-z0-9_-]{1,64})(?:\/|$)/.exec(splat)?.[1];
  const siteSlug = getSlug();
  const costumSlug = slugDuLien ?? (siteSlug && siteSlug !== "default" ? siteSlug : undefined);
  const navigate = useNavigate();
  useLoadNamespace("modules/auth");
  const t = useT("modules/auth");

  const [scope, setScope] = useState<"site" | "all">(costumSlug ? "site" : "all");
  const [etat, setEtat] = useState<"idle" | "encours" | "ok" | "ko">("idle");
  const [message, setMessage] = useState("");

  const lienIncomplet = !user || !validationKey;

  const confirmer = async (): Promise<void> => {
    setEtat("encours");
    try {
      const client = await getApiClient();
      const res = await client.callEndpoint("MAIL_UNSUBSCRIBE", {
        user: user!,
        validationKey: validationKey!,
        scope,
        ...(costumSlug ? { costumSlug } : {}),
      });
      const corps = (res?.data ?? res) as { result?: boolean; msg?: string };
      if (corps?.result) {
        setEtat("ok");
        toast.success(t("Préférence enregistrée"));
      } else {
        setEtat("ko");
        setMessage(corps?.msg ?? t("Ce lien de désinscription est invalide ou a expiré."));
      }
    } catch (e) {
      setEtat("ko");
      setMessage(e instanceof Error && e.message ? e.message : t("Ce lien de désinscription est invalide ou a expiré."));
    }
  };

  return (
    <AuthPageLayout
      title={{ fr: "Ne plus recevoir de mails", en: "Unsubscribe from emails" }}
      description={{
        fr: "Confirmez votre choix : vous ne recevrez plus les e-mails envoyés par les responsables de ce site.",
        en: "Confirm your choice: you will no longer receive emails sent by the managers of this site.",
      }}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        {etat === "ok" ? (
          <>
            <CheckCircle className="h-12 w-12 text-green-600" aria-hidden />
            <p className="text-muted-foreground">{t("Votre choix est enregistré.")}</p>
            <Button variant="outline" onClick={() => navigate("/")}>{t("Retour à l'accueil")}</Button>
          </>
        ) : etat === "ko" ? (
          <>
            <XCircle className="h-12 w-12 text-destructive" aria-hidden />
            <p className="text-muted-foreground">{message}</p>
            <Button variant="outline" onClick={() => navigate("/")}>{t("Retour à l'accueil")}</Button>
          </>
        ) : lienIncomplet ? (
          <>
            <XCircle className="h-12 w-12 text-destructive" aria-hidden />
            <p className="text-muted-foreground">{t("Ce lien de désinscription est incomplet. Ouvrez-le depuis l'e-mail reçu.")}</p>
            <Button variant="outline" onClick={() => navigate("/")}>{t("Retour à l'accueil")}</Button>
          </>
        ) : (
          <>
            <MailX className="h-12 w-12 text-primary" aria-hidden />
            <RadioGroup value={scope} onValueChange={(v) => setScope(v === "all" ? "all" : "site")} className="text-left">
              {costumSlug && (
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="site" id="unsub-site" />
                  <Label htmlFor="unsub-site">{t("Ne plus recevoir les e-mails de ce site")}</Label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <RadioGroupItem value="all" id="unsub-all" />
                <Label htmlFor="unsub-all">{t("Ne plus recevoir aucun e-mail de la plateforme")}</Label>
              </div>
            </RadioGroup>
            <Button onClick={() => void confirmer()} disabled={etat === "encours"} data-testid="unsubscribe-confirm">
              {etat === "encours" ? t("Enregistrement...") : t("Confirmer")}
            </Button>
          </>
        )}
      </div>
    </AuthPageLayout>
  );
}
