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
      .forEach((other) => other.onmessage?.({ data }));
  }
}

/** Le module d'un onglet : chaque import neuf joue un onglet distinct. */
const onglet = async () => {
  vi.resetModules();
  return import("./pledgeChanges");
};

beforeEach(() => {
  FakeChannel.open = [];
  vi.stubGlobal("BroadcastChannel", FakeChannel);
});
afterEach(() => vi.unstubAllGlobals());

describe("pledgeChanges", () => {
  it("un changement signalé dans un onglet prévient les autres, pas lui-même", async () => {
    const premier = await onglet();
    const second = await onglet();
    const ecouteSecond = vi.fn();
    const ecoutePremier = vi.fn();
    second.onPledgeChange(ecouteSecond);
    premier.onPledgeChange(ecoutePremier);

    premier.notifyPledgeChange();

    expect(ecouteSecond).toHaveBeenCalledTimes(1);
    expect(ecoutePremier).not.toHaveBeenCalled();
  });

  it("désinscrit, un onglet n'est plus prévenu", async () => {
    const premier = await onglet();
    const second = await onglet();
    const ecoute = vi.fn();
    const desinscrire = second.onPledgeChange(ecoute);
    desinscrire();

    premier.notifyPledgeChange();

    expect(ecoute).not.toHaveBeenCalled();
  });

  it("navigateur sans BroadcastChannel : rien n'est envoyé, sans erreur", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const seul = await onglet();

    expect(() => seul.notifyPledgeChange()).not.toThrow();
    expect(() => seul.onPledgeChange(vi.fn())()).not.toThrow();
  });
});
