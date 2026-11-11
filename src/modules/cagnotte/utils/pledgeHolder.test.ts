// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Canal entre onglets simulé : chaque message part vers les AUTRES canaux du même nom. */
class FakeChannel {
  static open: FakeChannel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(readonly name: string) {
    FakeChannel.open.push(this);
  }
  postMessage(data: unknown) {
    FakeChannel.open
      .filter((other) => other !== this && other.name === this.name)
      .forEach((other) => queueMicrotask(() => other.onmessage?.({ data })));
  }
}

const charger = async () => (await import("./pledgeHolder")).getPledgeHolder;

beforeEach(() => {
  vi.resetModules();
  window.sessionStorage.clear();
  FakeChannel.open = [];
  vi.stubGlobal("BroadcastChannel", FakeChannel);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getPledgeHolder", () => {
  it("un identifiant par onglet, gardé pour le rechargement, au format accepté par le serveur", async () => {
    const getPledgeHolder = await charger();
    const holder = getPledgeHolder();

    expect(holder).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(getPledgeHolder()).toBe(holder);
    expect(window.sessionStorage.getItem("cagnotte.pledgeHolder")).toBe(holder);
  });

  it("une valeur stockée invalide est remplacée", async () => {
    window.sessionStorage.setItem("cagnotte.pledgeHolder", "pas valide !");
    const holder = (await charger())();

    expect(holder).not.toBe("pas valide !");
    expect(holder).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it("stockage indisponible : un identifiant en mémoire, stable le temps de la page", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqué");
    });
    const getPledgeHolder = await charger();
    const holder = getPledgeHolder();

    expect(holder).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(getPledgeHolder()).toBe(holder);
  });

  it("onglet dupliqué : il reçoit l'identifiant de l'original, qui le garde, et en prend un autre", async () => {
    const original = await charger();
    const holder = original();

    vi.resetModules();
    const duplicate = await charger();
    expect(duplicate()).toBe(holder);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(original()).toBe(holder);
    expect(duplicate()).not.toBe(holder);
    expect(duplicate()).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it("sans onglet ouvert qui le porte, l'identifiant rechargé reste le même", async () => {
    window.sessionStorage.setItem("cagnotte.pledgeHolder", "onglet-recharge-1");
    const getPledgeHolder = await charger();

    expect(getPledgeHolder()).toBe("onglet-recharge-1");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getPledgeHolder()).toBe("onglet-recharge-1");
  });
});
