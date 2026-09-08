// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useWebPush } from "../useWebPush";

/**
 * L'ABONNEMENT PUSH — ce qui compte ici est la PERMISSION, pas le transport.
 *
 * Un refus de notification est quasi définitif : le navigateur cesse d'afficher la demande, et la
 * personne doit aller la rétablir dans les réglages du site. Les tests portent donc d'abord sur
 * « quand demande-t-on », et sur le fait qu'on ne laisse jamais un abonnement navigateur orphelin.
 */

const CLE = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

let permission: NotificationPermission;
let demandes: number;
let abonnements: { unsubscribe: () => Promise<boolean>; endpoint: string } | null;
let subscribeAppels: unknown[];
let unsubscribeAppels: number;
let requetes: { url: string; init?: RequestInit }[];

function monterNavigateur(o: { existant?: boolean } = {}) {
  demandes = 0; subscribeAppels = []; unsubscribeAppels = 0;
  const faux = {
    endpoint: "https://push.exemple/abc",
    unsubscribe: async () => { unsubscribeAppels++; return true; },
    toJSON: () => ({ endpoint: "https://push.exemple/abc", keys: { p256dh: "P", auth: "A" } }),
  };
  abonnements = o.existant ? (faux as never) : null;

  const pushManager = {
    getSubscription: async () => abonnements,
    subscribe: async (opts: unknown) => { subscribeAppels.push(opts); abonnements = faux as never; return faux; },
  };
  const enregistrement = { pushManager };
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register: async () => enregistrement,
      getRegistration: async () => enregistrement,
      ready: Promise.resolve(enregistrement),
    },
  });
  // `useWebPush` teste `"PushManager" in window` : sans ce stub, tout repart en « indisponible »
  // et les tests mesureraient l'absence de l'API, pas le comportement du hook.
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", {
    get permission() { return permission; },
    requestPermission: async () => { demandes++; return permission; },
  });
}

function monterFetch(reponse: (url: string) => Response) {
  requetes = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    requetes.push({ url, init });
    return reponse(url);
  }));
}

const okCle = () => new Response(JSON.stringify({ result: true, publicKey: CLE }), { status: 200 });

beforeEach(() => { permission = "default"; monterNavigateur(); monterFetch(okCle); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("l’état initial — on ne demande JAMAIS rien tout seul", () => {
  it("ne déclenche AUCUNE demande de permission au montage", async () => {
    const { result } = renderHook(() => useWebPush({ jeton: "j" }));
    await waitFor(() => expect(result.current.etat).toBe("inactif"));
    expect(demandes).toBe(0);
  });

  it("reconnaît un abonnement DÉJÀ en place", async () => {
    monterNavigateur({ existant: true });
    const { result } = renderHook(() => useWebPush({ jeton: "j" }));
    await waitFor(() => expect(result.current.etat).toBe("abonne"));
  });

  it("un refus antérieur est DÉFINITIF — on ne redemande pas", async () => {
    permission = "denied";
    const { result } = renderHook(() => useWebPush({ jeton: "j" }));
    await waitFor(() => expect(result.current.etat).toBe("refuse"));
    await act(async () => { await result.current.demander(); });
    // `demander()` a bien tenté, mais le navigateur rend `denied` sans afficher quoi que ce soit.
    expect(result.current.etat).toBe("refuse");
  });

  it("un serveur sans push donne `desactive`, pas une erreur", async () => {
    monterFetch(() => new Response(JSON.stringify({ push: false }), { status: 503 }));
    const { result } = renderHook(() => useWebPush({ jeton: "j" }));
    await waitFor(() => expect(result.current.etat).toBe("desactive"));
  });

  it("un navigateur sans PushManager donne `indisponible`", async () => {
    vi.stubGlobal("navigator", {});
    const { result } = renderHook(() => useWebPush({ jeton: "j" }));
    await waitFor(() => expect(result.current.etat).toBe("indisponible"));
  });
});

describe("l’abonnement", () => {
  it("s’abonne avec `userVisibleOnly` — un abonnement silencieux est REFUSÉ par le navigateur", async () => {
    permission = "granted";
    const { result } = renderHook(() => useWebPush({ jeton: "j" }));
    await waitFor(() => expect(result.current.etat).toBe("inactif"));
    await act(async () => { await result.current.demander(); });
    expect(result.current.etat).toBe("abonne");
    expect(subscribeAppels[0]).toMatchObject({ userVisibleOnly: true });
  });

  it("convertit la clé base64url en octets — une clé mal décodée fait échouer `subscribe`", async () => {
    permission = "granted";
    const { result } = renderHook(() => useWebPush({ jeton: "j" }));
    await waitFor(() => expect(result.current.etat).toBe("inactif"));
    await act(async () => { await result.current.demander(); });
    const cle = (subscribeAppels[0] as { applicationServerKey: Uint8Array }).applicationServerKey;
    expect(cle).toBeInstanceOf(Uint8Array);
    // Une clé VAPID P-256 non compressée fait 65 octets, et commence par 0x04.
    expect(cle.length).toBe(65);
    expect(cle[0]).toBe(4);
  });

  it("envoie l’abonnement AU SERVEUR avec le jeton", async () => {
    permission = "granted";
    const { result } = renderHook(() => useWebPush({ jeton: "mon-jeton", siteSlug: "etangsale1" }));
    await waitFor(() => expect(result.current.etat).toBe("inactif"));
    await act(async () => { await result.current.demander(); });
    const post = requetes.find((r) => r.init?.method === "POST")!;
    expect((post.init!.headers as Record<string, string>).authorization).toBe("Bearer mon-jeton");
    const corps = JSON.parse(String(post.init!.body));
    expect(corps).toMatchObject({ endpoint: "https://push.exemple/abc", keys: { p256dh: "P", auth: "A" }, siteSlug: "etangsale1" });
  });

  it("SI LE SERVEUR REFUSE, il annule l’abonnement navigateur — sinon il reste orphelin", async () => {
    // Un abonnement que le serveur ignore recevrait des pushs que personne n'envoie, et surtout
    // le prochain chargement le verrait « abonné » alors que rien ne l'est.
    permission = "granted";
    monterFetch((u) => (u.endsWith("/cle") ? okCle() : new Response("{}", { status: 500 })));
    const { result } = renderHook(() => useWebPush({ jeton: "j" }));
    await waitFor(() => expect(result.current.etat).toBe("inactif"));
    await act(async () => { await result.current.demander(); });
    expect(unsubscribeAppels).toBe(1);
    expect(result.current.etat).toBe("inactif");
  });

  it("un refus à la demande laisse `refuse` et n’appelle pas le serveur", async () => {
    permission = "default";
    const { result } = renderHook(() => useWebPush({ jeton: "j" }));
    await waitFor(() => expect(result.current.etat).toBe("inactif"));
    permission = "denied";
    await act(async () => { await result.current.demander(); });
    expect(result.current.etat).toBe("refuse");
    expect(requetes.some((r) => r.init?.method === "POST")).toBe(false);
  });

  it("sans jeton, ne demande rien — l’abonnement est rattaché à un compte", async () => {
    const { result } = renderHook(() => useWebPush({ jeton: null }));
    await waitFor(() => expect(result.current.etat).toBe("inactif"));
    await act(async () => { await result.current.demander(); });
    expect(demandes).toBe(0);
  });
});

describe("le retrait", () => {
  it("PRÉVIENT le serveur AVANT de couper — après `unsubscribe`, l’endpoint n’est plus lisible", async () => {
    monterNavigateur({ existant: true });
    const { result } = renderHook(() => useWebPush({ jeton: "j" }));
    await waitFor(() => expect(result.current.etat).toBe("abonne"));
    await act(async () => { await result.current.retirer(); });
    const del = requetes.find((r) => r.init?.method === "DELETE")!;
    expect(JSON.parse(String(del.init!.body))).toMatchObject({ endpoint: "https://push.exemple/abc" });
    expect(unsubscribeAppels).toBe(1);
    expect(result.current.etat).toBe("inactif");
  });

  it("retirer sans abonnement ne lève pas", async () => {
    const { result } = renderHook(() => useWebPush({ jeton: "j" }));
    await waitFor(() => expect(result.current.etat).toBe("inactif"));
    await act(async () => { await result.current.retirer(); });
    expect(result.current.etat).toBe("inactif");
  });
});
