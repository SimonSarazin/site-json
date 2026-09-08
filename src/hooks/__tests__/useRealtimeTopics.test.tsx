// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useRealtimeTopics } from "../useRealtimeTopics";

/**
 * L'ABONNÉ, éprouvé sur ce qui le casse réellement.
 *
 * Le cas nominal (« un topic arrive, le rappel est appelé ») est le moins intéressant. Ce qui casse
 * un client SSE en production, c'est la REPRISE : réessayer sur une fonctionnalité absente, rouvrir
 * une connexion à chaque rendu, ou ne pas couper au démontage. C'est là que portent ces tests.
 */

/** Un faux flux qu'on alimente à la main, avec les vrais types de `fetch`. */
function fauxFlux() {
  let pousser!: (s: string) => void;
  let finir!: () => void;
  const corps = new ReadableStream<Uint8Array>({
    start(c) {
      const enc = new TextEncoder();
      pousser = (s) => c.enqueue(enc.encode(s));
      finir = () => { try { c.close(); } catch { /* déjà close */ } };
    },
  });
  let ouvert = true;
  return {
    corps,
    pousser: (s: string) => pousser(s),
    finir: () => { ouvert = false; finir(); },
    estOuvert: () => ouvert,
  };
}

const reponseFlux = (corps: ReadableStream<Uint8Array>) =>
  new Response(corps, { status: 200, headers: { "content-type": "text/event-stream" } });

let appels: number;
beforeEach(() => { appels = 0; vi.restoreAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

function montrerFetch(fn: (n: number) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async () => fn(appels++)));
}

describe("l’ouverture", () => {
  it("n’ouvre RIEN sans jeton — le flux est authentifié", async () => {
    montrerFetch(async () => reponseFlux(fauxFlux().corps));
    const { result } = renderHook(() => useRealtimeTopics({ jeton: null, surTopic: () => {} }));
    await new Promise((r) => setTimeout(r, 60));
    expect(appels).toBe(0);
    expect(result.current.etat).toBe("inactif");
  });

  it("envoie le jeton en en-tête `Authorization`", async () => {
    const f = fauxFlux();
    montrerFetch(async () => reponseFlux(f.corps));
    renderHook(() => useRealtimeTopics({ jeton: "jeton-x", surTopic: () => {} }));
    await waitFor(() => expect(appels).toBe(1));
    const [, init] = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer jeton-x");
  });
});

describe("la réception", () => {
  it("livre le topic, et ignore les battements de cœur", async () => {
    const f = fauxFlux();
    montrerFetch(async () => reponseFlux(f.corps));
    const vus: string[] = [];
    renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: (t) => vus.push(t) }));
    await waitFor(() => expect(appels).toBe(1));

    await act(async () => {
      f.pousser("retry: 3000\n\n");
      f.pousser(": ping\n\n");
      f.pousser('event: topic\ndata: {"topic":"notification.changed"}\n\n');
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(vus).toEqual(["notification.changed"]);
  });

  it("réassemble un événement ARRIVÉ EN DEUX MORCEAUX — TCP ne respecte aucune frontière", async () => {
    const f = fauxFlux();
    montrerFetch(async () => reponseFlux(f.corps));
    const vus: string[] = [];
    renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: (t) => vus.push(t) }));
    await waitFor(() => expect(appels).toBe(1));

    await act(async () => {
      f.pousser('event: topic\ndata: {"top');
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(vus).toEqual([]);                       // rien tant que le bloc est incomplet
    await act(async () => {
      f.pousser('ic":"scope.changed"}\n\n');
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(vus).toEqual(["scope.changed"]);
  });

  it("délivre DEUX événements arrivés dans le même paquet", async () => {
    const f = fauxFlux();
    montrerFetch(async () => reponseFlux(f.corps));
    const vus: string[] = [];
    renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: (t) => vus.push(t) }));
    await waitFor(() => expect(appels).toBe(1));
    await act(async () => {
      f.pousser('event: topic\ndata: {"topic":"a.b"}\n\nevent: topic\ndata: {"topic":"c.d"}\n\n');
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(vus).toEqual(["a.b", "c.d"]);
  });

  it("un `resync` appelle son propre rappel, pas `surTopic`", async () => {
    const f = fauxFlux();
    montrerFetch(async () => reponseFlux(f.corps));
    const topics: string[] = []; const resyncs: string[] = [];
    renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: (t) => topics.push(t), surResync: (m) => resyncs.push(m) }));
    await waitFor(() => expect(appels).toBe(1));
    await act(async () => {
      f.pousser('event: resync\ndata: {"motif":"disjoncteur"}\n\n');
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(topics).toEqual([]);
    expect(resyncs).toEqual(["disjoncteur"]);
  });

  it("ne se laisse pas tuer par une charge JSON invalide", async () => {
    const f = fauxFlux();
    montrerFetch(async () => reponseFlux(f.corps));
    const vus: string[] = [];
    renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: (t) => vus.push(t) }));
    await waitFor(() => expect(appels).toBe(1));
    await act(async () => {
      f.pousser("event: topic\ndata: {ceci n'est pas du json\n\n");
      f.pousser('event: topic\ndata: {"topic":"apres.la.casse"}\n\n');
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(vus).toEqual(["apres.la.casse"]);       // le flux a survécu
  });
});

describe("la SANTÉ DU BUS — la panne que le client ne peut pas deviner", () => {
  it("`degrade` change l’état alors que le flux reste OUVERT", async () => {
    // Le capteur est mort côté serveur, mais les battements continuent d'arriver. Sans cet
    // événement, le client resterait « connecté » et sur son intervalle lent — donc moins réactif
    // qu'avant le temps réel.
    const f = fauxFlux();
    montrerFetch(async () => reponseFlux(f.corps));
    const { result } = renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: () => {} }));
    await waitFor(() => expect(result.current.etat).toBe("connecte"));
    await act(async () => {
      f.pousser('event: sante\ndata: {"etat":"degrade","motif":"regle R perdue"}\n\n');
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(result.current.etat).toBe("degrade");
    expect(f.estOuvert()).toBe(true);           // le flux n'est PAS coupé
  });

  it("`retabli` revient à `connecte` ET demande une resynchronisation — il y a eu un TROU", async () => {
    const f = fauxFlux();
    montrerFetch(async () => reponseFlux(f.corps));
    const resyncs: string[] = [];
    const { result } = renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: () => {}, surResync: (m) => resyncs.push(m) }));
    await waitFor(() => expect(result.current.etat).toBe("connecte"));
    await act(async () => {
      f.pousser('event: sante\ndata: {"etat":"degrade","motif":"perdue"}\n\n');
      f.pousser('event: sante\ndata: {"etat":"retabli","motif":"reprise"}\n\n');
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(result.current.etat).toBe("connecte");
    expect(resyncs).toEqual(["reprise"]);
  });

  it("un `degrade` ne déclenche PAS de resynchronisation — il n’y a rien à rattraper encore", async () => {
    const f = fauxFlux();
    montrerFetch(async () => reponseFlux(f.corps));
    const resyncs: string[] = [];
    renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: () => {}, surResync: (m) => resyncs.push(m) }));
    await waitFor(() => expect(appels).toBe(1));
    await act(async () => {
      f.pousser('event: sante\ndata: {"etat":"degrade","motif":"x"}\n\n');
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(resyncs).toEqual([]);
  });

  it("les topics continuent d’être livrés APRÈS un rétablissement", async () => {
    const f = fauxFlux();
    montrerFetch(async () => reponseFlux(f.corps));
    const vus: string[] = [];
    renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: (t) => vus.push(t) }));
    await waitFor(() => expect(appels).toBe(1));
    await act(async () => {
      f.pousser('event: sante\ndata: {"etat":"degrade","motif":"x"}\n\n');
      f.pousser('event: sante\ndata: {"etat":"retabli","motif":"y"}\n\n');
      f.pousser('event: topic\ndata: {"topic":"apres.retabli"}\n\n');
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(vus).toEqual(["apres.retabli"]);
  });
});

describe("le mode dégradé est un mode NORMAL", () => {
  it("un 503 `realtime:false` arrête tout — on ne réessaie PAS une fonctionnalité absente", async () => {
    montrerFetch(async () => new Response(JSON.stringify({ realtime: false }), { status: 503 }));
    const { result } = renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: () => {} }));
    await waitFor(() => expect(result.current.etat).toBe("absent"));
    await new Promise((r) => setTimeout(r, 400));
    expect(appels).toBe(1);                        // UNE seule tentative, jamais davantage
  });

  it("un 401 arrête aussi — insister sur un jeton refusé est une boucle sans fin", async () => {
    montrerFetch(async () => new Response("{}", { status: 401 }));
    const { result } = renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: () => {} }));
    await waitFor(() => expect(result.current.etat).toBe("coupe"));
    await new Promise((r) => setTimeout(r, 400));
    expect(appels).toBe(1);
  });
});

describe("la reprise", () => {
  it("REPREND après une coupure du flux", async () => {
    const premier = fauxFlux();
    const second = fauxFlux();
    montrerFetch(async (n) => reponseFlux(n === 0 ? premier.corps : second.corps));
    const vus: string[] = [];
    renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: (t) => vus.push(t) }));
    await waitFor(() => expect(appels).toBe(1));

    await act(async () => { premier.finir(); await new Promise((r) => setTimeout(r, 50)); });
    // Le plancher de reprise est ~1 s ± jitter : on laisse la place.
    await waitFor(() => expect(appels).toBe(2), { timeout: 4000 });

    await act(async () => {
      second.pousser('event: topic\ndata: {"topic":"apres.reprise"}\n\n');
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(vus).toEqual(["apres.reprise"]);
  }, 10000);

  it("un `surTopic` RECRÉÉ À CHAQUE RENDU ne rouvre pas la connexion", async () => {
    // Le défaut classique : mettre le rappel dans les dépendances de l'effet. En React un rappel
    // en ligne est une NOUVELLE fonction à chaque rendu — la connexion se rouvrirait sans fin.
    const f = fauxFlux();
    montrerFetch(async () => reponseFlux(f.corps));
    const { rerender } = renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: () => {} }));
    await waitFor(() => expect(appels).toBe(1));
    for (let i = 0; i < 5; i++) rerender();
    await new Promise((r) => setTimeout(r, 100));
    expect(appels).toBe(1);
  });

  it("le dernier `surTopic` rendu est celui qui reçoit — la ref ne fige pas une valeur périmée", async () => {
    const f = fauxFlux();
    montrerFetch(async () => reponseFlux(f.corps));
    const a: string[] = []; const b: string[] = [];
    let cible = a;
    const { rerender } = renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: (t) => cible.push(t) }));
    await waitFor(() => expect(appels).toBe(1));
    cible = b; rerender();
    await act(async () => {
      f.pousser('event: topic\ndata: {"topic":"x.y"}\n\n');
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(a).toEqual([]);
    expect(b).toEqual(["x.y"]);
  });
});

describe("le démontage", () => {
  it("COUPE la connexion — sinon on fuit un flux par navigation", async () => {
    const f = fauxFlux();
    let abandonne = false;
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      appels++;
      init.signal?.addEventListener("abort", () => { abandonne = true; });
      return reponseFlux(f.corps);
    }));
    const { unmount } = renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: () => {} }));
    await waitFor(() => expect(appels).toBe(1));
    unmount();
    await waitFor(() => expect(abandonne).toBe(true));
  });

  it("ne REPREND pas après démontage", async () => {
    const f = fauxFlux();
    montrerFetch(async () => reponseFlux(f.corps));
    const { unmount } = renderHook(() => useRealtimeTopics({ jeton: "j", surTopic: () => {} }));
    await waitFor(() => expect(appels).toBe(1));
    unmount();
    f.finir();
    await new Promise((r) => setTimeout(r, 1600));
    expect(appels).toBe(1);
  }, 10000);

  it("`actif:false` n’ouvre rien", async () => {
    montrerFetch(async () => reponseFlux(fauxFlux().corps));
    renderHook(() => useRealtimeTopics({ jeton: "j", actif: false, surTopic: () => {} }));
    await new Promise((r) => setTimeout(r, 80));
    expect(appels).toBe(0);
  });
});
