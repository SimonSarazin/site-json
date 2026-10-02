// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { useRealtimeTopic } from "../useRealtimeSubscription";
import { RealtimeBridge } from "@/components/layout/RealtimeBridge";
import { _reinitialiserBus } from "@/lib/realtimeBus";

/**
 * LE MULTIPLEXAGE — la raison d'être du bus, éprouvée là où elle se vérifie : **le nombre de
 * connexions réellement ouvertes**.
 *
 * Avant le bus, `useRealtimeTopics` ouvrait un flux par appel. Deux modules branchés sur le temps
 * réel, c'était deux flux par onglet — et quatre connexions en comptant le saut relais → hub.
 * Ces tests comptent les `fetch` : c'est la seule mesure qui ne ment pas.
 *
 * `fetch` est mocké parce que c'est une VRAIE frontière réseau ; le bus et le pont, eux, sont la
 * pièce testée et tournent pour de bon.
 */

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({
    me: { isConnected: true, apiClient: { getToken: () => "jeton-de-test" } },
  }),
}));

/** Un flux ouvert qu'on alimente à la main. */
function fauxFlux() {
  let pousser!: (s: string) => void;
  const corps = new ReadableStream<Uint8Array>({
    start(c) {
      const enc = new TextEncoder();
      pousser = (s) => c.enqueue(enc.encode(s));
    },
  });
  return { corps, pousser: (s: string) => pousser(s) };
}

let flux: ReturnType<typeof fauxFlux>;
let ouvertures: number;
let coupes: number;

beforeEach(() => {
  _reinitialiserBus();
  ouvertures = 0;
  coupes = 0;
  flux = fauxFlux();
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    ouvertures += 1;
    init?.signal?.addEventListener("abort", () => { coupes += 1; });
    return new Response(flux.corps, {
      status: 200, headers: { "content-type": "text/event-stream" },
    });
  }));
});
afterEach(() => { vi.restoreAllMocks(); });

/** Un abonné minimal : il note ce qu'il reçoit. */
function Abonne({ nom, sujet, vus }: { nom: string; sujet: string; vus: string[] }) {
  useRealtimeTopic(sujet, () => { vus.push(nom); });
  return null;
}

describe("un seul flux, quel que soit le nombre d'abonnés", () => {
  it("n'ouvre RIEN tant que personne n'est abonné", async () => {
    render(<RealtimeBridge />);
    // Laisser passer les effets : s'il devait s'ouvrir, ce serait maintenant.
    await act(async () => { await Promise.resolve(); });
    expect(ouvertures).toBe(0);
  });

  it("n'ouvre qu'UNE connexion pour deux modules abonnés", async () => {
    const vus: string[] = [];
    render(
      <>
        <RealtimeBridge />
        <Abonne nom="cloche" sujet="notification.changed" vus={vus} />
        <Abonne nom="panneau" sujet="comment.changed" vus={vus} />
      </>,
    );
    await waitFor(() => expect(ouvertures).toBe(1));
  });

  it("distribue à chacun le sujet qui le concerne, et à lui seul", async () => {
    const vus: string[] = [];
    render(
      <>
        <RealtimeBridge />
        <Abonne nom="cloche" sujet="notification.changed" vus={vus} />
        <Abonne nom="panneau" sujet="comment.changed" vus={vus} />
      </>,
    );
    await waitFor(() => expect(ouvertures).toBe(1));

    await act(async () => {
      flux.pousser('event: topic\ndata: {"topic":"comment.changed"}\n\n');
      await Promise.resolve();
    });
    await waitFor(() => expect(vus).toEqual(["panneau"]));
  });

  it("referme le flux quand le DERNIER abonné s'en va", async () => {
    const vus: string[] = [];
    const { rerender } = render(
      <>
        <RealtimeBridge />
        <Abonne nom="cloche" sujet="notification.changed" vus={vus} />
        <Abonne nom="panneau" sujet="comment.changed" vus={vus} />
      </>,
    );
    await waitFor(() => expect(ouvertures).toBe(1));

    // Un seul part : le flux DOIT rester ouvert pour l'autre.
    rerender(
      <>
        <RealtimeBridge />
        <Abonne nom="cloche" sujet="notification.changed" vus={vus} />
      </>,
    );
    await act(async () => { await Promise.resolve(); });
    expect(coupes).toBe(0);

    // Le dernier part : plus personne à servir, on coupe.
    rerender(<RealtimeBridge />);
    await waitFor(() => expect(coupes).toBe(1));
  });

  it("ne rouvre pas une connexion à chaque rendu", async () => {
    const vus: string[] = [];
    const arbre = (
      <>
        <RealtimeBridge />
        <Abonne nom="cloche" sujet="notification.changed" vus={vus} />
      </>
    );
    const { rerender } = render(arbre);
    await waitFor(() => expect(ouvertures).toBe(1));
    rerender(arbre);
    rerender(arbre);
    await act(async () => { await Promise.resolve(); });
    expect(ouvertures).toBe(1);
  });
});
