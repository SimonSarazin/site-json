/**
 * Page wiki (MediaWiki) d'un événement — voir `server/api/wiki-event.js`.
 *
 * Ordre imposé par la sécurité : le lien est d'abord écrit dans la description (le backend refuse
 * si l'utilisateur n'a pas le droit d'éditer), PUIS le serveur crée la page avec son compte robot
 * après avoir relu la description. Ne pas inverser.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Event } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { PROFIL_QUERY_KEYS } from "../../constants/queryKeys";

const WIKI_LINK_LABEL = "Voir le compte rendu de l'événement sur le wiki";

interface WikiPlan {
  title: string;
  url: string;
}

async function lirePlan(eventId: string): Promise<WikiPlan> {
  const r = await fetch(`/api/wiki/event/${eventId}/plan`);
  if (!r.ok) throw new Error(`wiki indisponible (${r.status})`);
  return r.json();
}

/** Titre et URL de la page. En erreur (503 : wiki non configuré), le bouton se masque. */
export function useEventWikiPlan(event: Event | null, enabled: boolean) {
  return useQuery({
    queryKey: ["wiki-event-plan", event?.id],
    queryFn: () => lirePlan(event!.id as string),
    enabled: enabled && !!event?.id,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useCreateEventWikiPage(event: Event | null, plan: WikiPlan | undefined) {
  const queryClient = useQueryClient();
  const { me } = useCocolight();

  return useMutationWithToast<WikiPlan, void>({
    namespace: "modules/profil",
    successKey: "toast.element.wikiPageSuccess",
    errorKey: "toast.element.wikiPageError",
    mutationFn: async () => {
      if (!event || !plan) throw new Error("No event provided");
      const token = me?.apiClient?.getToken?.();
      if (!token) throw new Error("not authenticated");

      const description = typeof event.serverData?.description === "string" ? event.serverData.description : "";
      const lien = `[${WIKI_LINK_LABEL}](${plan.url})`;
      if (!description.includes(lien)) {
        // Retire l'ancienne ligne « Documentation de la rencontre : <url brute> » d'une version précédente.
        const reste = description
          .split("\n")
          .filter((l) => !l.startsWith("Documentation de la rencontre"))
          .join("\n")
          .trim();
        await event.updateDescription({ description: reste ? `${reste}\n\n${lien}` : lien });
      }

      const r = await fetch(`/api/wiki/event/${event.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`wiki: ${r.status}`);
      return (await r.json()) as WikiPlan;
    },
    onSuccessCallback: (page) => {
      window.open(page.url, "_blank", "noopener");
      if (event) queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(event.slug) });
    },
  });
}
