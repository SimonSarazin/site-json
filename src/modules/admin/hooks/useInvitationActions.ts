import { useState } from "react";
import { toast } from "sonner";

import { getApiClient } from "@/lib/apiClient";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { withSiteCostumParams } from "@/lib/siteCostum";

/**
 * Actions de la campagne d'invitation (docs/24 §2, backend docs/25) :
 *  - génération d'un lien d'invitation partageable (CREATE_INVITATION_LINK) ;
 *  - relance d'une invitation à un compte encore en attente (RELAUNCH_INVITATION).
 *
 * ⚠️ Les deux endpoints sont NEUFS : ils n'existent pas encore dans la version publiée de la lib.
 * On passe donc par `apiClient.callEndpoint(<constante>)` (comme PASSWORD_RESET). À basculer sur
 * `endpointApi.createInvitationLink` / `endpointApi.relaunchInvitation` à la prochaine publication.
 *
 * Les deux aboutissent à un e-mail (relance) ou fabriquent un lien qui partira par e-mail : leur
 * charge utile porte donc le contexte costum du site. Sans lui, le legacy brande au générique et,
 * surtout, construit le lien sur SON hôte au lieu de `costum.host` — un lien d'invitation qui pointe
 * ailleurs que sur le site est un lien mort pour l'invité.
 * `withSiteCostumParams` ne pose le trio que si le contrat EMBARQUÉ dans la lib installée déclare
 * `costumSlug` : les schémas de requête sont validés par AJV en `additionalProperties:false` AVANT
 * l'envoi, l'ajouter en aveugle casserait l'appel tant que la lib publiée ignore le champ.
 */
export function useInvitationActions() {
  const { contextId, contextType } = useCocolight();
  const t = useT("modules/admin");
  const [busy, setBusy] = useState(false);

  /** Génère un lien partageable (member ou admin) et le renvoie ; copie dans le presse-papier si possible. */
  const generateInvitationLink = async (isAdmin: boolean): Promise<string | null> => {
    if (!contextId || !contextType) {
      toast.error(t("AdminInvitation.error"), { description: t("AdminInvitation.noContext") });
      return null;
    }
    setBusy(true);
    try {
      const client = await getApiClient();
      const res = await client.callEndpoint(
        "CREATE_INVITATION_LINK",
        withSiteCostumParams(
          client,
          "CREATE_INVITATION_LINK",
          {
            targetType: contextType,
            targetId: contextId,
            isAdmin: isAdmin ? "true" : "false",
          },
          { contextId, contextType },
        ),
      );
      const body = (res?.data ?? res) as { result?: { link?: string } | false };
      const link = body && body.result && typeof body.result === "object" ? body.result.link : undefined;
      if (!link) {
        toast.error(t("AdminInvitation.error"), { description: t("AdminInvitation.linkFailed") });
        return null;
      }
      try {
        await navigator.clipboard?.writeText(link);
        toast.success(t("AdminInvitation.linkCopied"));
      } catch {
        toast.success(t("AdminInvitation.linkReady"));
      }
      return link;
    } catch {
      toast.error(t("AdminInvitation.error"), { description: t("AdminInvitation.linkFailed") });
      return null;
    } finally {
      setBusy(false);
    }
  };

  /** Relance l'invitation d'un compte en attente. */
  const relaunchInvitation = async (userId: string): Promise<boolean> => {
    setBusy(true);
    try {
      const client = await getApiClient();
      const res = await client.callEndpoint(
        "RELAUNCH_INVITATION",
        withSiteCostumParams(client, "RELAUNCH_INVITATION", { id: userId }, { contextId, contextType }),
      );
      const body = (res?.data ?? res) as { result?: boolean; msg?: string };
      if (body?.result) {
        toast.success(t("AdminInvitation.relaunchSent"));
        return true;
      }
      toast.error(t("AdminInvitation.error"), { description: body?.msg ?? t("AdminInvitation.relaunchFailed") });
      return false;
    } catch {
      toast.error(t("AdminInvitation.error"), { description: t("AdminInvitation.relaunchFailed") });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { generateInvitationLink, relaunchInvitation, busy };
}
