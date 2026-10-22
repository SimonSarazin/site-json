import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCocolight } from "@/hooks/useCocolight";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/auth/i18n";

import { AuthPageLayout } from "../components/AuthPageLayout";

/**
 * Retour SSO hors popup — `/sso/callback#code=<code>` ou `/sso/callback#error=<message>`.
 *
 * Le flux SSO normal se joue dans une popup et se termine par un `postMessage` (useSSOAuth). Mais le
 * retour du provider n'arrive pas toujours dans cette popup : lien de vérification d'e-mail (Keycloak
 * « Verify email ») ouvert dans un NOUVEL onglet, popup coupée de son `opener`… Dans ce cas le backend
 * (legacy `co2/views/oauth/redirect.php`, Node `sso.routes.ts`) ne peut rien poster et renvoie le
 * navigateur ICI, avec un code d'échange à usage unique (2 min) en FRAGMENT d'URL — jamais envoyé au
 * serveur, jamais journalisé. `userApi.loginWithSsoCode` le troque contre les JWT (contrat
 * `SSO_EXCHANGE`, POST /api/cocolight/ssoexchange) ; ses `postActions` posent les jetons et émettent
 * `userLoggedIn`, exactement comme un login classique — CocolightProvider fait le reste.
 *
 * L'onglet d'ORIGINE (celui de la popup) apprend la connexion par l'événement `storage`
 * (CocolightProvider) : les jetons sont dans le stockage local partagé entre onglets.
 */
export default function SsoCallbackPage() {
  const { userApi } = useCocolight();
  const navigate = useNavigate();
  useLoadNamespace("modules/auth");
  const t = useT("modules/auth");

  const [etat, setEtat] = useState<"encours" | "ko">("encours");
  const [message, setMessage] = useState<string>("");
  const lance = useRef(false);

  useEffect(() => {
    if (!userApi || lance.current) return;
    lance.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = params.get("code");
    const erreur = params.get("error");
    // Le fragment ne doit pas survivre dans l'historique ni dans un éventuel partage d'URL
    // (on conserve l'état d'historique de react-router, pas `null`).
    window.history.replaceState(window.history.state, "", window.location.pathname);

    const terminer = async () => {
      try {
        if (!code) {
          // `#error=` vient de l'URL : jamais affiché tel quel (un lien forgé afficherait n'importe quel
          // texte sous l'en-tête du site) — on ne distingue que l'annulation par l'utilisateur.
          throw new Error(erreur === "access_denied" ? t("Connexion annulée.") : t("Lien de connexion invalide ou expiré."));
        }
        await userApi.loginWithSsoCode(code);
        navigate("/", { replace: true });
      } catch (e) {
        // ApiResponseError (lib) porte le message serveur lisible : code invalide / expiré / déjà utilisé.
        const err = e as { name?: string; message?: string };
        setEtat("ko");
        setMessage(err.name === "ApiResponseError" || (!code && err.message) ? String(err.message) : t("Lien de connexion invalide ou expiré."));
      }
    };
    void terminer();
  }, [userApi, navigate, t]);

  return (
    <AuthPageLayout title={{ fr: "Connexion", en: "Sign in" }}>
      {etat === "encours" ? (
        <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>{t("Connexion en cours…")}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <XCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button type="button" onClick={() => navigate("/login", { replace: true })}>
            {t("Se connecter")}
          </Button>
        </div>
      )}
    </AuthPageLayout>
  );
}
