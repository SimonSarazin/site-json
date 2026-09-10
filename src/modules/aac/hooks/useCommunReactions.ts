import { useCallback } from "react";
import type { Answer } from "@communecter/cocolight-api-client";
import { showErrorToast } from "@/lib/toastUtils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolight } from "@/hooks/useCocolight";

export type CommunReactionType = "utilise" | "love" | "interesse";

const REACTION_PATH: Record<CommunReactionType, string> = {
  utilise: "links.contributors",
  love: "vote",
  interesse: "links.tls",
};

interface Reactor {
  id: string;
  name: string;
  type: string;
}

function getAtPath(source: unknown, path: string): Record<string, unknown> | undefined {
  const trouve = path.split(".").reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
    source
  );
  // Le type de retour n'était jusqu'ici qu'une déclaration : `reduce<any>` laissait
  // passer un scalaire trouvé au bout du chemin. On le vérifie maintenant.
  return trouve && typeof trouve === "object" ? (trouve as Record<string, unknown>) : undefined;
}

function buildReactionEntry(type: CommunReactionType, reactor: Reactor, useIsoDateSentinel: boolean): Record<string, unknown> {
  switch (type) {
    case "utilise":
      return { type: reactor.type };
    case "love":
      return { status: "love", date: useIsoDateSentinel ? "now" : new Date().toISOString() };
    case "interesse":
      return { name: reactor.name, type: reactor.type };
  }
}

export function getCommunReactionState(
  answerData: unknown,
  reactorId: string | undefined
): Record<CommunReactionType, boolean> {
  if (!reactorId || !answerData) {
    return { utilise: false, love: false, interesse: false };
  }
  return {
    utilise: Boolean(getAtPath(answerData, REACTION_PATH.utilise)?.[reactorId]),
    love: Boolean(getAtPath(answerData, REACTION_PATH.love)?.[reactorId]),
    interesse: Boolean(getAtPath(answerData, REACTION_PATH.interesse)?.[reactorId]),
  };
}

export const useCommunReactions = () => {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");
  const { api, me, entity } = useCocolight();

  const toggleReaction = useCallback(
    async (
      answerOrId: Answer | string, 
      type: CommunReactionType,
      reactorId: string,
      reactorName: string
    ): Promise<boolean | null> => {
      try {
        if (!api || !entity) throw new Error(String(t("toasts.errors.noApiClient")));
        if (!reactorId) throw new Error(String(t("toasts.errors.noReactor")));

        const answerIdStr = typeof answerOrId === "string" ? answerOrId : answerOrId.id;
        if (!answerIdStr?.trim()) throw new Error(String(t("toasts.errors.noAnswerId")));

        const answer = await api.answer({ id: String(answerIdStr) });
        const path = REACTION_PATH[type];
        const currentlyMarked = Boolean(getAtPath(answer.serverData, path)?.[reactorId]);

        const reactor: Reactor = {
          id: reactorId ?? "",
          name: reactorName ?? "",
          type: type === "interesse" ? "organizations" : "citoyens",
        };
        if (!currentlyMarked) {
          await answer.updateField(
            `${path}.${reactor.id}`,
            buildReactionEntry(type, reactor, true),
            type === "love" ? { setType: [{ path: "date", type: "isoDate" }] } : undefined
          );
          return true;
        } else {
          await answer.updateField(`${path}.${reactor.id}`, "");
          return false;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erreur inconnue";
        showErrorToast(
          error instanceof Error ? error : new Error(msg),
          "toasts.reactionFailed.title",
          t,
          { reason: msg }
        );
        return null;
      }
    },
    [api, entity, me, t]
  );

  const toggleUtilise = useCallback(
    (answerOrId: Answer | string, reactorId: string, reactorName: string) => 
      toggleReaction(answerOrId, "utilise", reactorId, reactorName), 
    [toggleReaction]
  );
  const toggleLove = useCallback(
    (answerOrId: Answer | string, reactorId: string, reactorName: string) => 
      toggleReaction(answerOrId, "love", reactorId, reactorName), 
    [toggleReaction]
  );
  const toggleInteresse = useCallback(
    (answerOrId: Answer | string, reactorId: string, reactorName: string) => 
      toggleReaction(answerOrId, "interesse", reactorId, reactorName), 
    [toggleReaction]
  );

  return { toggleUtilise, toggleLove, toggleInteresse, toggleReaction };
};