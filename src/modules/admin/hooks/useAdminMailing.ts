import { useState } from "react";
import { toast } from "sonner";

import { getApiClient } from "@/lib/apiClient";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { withSiteCostumParams } from "@/lib/siteCostum";

import type { MailingRecipient } from "../lib/mailing";

/**
 * Envoi d'un mailing d'admin (ADMIN_MAILING_SEND → `co2/mailmanagement/createandsend`, tpl `basic`).
 *
 * Même patron que `useInvitationActions` : `callEndpoint` + `withSiteCostumParams` (le contexte costum du site
 * est ce qui brande le mail et pose `source.key` sur le job ; et c'est le costumSlug que le backend Node utilise
 * pour la garde « admin du costum »). `consent: "marketing"` (oracle legacy F6, docs/37 P5) : c'est ce marqueur qui
 * fait appliquer le consentement du destinataire et poser le lien « ne plus recevoir de mail » PAR LE SERVEUR, legacy
 * comme Node ; le client n'envoie jamais de btnRedirect.
 *
 * Deux formes d'échec à traiter : `{result:false, msg}` (Node, 200) et une exception (legacy : HTTP 450 sur
 * « Missing email! », ou refus AJV du contrat avant le réseau).
 */
export function useAdminMailing() {
  const { contextId, contextType } = useCocolight();
  const t = useT("modules/admin");
  const [busy, setBusy] = useState(false);

  const sendMailing = async (subject: string, html: string, recipients: MailingRecipient[]): Promise<boolean> => {
    if (recipients.length === 0) {
      toast.warning(t("AdminMailing.noRecipient"));
      return false;
    }
    setBusy(true);
    try {
      const client = await getApiClient();
      const res = await client.callEndpoint(
        "ADMIN_MAILING_SEND",
        withSiteCostumParams(
          client,
          "ADMIN_MAILING_SEND",
          { tpl: "basic", consent: "marketing", tplObject: subject, tplMail: recipients.map((r) => r.value), html },
          { contextId, contextType },
        ),
      );
      const body = (res?.data ?? res) as { result?: boolean; msg?: string };
      if (body?.result) {
        toast.success(t("AdminMailing.sent", undefined, { count: String(recipients.length) }));
        return true;
      }
      toast.error(t("AdminMailing.error"), { description: body?.msg ?? t("AdminMailing.failed") });
      return false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(t("AdminMailing.error"), { description: msg || t("AdminMailing.failed") });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { sendMailing, busy };
}
