// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import cocolightApiClient from "@communecter/cocolight-api-client";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";
import { errorCodeOf } from "../lib/discussions";
import { useDiscussionSpaceQuery, type UseDiscussionSpaceQueryOptions } from "./useDiscussionSpaceQuery";
import type { SpaceRef } from "../types";

// Le flux temps réel est une frontière : sans hub, il est « dégradé » — le cas de tout déploiement
// sans temps réel, où l'intervalle court s'applique. On retient seulement s'il est DEMANDÉ.
const tempsReelDemande = vi.fn();
vi.mock("./useDiscussionsRealtime", () => ({
  useDiscussionsRealtime: (actif: boolean) => { tempsReelDemande(actif); return "degrade"; },
}));

/**
 * L'appel au serveur est la frontière ; React Query, le hook et la lecture de la réponse sont les
 * vrais. Ce que cette suite garantit, et qui ne se voit pas à la lecture :
 *   - le bouton d'une fiche ne SONDE pas — une requête par fiche ouverte dans un onglet, toutes les
 *     trente secondes, pour un espace que personne ne regarde ;
 *   - un refus n'est jamais réessayé, et la liste suit ce qui invalide le panneau général ;
 *   - la requête attend de savoir QUI lit : une seule demande par montage, rangée sous sa clé.
 */

const COMMUN = "65c3000000000000000000c1";
const APPEL = "65c3000000000000000000f1";
const UTILISATEUR = "65d4000000000000000000d1";
const ESPACE: SpaceRef = { type: "answers", id: COMMUN };

/** La clé de cache de cet espace, pour ce lecteur (`null` : un visiteur). */
const cleDe = (lecteur: string | null) => COMMENT_QUERY_KEYS.DISCUSSIONS("space", `answers:${COMMUN}`, lecteur);

const REPONSE = {
  result: true,
  space: { type: "answers", id: COMMUN, title: "Un commun", formId: APPEL },
  canComment: true,
  truncated: false,
  // Les quatorze champs qu'un fil porte dans la réponse du serveur.
  threads: [
    { key: `answers:${COMMUN}`, contextType: "answers", contextId: COMMUN, path: null, total: 3, unread: 1, last: 1_758_000_000, mine: false, title: null, carrier: null, virtual: false, kind: "general", group: null, audience: null },
    { key: `forms:${APPEL}:q`, contextType: "forms", contextId: APPEL, path: "q", total: 2, unread: 2, last: 1_758_000_100, mine: false, title: "Une question", carrier: null, virtual: false, kind: "question", group: "Proposition", audience: null },
  ],
};

/**
 * Un refus tel que la façade du SDK le REND : une EXCEPTION, le corps du serveur rangé dans
 * `responseData` — jamais ce corps en valeur de retour (mesuré contre le SDK réel le 09/10).
 */
const refusDuSdk = (corps: { readonly code?: string; readonly msg?: string }) => async (): Promise<never> => {
  throw new cocolightApiClient.error.ApiResponseError(corps.msg ?? "Erreur inconnue", 200, { result: false, ...corps });
};

interface Montage {
  readonly reponse?: () => Promise<unknown>;
  readonly space?: SpaceRef | null;
  readonly options?: UseDiscussionSpaceQueryOptions;
  /** Qui est connecté AU MONTAGE. Par défaut : personne, un visiteur. */
  readonly utilisateur?: string | null;
}

function monter({ reponse = async () => REPONSE, space = ESPACE, options, utilisateur = null }: Montage = {}) {
  const getDiscussionSpace = vi.fn(reponse);
  // La session, modifiable d'un rendu à l'autre : c'est elle que la clé de cache porte.
  const session = { entity: (utilisateur ? { userContext: { id: utilisateur } } : null) as { userContext: { id: string } } | null };
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => {
    const cocolight = { api: { getDiscussionSpace }, me: null, entity: session.entity, helper: {} } as unknown as CocolightContextType;
    return createElement(QueryClientProvider, { client },
      createElement(CocolightContext.Provider, { value: cocolight }, children));
  };
  // Chaque rendu, dans l'ordre. Le PREMIER est celui d'avant les effets : `result.current` ne le
  // montre plus, alors que c'est lui que l'écran affiche d'abord.
  const rendus: { isLoading: boolean; fetchStatus: string }[] = [];
  const rendu = renderHook(() => {
    const requete = useDiscussionSpaceQuery(space, options);
    rendus.push({ isLoading: requete.isLoading, fetchStatus: requete.fetchStatus });
    return requete;
  }, { wrapper });
  return { getDiscussionSpace, client, session, wrapper, rendus, ...rendu };
}

describe("useDiscussionSpaceQuery", () => {
  beforeEach(() => { vi.useFakeTimers(); tempsReelDemande.mockClear(); });
  afterEach(() => { vi.useRealTimers(); });

  it("demande au serveur l'espace de CE commun, et rien de plus", async () => {
    const { getDiscussionSpace } = monter();
    await vi.advanceTimersByTimeAsync(0);
    // Le schéma de requête du SDK est fermé : une clé de trop serait refusée avant de partir.
    expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
    expect(getDiscussionSpace).toHaveBeenCalledWith({ contextType: "answers", contextId: COMMUN });
  });

  it("rend les fils dans l'ordre du serveur, le titre, le droit d'écrire et les totaux", async () => {
    const { result } = monter();
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current.threads.map(t => t.kind)).toEqual(["general", "question"]);
    expect(result.current).toMatchObject({ title: "Un commun", canComment: true, truncated: false, total: 5, unread: 3 });
  });

  it("avant la réponse, ne prétend rien : aucun fil, aucun compteur, pas le droit d'écrire ni de créer", () => {
    const { result } = monter({ reponse: () => new Promise(() => {}) });
    expect(result.current).toMatchObject({ threads: [], title: null, canComment: false, creatableAudiences: [], total: 0, unread: 0 });
  });

  it("rend les audiences que le serveur annonce à ce lecteur pour une discussion qu'il crée", async () => {
    const { result } = monter({ reponse: async () => ({ ...REPONSE, creatableAudiences: ["authorAll", "authorAdmin"] }) });
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current.creatableAudiences).toEqual(["authorAll", "authorAdmin"]);
  });

  it("aucune quand le serveur n'en annonce pas", async () => {
    const { result } = monter();
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current.creatableAudiences).toEqual([]);
  });

  it("ne SONDE pas par défaut — le bouton d'une fiche n'a besoin que d'un compteur", async () => {
    const { getDiscussionSpace } = monter();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(95_000);
    expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
    // Et il ne s'abonne pas davantage au flux partagé.
    expect(tempsReelDemande).toHaveBeenLastCalledWith(false);
  });

  it("ouvert à l'écran (`live`), il se relit au rythme du mode dégradé", async () => {
    const { getDiscussionSpace } = monter({ options: { live: true } });
    await vi.advanceTimersByTimeAsync(0);
    expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(getDiscussionSpace).toHaveBeenCalledTimes(2);
    expect(tempsReelDemande).toHaveBeenLastCalledWith(true);
  });

  it("ne réessaie JAMAIS un refus, même ouvert à l'écran", async () => {
    const { getDiscussionSpace, result } = monter({
      reponse: refusDuSdk({ code: "hidden", msg: "Espace de discussion introuvable." }),
      options: { live: true },
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current.isError).toBe(true);
    expect(errorCodeOf(result.current.error)).toBe("hidden");
    await vi.advanceTimersByTimeAsync(95_000);
    expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
  });

  it("réessaie deux fois un échec réseau avant de le dire", async () => {
    const { getDiscussionSpace, result } = monter({ reponse: async () => { throw new Error("Network Error"); } });
    await vi.advanceTimersByTimeAsync(0);
    // Les délais de React Query entre deux tentatives : 1 s, puis 2 s.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(getDiscussionSpace).toHaveBeenCalledTimes(3);
    expect(result.current.isError).toBe(true);
    expect(errorCodeOf(result.current.error)).toBe("failed");
  });

  /**
   * React Query garde la dernière liste servie à travers une erreur de relecture. Ce qu'on en fait
   * dépend de ce que l'erreur veut dire — et c'est ICI que cela se décide, pour le bouton d'une
   * fiche comme pour le panneau.
   */
  describe("une relecture qui tourne mal", () => {
    /** La première demande aboutit ; les suivantes rendent `ensuite`. */
    const puis = (ensuite: () => Promise<unknown>) => {
      let appels = 0;
      return () => (appels++ === 0 ? Promise.resolve(REPONSE) : ensuite());
    };

    it("un REFUS retire ce qu'on avait : ni liste, ni fils, ni compteurs, ni droit d'écrire", async () => {
      const { result, getDiscussionSpace } = monter({
        reponse: puis(refusDuSdk({ code: "hidden", msg: "Espace de discussion introuvable." })),
        options: { live: true },
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(result.current).toMatchObject({ total: 5, unread: 3, canComment: true });

      await vi.advanceTimersByTimeAsync(31_000);
      expect(getDiscussionSpace).toHaveBeenCalledTimes(2);
      expect(errorCodeOf(result.current.error)).toBe("hidden");
      expect(result.current.data).toBeUndefined();
      expect(result.current).toMatchObject({ threads: [], title: null, canComment: false, creatableAudiences: [], truncated: false, total: 0, unread: 0 });
    });

    it("une PANNE la garde : la liste, ses compteurs et le droit d'écrire restent ceux de la dernière réponse", async () => {
      const { result, getDiscussionSpace } = monter({
        reponse: puis(async () => { throw new Error("Network Error"); }),
        options: { live: true },
      });
      await vi.advanceTimersByTimeAsync(0);
      // Une relecture, puis ses deux nouvelles tentatives (1 s, 2 s).
      await vi.advanceTimersByTimeAsync(31_000 + 10_000);
      expect(getDiscussionSpace.mock.calls.length).toBeGreaterThanOrEqual(4);
      expect(errorCodeOf(result.current.error)).toBe("failed");
      expect(result.current.data).toBeDefined();
      expect(result.current).toMatchObject({ title: "Un commun", canComment: true, total: 5, unread: 3 });
      expect(result.current.threads).toHaveLength(2);
    });

    it("une réponse ILLISIBLE est une panne, pas un refus : la liste reste, et la relecture CONTINUE", async () => {
      // Une page d'erreur servie en HTTP 200 : le SDK la rend telle quelle, ce n'est pas un objet.
      const { result, getDiscussionSpace } = monter({
        reponse: puis(async () => "<html>Maintenance</html>"),
        options: { live: true },
      });
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(31_000 + 10_000);
      expect(errorCodeOf(result.current.error)).toBe("unreadable");
      expect(result.current.data).toBeDefined();
      expect(result.current).toMatchObject({ total: 5, unread: 3, canComment: true });
      // Réessayée (deux fois), puis relue à l'intervalle suivant : un refus, lui, n'aurait plus rien demandé.
      const apresLaPanne = getDiscussionSpace.mock.calls.length;
      expect(apresLaPanne).toBeGreaterThanOrEqual(4);
      await vi.advanceTimersByTimeAsync(31_000);
      expect(getDiscussionSpace.mock.calls.length).toBeGreaterThan(apresLaPanne);
    });

    it("le droit de créer suit la même règle : retiré par un refus, gardé à travers une panne", async () => {
      const AVEC_DROIT = { ...REPONSE, creatableAudiences: ["authorAll", "authorAdmin"] };
      let appels = 0;
      const refuse = monter({
        reponse: () => (appels++ === 0 ? Promise.resolve(AVEC_DROIT) : refusDuSdk({ code: "hidden" })()),
        options: { live: true },
      });
      let lectures = 0;
      const enPanne = monter({
        reponse: () => (lectures++ === 0 ? Promise.resolve(AVEC_DROIT) : Promise.reject(new Error("Network Error"))),
        options: { live: true },
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(refuse.result.current.creatableAudiences).toEqual(["authorAll", "authorAdmin"]);
      await vi.advanceTimersByTimeAsync(31_000 + 10_000);
      expect(refuse.result.current.creatableAudiences).toEqual([]);
      expect(enPanne.result.current.isError).toBe(true);
      expect(enPanne.result.current.creatableAudiences).toEqual(["authorAll", "authorAdmin"]);
    });

    it("illisible dès la PREMIÈRE lecture : réessayée deux fois, puis dite — sans rien à montrer", async () => {
      const { result, getDiscussionSpace } = monter({ reponse: async () => ({ result: true }) });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(getDiscussionSpace).toHaveBeenCalledTimes(3);
      expect(errorCodeOf(result.current.error)).toBe("unreadable");
      expect(result.current.data).toBeUndefined();
    });
  });

  it("n'appelle rien sans espace, ni quand on le désactive", async () => {
    const sansEspace = monter({ space: null });
    const desactive = monter({ options: { enabled: false } });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sansEspace.getDiscussionSpace).not.toHaveBeenCalled();
    expect(desactive.getDiscussionSpace).not.toHaveBeenCalled();
    // Au repos, pas en échec : une requête lancée sans espace tournerait à l'erreur en silence.
    expect(sansEspace.result.current).toMatchObject({ fetchStatus: "idle", isError: false });
    expect(desactive.result.current).toMatchObject({ fetchStatus: "idle", isError: false });
    // Désactivé, il ne s'abonne pas non plus au temps réel, même déclaré « ouvert ».
    monter({ options: { enabled: false, live: true } });
    expect(tempsReelDemande).toHaveBeenLastCalledWith(false);
  });

  it("le bouton et la modale partagent la même entrée de cache : ouverte aussitôt, elle ne redemande rien", async () => {
    const { getDiscussionSpace, wrapper } = monter();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10_000);
    // La modale, ouverte par-dessus le bouton : même espace, même session, mais `live`.
    renderHook(() => useDiscussionSpaceQuery(ESPACE, { live: true }), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
  });

  it("ouverte plus de trente secondes après, la modale relit — le compteur du bouton avait vieilli", async () => {
    const { getDiscussionSpace, wrapper } = monter();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
    renderHook(() => useDiscussionSpaceQuery(ESPACE, { live: true }), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(getDiscussionSpace).toHaveBeenCalledTimes(2);
  });

  it("dit quand le serveur a coupé la liste", async () => {
    const { result } = monter({ reponse: async () => ({ ...REPONSE, truncated: true }) });
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current.truncated).toBe(true);
  });

  it("suit ce qui invalide le panneau général — poster un message met le compteur à jour", async () => {
    const { getDiscussionSpace, client } = monter();
    await vi.advanceTimersByTimeAsync(0);
    await act(async () => {
      await client.invalidateQueries({ queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX() });
    });
    expect(getDiscussionSpace).toHaveBeenCalledTimes(2);
  });

  it("se recharge à la connexion : la clé porte l'utilisateur, ses non-lus et son audience changent", async () => {
    const { getDiscussionSpace, session, rerender } = monter();
    await vi.advanceTimersByTimeAsync(0);
    expect(getDiscussionSpace).toHaveBeenCalledTimes(1);

    session.entity = { userContext: { id: UTILISATEUR } };
    rerender();
    await vi.advanceTimersByTimeAsync(0);
    expect(getDiscussionSpace).toHaveBeenCalledTimes(2);
  });

  /**
   * `useHydratedUserContextId` rend `null` au premier rendu de CHAQUE montage, puis qui est
   * connecté. Partie dès ce premier rendu, la requête d'un connecté était faite deux fois — la
   * première sous une clé qui n'était pas la sienne.
   */
  describe("l'attente de savoir qui lit", () => {
    it("connecté, ne demande l'espace qu'UNE fois, et le range sous SA clé", async () => {
      const { getDiscussionSpace, client } = monter({ utilisateur: UTILISATEUR });
      await vi.advanceTimersByTimeAsync(0);
      expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
      expect(client.getQueryData(cleDe(UTILISATEUR))).toBeDefined();
      // Une seule entrée remplie, celle du lecteur : la clé sans utilisateur n'a rien reçu.
      expect(client.getQueryData(cleDe(null))).toBeUndefined();
    });

    it("un visiteur aussi ne le demande qu'une fois, sous la clé du visiteur", async () => {
      const { getDiscussionSpace, client } = monter();
      await vi.advanceTimersByTimeAsync(0);
      expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
      expect(client.getQueryData(cleDe(null))).toBeDefined();
    });

    it("au premier rendu, CHARGE sans rien avoir demandé — l'écran n'a pas à dire « vide » ni « introuvable »", async () => {
      const { rendus, getDiscussionSpace } = monter({ reponse: () => new Promise(() => {}), utilisateur: UTILISATEUR });
      expect(rendus[0]).toEqual({ isLoading: true, fetchStatus: "idle" });
      // Au rendu suivant, la requête est partie pour de bon.
      await vi.advanceTimersByTimeAsync(0);
      expect(rendus[rendus.length - 1]).toEqual({ isLoading: true, fetchStatus: "fetching" });
      expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
    });

    it("au premier rendu, CHARGE même si une liste est déjà en cache sous la clé de ce rendu-là", async () => {
      // Un visiteur : la clé ne change pas d'un rendu à l'autre, et le bouton a déjà rempli le cache.
      // Ce rendu d'attente ne sait pas encore QUI lit — un connecté y passerait par la clé du
      // visiteur, et monterait le fil sur une liste qui n'est pas la sienne.
      const { wrapper, getDiscussionSpace } = monter();
      await vi.advanceTimersByTimeAsync(0);
      const rendus: { isLoading: boolean; fils: number }[] = [];
      renderHook(() => {
        const requete = useDiscussionSpaceQuery(ESPACE);
        rendus.push({ isLoading: requete.isLoading, fils: requete.threads.length });
        return requete;
      }, { wrapper });
      expect(rendus[0].isLoading).toBe(true);
      // Sitôt le lecteur connu, la liste en cache est là, sans nouvelle demande.
      expect(rendus[rendus.length - 1]).toEqual({ isLoading: false, fils: 2 });
      expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
    });

    it("première lecture mise en PAUSE (réseau perdu) : toujours en attente — ni « vide », ni « introuvable »", async () => {
      onlineManager.setOnline(false);
      try {
        const { rendus, getDiscussionSpace } = monter({ utilisateur: UTILISATEUR });
        await vi.advanceTimersByTimeAsync(0);
        expect(rendus[rendus.length - 1]).toEqual({ isLoading: true, fetchStatus: "paused" });
        expect(getDiscussionSpace).not.toHaveBeenCalled();
      } finally {
        onlineManager.setOnline(true);
      }
    });

    it("une fois la liste servie, ne se dit plus en attente — même pendant qu'elle se relit", async () => {
      const { result, client } = monter({ utilisateur: UTILISATEUR });
      await vi.advanceTimersByTimeAsync(0);
      expect(result.current.isLoading).toBe(false);
      void client.invalidateQueries({ queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX() });
      await vi.advanceTimersByTimeAsync(0);
      expect(result.current.isLoading).toBe(false);
    });

    it("désactivé ou sans espace, n'attend rien : pas de chargement, même au premier rendu", () => {
      // Un bouton qu'on aurait désactivé ne doit pas tourner en « chargement » sans fin.
      expect(monter({ space: null }).rendus[0]).toEqual({ isLoading: false, fetchStatus: "idle" });
      expect(monter({ options: { enabled: false } }).rendus[0]).toEqual({ isLoading: false, fetchStatus: "idle" });
    });

    it("quand le lecteur change, la liste se relit pour lui — sans garder la précédente à l'écran", async () => {
      let appels = 0;
      // Le premier lecteur reçoit sa liste ; la relecture du suivant, elle, ne répond pas encore.
      const { result, session, rerender, getDiscussionSpace } = monter({
        utilisateur: UTILISATEUR,
        reponse: () => (appels++ === 0 ? Promise.resolve(REPONSE) : new Promise(() => {})),
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(result.current.threads).toHaveLength(2);

      session.entity = null;
      rerender();
      await vi.advanceTimersByTimeAsync(0);
      expect(getDiscussionSpace).toHaveBeenCalledTimes(2);
      expect(result.current).toMatchObject({ threads: [], isLoading: true, total: 0, unread: 0, canComment: false });
    });
  });
});
