import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CheckCircle, LogIn, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getApiClient } from "@/lib/apiClient";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/auth/i18n";

import { AuthPageLayout } from "../components/AuthPageLayout";
import { useAuthModal } from "../hooks/useAuthModal";
import { useAuthActions } from "../hooks/useAuthActions";

/**
 * Consommation d'un lien d'invitation partageable (`/co2/link/connect/ref/:ref`).
 *
 * Sert la MÊME URL que le legacy PHP, pour que les liens déjà diffusés (costum.invitationLink /
 * invitationLinkAsMember, 341 costums) restent valides quand le domaine du costum pointe sur
 * site-json (cf. cocolight-backend/docs/25 §4 — c'est le pendant de l'étage A des liens d'e-mail).
 *
 * Rejoindre EXIGE d'être connecté (connectByUrl a besoin de l'userId) : si le visiteur ne l'est pas,
 * on l'invite à se connecter/s'inscrire (openLogin), puis il revient sur ce lien. L'appel passe par
 * `callEndpoint("CONNECT_BY_REF")` (endpoint neuf, absent de la lib publiée 1.0.179 — à basculer sur
 * la méthode typée `connectByRef` à la prochaine publication).
 */
export default function JoinByLinkPage() {
  const { ref } = useParams<{ ref: string }>();
  const { isConnected } = useAuthActions();
  const { openLogin } = useAuthModal();
  const navigate = useNavigate();
  useLoadNamespace("modules/auth");
  const t = useT("modules/auth");

  const [etat, setEtat] = useState<"idle" | "encours" | "ok" | "ko">("idle");
  const [message, setMessage] = useState("");

  const rejoindre = async (): Promise<void> => {
    if (!ref) return;
    setEtat("encours");
    try {
      const client = await getApiClient();
      const res = await client.callEndpoint("CONNECT_BY_REF", { pathParams: { ref } });
      const body = (res?.data ?? res) as { result?: boolean; error?: string; msg?: string };
      if (body?.result) {
        setEtat("ok");
        toast.success(t("JoinByLink.joined"));
      } else {
        setEtat("ko");
        setMessage(body?.msg ?? t("JoinByLink.failed"));
      }
    } catch {
      setEtat("ko");
      setMessage(t("JoinByLink.failed"));
    }
  };

  return (
    <AuthPageLayout
      title={{ fr: "Rejoindre", en: "Join" }}
      description={{ fr: "Rejoignez cette communauté via votre lien d'invitation.", en: "Join this community via your invitation link." }}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        {!ref ? (
          <>
            <XCircle className="h-12 w-12 text-destructive" aria-hidden />
            <p className="text-muted-foreground">{t("JoinByLink.badLink")}</p>
            <Button variant="outline" onClick={() => navigate("/")}>{t("Retour à l'accueil")}</Button>
          </>
        ) : etat === "ok" ? (
          <>
            <CheckCircle className="h-12 w-12 text-green-600" aria-hidden />
            <p className="text-muted-foreground">{t("JoinByLink.joined")}</p>
            <Button onClick={() => navigate("/")}>{t("JoinByLink.continue")}</Button>
          </>
        ) : etat === "ko" ? (
          <>
            <XCircle className="h-12 w-12 text-destructive" aria-hidden />
            <p className="text-muted-foreground">{message}</p>
            <Button variant="outline" onClick={() => navigate("/")}>{t("Retour à l'accueil")}</Button>
          </>
        ) : !isConnected ? (
          <>
            <LogIn className="h-12 w-12 text-primary" aria-hidden />
            <p className="text-muted-foreground">{t("JoinByLink.signInFirst")}</p>
            <Button onClick={() => openLogin()}>{t("Se connecter")}</Button>
          </>
        ) : (
          <>
            <UserPlus className="h-12 w-12 text-primary" aria-hidden />
            <p className="text-muted-foreground">{t("JoinByLink.confirm")}</p>
            <Button onClick={rejoindre} disabled={etat === "encours"}>
              {etat === "encours" ? t("JoinByLink.joining") : t("JoinByLink.join")}
            </Button>
          </>
        )}
      </div>
    </AuthPageLayout>
  );
}
