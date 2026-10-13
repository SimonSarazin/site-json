// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import cocolightApiClient from "@communecter/cocolight-api-client";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";
import { creationErrorCodeOf, parseSpace } from "../lib/space";
import { useCreateDiscussion } from "./useCreateDiscussion";
import type { DiscussionSpace, DiscussionThread, SpaceRef } from "../types";

/**
 * Créer une discussion supplémentaire sur un commun.
 *
 * L'appel au serveur est la frontière ; React Query, le hook et la lecture de la réponse sont les
 * vrais. Ce que cette suite tient, et qui ne se voit pas à la lecture :
 *   - la requête ne porte que quatre valeurs, et aucune n'est un chemin ;
 *   - la discussion créée est dans la liste AVANT d'être rendue à l'appelant — qui va l'ouvrir ;
 *   - un refus arrive en EXCEPTION du SDK, et ressort en code, jamais en texte du serveur.
 */

const COMMUN = "65c3000000000000000000c1";
const APPEL = "65c3000000000000000000f1";
const UTILISATEUR = "65d4000000000000000000d1";
const ESPACE: SpaceRef = { type: "answers", id: COMMUN };
const CLE = COMMENT_QUERY_KEYS.DISCUSSIONS("space", `answers:${COMMUN}`, UTILISATEUR);

const CHEMIN = `${APPEL}.moreDiscussions_93015AbCdEfGh.${COMMUN}.discu_121020269301512.comment`;
const CLE_DU_FIL = `forms:${APPEL}:${CHEMIN}`;
/** Le fil créé, tel que le serveur le rend : les quatorze champs d'un fil d'espace. */
const FIL_CREE = {
  key: CLE_DU_FIL, contextType: "forms", contextId: APPEL, path: CHEMIN, total: 0, unread: 0, last: null, mine: false,
  title: "Budget 2026", carrier: null, virtual: true, kind: "discussion", group: null, audience: "authorAdmin",
};

/** L'espace déjà en cache : le fil général, et le droit de créer. */
const LISTE: DiscussionSpace = parseSpace({
  result: true,
  space: { type: "answers", id: COMMUN, title: "Un commun", formId: APPEL },
  canComment: true,
  creatableAudiences: ["authorAll", "authorAdmin"],
  truncated: false,
  threads: [
    { key: `answers:${COMMUN}`, contextType: "answers", contextId: COMMUN, path: null, total: 3, unread: 0, last: 1_758_000_000, mine: false, title: null, carrier: null, virtual: false, kind: "general", group: null, audience: null },
  ],
});

/** Un refus tel que la façade du SDK le REND : une exception, le corps du serveur dans `responseData`. */
const refusDuSdk = (code: string) => async (): Promise<never> => {
  throw new cocolightApiClient.error.ApiResponseError("Texte du serveur.", 200, { result: false, code, msg: "Texte du serveur." });
};

function monter(reponse: (corps: Record<string, unknown>) => Promise<unknown>, { enCache = true } = {}) {
  const createDiscussion = vi.fn(reponse);
  const cocolight = {
    api: { createDiscussion }, me: { isConnected: true }, entity: { userContext: { id: UTILISATEUR } }, helper: {},
  } as unknown as CocolightContextType;
  const client = new QueryClient();
  if (enCache) client.setQueryData(CLE, LISTE);
  const relire = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client },
      createElement(CocolightContext.Provider, { value: cocolight }, children));
  const rendu = renderHook(() => useCreateDiscussion(ESPACE), { wrapper });
  const enCacheMaintenant = () => client.getQueryData<DiscussionSpace>(CLE)?.threads.map(thread => thread.key) ?? null;
  return { ...rendu, createDiscussion, client, relire, enCacheMaintenant };
}

describe("useCreateDiscussion", () => {
  it("envoie au serveur l'espace, le nom et l'audience — et rien d'autre : aucun chemin", async () => {
    const { result, createDiscussion } = monter(async () => ({ result: true, thread: FIL_CREE }));
    await act(async () => { await result.current.mutateAsync({ name: "Budget 2026", audience: "authorAdmin" }); });
    // Le schéma de requête du SDK est fermé : une clé de trop serait refusée avant de partir.
    expect(createDiscussion).toHaveBeenCalledTimes(1);
    expect(createDiscussion).toHaveBeenCalledWith({ contextType: "answers", contextId: COMMUN, name: "Budget 2026", audience: "authorAdmin" });
  });

  it("rend le fil créé, prêt à être ouvert", async () => {
    const { result } = monter(async () => ({ result: true, thread: FIL_CREE }));
    let cree: DiscussionThread | null = null;
    await act(async () => { cree = await result.current.mutateAsync({ name: "Budget 2026", audience: "authorAdmin" }); });
    expect(cree).toMatchObject({
      key: CLE_DU_FIL, target: { type: "forms", id: APPEL, path: CHEMIN }, title: "Budget 2026",
      kind: "discussion", audience: "authorAdmin", virtual: true,
    });
  });

  it("pose la discussion dans la liste AVANT de la rendre à l'appelant — il va l'ouvrir aussitôt", async () => {
    // Le panneau ne monte un fil que si la liste le porte : ouvert avant, il dirait « introuvable ».
    const { result, enCacheMaintenant } = monter(async () => ({ result: true, thread: FIL_CREE }));
    let auRetour: readonly string[] | null = null;
    act(() => {
      result.current.mutate({ name: "Budget 2026", audience: "authorAdmin" }, { onSuccess: () => { auRetour = enCacheMaintenant(); } });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(auRetour).toEqual([`answers:${COMMUN}`, CLE_DU_FIL]);
  });

  it("puis relit la liste : c'est le serveur qui dit où elle se range, et ce qu'elle est devenue", async () => {
    const { result, relire } = monter(async () => ({ result: true, thread: FIL_CREE }));
    await act(async () => { await result.current.mutateAsync({ name: "Budget 2026", audience: "authorAdmin" }); });
    expect(relire).toHaveBeenCalledWith({ queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX() });
  });

  it("sans liste en cache, n'en fabrique pas une : la relecture la rendra", async () => {
    const { result, client, relire } = monter(async () => ({ result: true, thread: FIL_CREE }), { enCache: false });
    await act(async () => { await result.current.mutateAsync({ name: "Budget 2026", audience: "authorAdmin" }); });
    expect(client.getQueryData(CLE)).toBeUndefined();
    expect(relire).toHaveBeenCalledTimes(1);
  });

  it.each(["forbidden", "bad-name", "too-many", "hidden"])(
    "un refus `%s` du serveur ressort par son code, sans toucher à la liste", async code => {
      const { result, enCacheMaintenant, relire } = monter(refusDuSdk(code));
      act(() => { result.current.mutate({ name: "Budget 2026", audience: "authorAdmin" }); });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(creationErrorCodeOf(result.current.error)).toBe(code);
      expect(enCacheMaintenant()).toEqual([`answers:${COMMUN}`]);
      // La liste est relue même après un refus : il dit peut-être que le droit de créer a changé.
      expect(relire).toHaveBeenCalledTimes(1);
    });

  it("sans session, le SDK refuse lui-même : c'est un refus `login`", async () => {
    const { result } = monter(async () => {
      throw new cocolightApiClient.error.ApiAuthenticationError("Vous devez être connecté pour effectuer cette action.", 401);
    });
    act(() => { result.current.mutate({ name: "Budget 2026", audience: "authorAdmin" }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(creationErrorCodeOf(result.current.error)).toBe("login");
  });

  const SANS_CREATION: ReadonlyArray<readonly [string, () => Promise<unknown>, string]> = [
    ["une panne de réseau", async () => { throw new Error("Network Error"); }, "failed"],
    ["une requête que le schéma refuse", async () => { throw new cocolightApiClient.error.ApiValidationError("Request validation failed.", 400, ["name"]); }, "failed"],
    ["un échec d'écriture dit par le serveur", refusDuSdk("failed"), "failed"],
    ["une réponse illisible", async () => "<html>Maintenance</html>", "unreadable"],
    ["une réponse sans fil", async () => ({ result: true }), "unreadable"],
  ];
  it.each(SANS_CREATION)("%s : la liste n'est pas touchée, mais elle est RELUE — on ne sait pas toujours si la création a eu lieu", async (_cas, reponse, code) => {
    const { result, enCacheMaintenant, relire } = monter(reponse);
    act(() => { result.current.mutate({ name: "Budget 2026", audience: "authorAdmin" }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(creationErrorCodeOf(result.current.error)).toBe(code);
    expect(enCacheMaintenant()).toEqual([`answers:${COMMUN}`]);
    expect(relire).toHaveBeenCalledWith({ queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX() });
  });

  it("n'essaie qu'UNE fois : une création rejouée d'elle-même pourrait créer deux discussions", async () => {
    const { result, createDiscussion } = monter(async () => { throw new Error("Network Error"); });
    act(() => { result.current.mutate({ name: "Budget 2026", audience: "authorAdmin" }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(createDiscussion).toHaveBeenCalledTimes(1);
  });
});
