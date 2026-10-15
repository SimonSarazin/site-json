import { describe, it, expect, vi } from "vitest";
import { createSsrMemo } from "../ssrMemo";

/**
 * `createSsrMemo` : le mémo serveur derrière le cache des facettes (`facetCache`).
 * Chaque test fige une clause du contrat écrit en tête du module — en particulier celles qui
 * distinguent ce mémo d'un cache naïf : jamais d'échec mémorisé, regroupement des appels en vol,
 * copie à chaque lecture, passe-plat quand il est désactivé.
 */
function horloge(start = 1_000_000) {
  let t = start;
  return { now: () => t, avance: (ms: number) => { t += ms; } };
}

describe("createSsrMemo", () => {
  it("un miss appelle fn, les lectures suivantes servent la copie sans rappeler fn", async () => {
    const h = horloge();
    const memo = createSsrMemo({ ttlMs: 1000, now: h.now });
    const fn = vi.fn(async () => ({ zones: ["FR", "BE"] }));

    expect(await memo.get("k", fn)).toEqual({ zones: ["FR", "BE"] });
    expect(await memo.get("k", fn)).toEqual({ zones: ["FR", "BE"] });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(memo.stats).toEqual({ hits: 1, misses: 1, joined: 0 });
  });

  it("expire après ttlMs : la lecture suivante rappelle fn", async () => {
    const h = horloge();
    const memo = createSsrMemo({ ttlMs: 1000, now: h.now });
    const fn = vi.fn(async () => "v1");

    await memo.get("k", fn);
    h.avance(999);
    expect(await memo.get("k", fn)).toBe("v1");
    h.avance(1); // expiresAt atteint
    fn.mockResolvedValueOnce("v2");
    expect(await memo.get("k", fn)).toBe("v2");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("regroupe les appels EN VOL : N demandes concurrentes → un seul fn, tous servis", async () => {
    const memo = createSsrMemo({ ttlMs: 1000 });
    let resolve!: (v: string) => void;
    const fn = vi.fn(() => new Promise<string>((r) => { resolve = r; }));

    const pending = [memo.get("k", fn), memo.get("k", fn), memo.get("k", fn)];
    expect(fn).toHaveBeenCalledTimes(1);
    resolve("facettes");
    expect(await Promise.all(pending)).toEqual(["facettes", "facettes", "facettes"]);
    expect(memo.stats.joined).toBe(2);
    expect(memo.size).toBe(1);
  });

  it("un échec n'est JAMAIS mémorisé : la demande suivante relance fn", async () => {
    const memo = createSsrMemo({ ttlMs: 1000 });
    const fn = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("backend HS"))
      .mockResolvedValueOnce("ok");

    await expect(memo.get("k", fn)).rejects.toThrow("backend HS");
    expect(memo.size).toBe(0);
    expect(await memo.get("k", fn)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("les demandes regroupées sur un appel qui échoue échouent toutes, sans rien laisser", async () => {
    const memo = createSsrMemo({ ttlMs: 1000 });
    let reject!: (e: Error) => void;
    const fn = vi.fn(() => new Promise<string>((_, r) => { reject = r; }));

    const a = memo.get("k", fn);
    const b = memo.get("k", fn);
    reject(new Error("timeout"));
    await expect(a).rejects.toThrow("timeout");
    await expect(b).rejects.toThrow("timeout");
    expect(memo.size).toBe(0);
    // Plus rien en vol : la demande suivante repart de zéro.
    fn.mockResolvedValueOnce("ok");
    expect(await memo.get("k", fn)).toBe("ok");
  });

  it("chaque lecture reçoit une COPIE : muter la valeur reçue ne touche ni le mémo ni les voisins", async () => {
    const memo = createSsrMemo({ ttlMs: 1000 });
    const original = { items: [{ name: "Bretagne" }] };
    const fn = vi.fn(async () => original);

    const premier = await memo.get("k", fn);
    premier.items[0].name = "MUTÉ";
    premier.items.push({ name: "ajout" });

    const second = await memo.get("k", fn);
    expect(second).toEqual({ items: [{ name: "Bretagne" }] });
    expect(second).not.toBe(premier);
    // L'objet renvoyé par fn n'a pas été distribué tel quel non plus.
    expect(original).toEqual({ items: [{ name: "Bretagne" }] });
  });

  it("ttlMs <= 0 : passe-plat strict, fn à chaque appel, rien de stocké", async () => {
    const memo = createSsrMemo({ ttlMs: 0 });
    const fn = vi.fn(async () => ({ a: 1 }));
    await memo.get("k", fn);
    await memo.get("k", fn);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(memo.size).toBe(0);
    expect(memo.stats).toEqual({ hits: 0, misses: 0, joined: 0 });
  });

  it("taille bornée : au-delà de maxEntries, la plus ancienne est évincée", async () => {
    const memo = createSsrMemo({ ttlMs: 1000, maxEntries: 2 });
    const fn = vi.fn(async () => "x");
    await memo.get("a", fn);
    await memo.get("b", fn);
    await memo.get("c", fn);
    expect(memo.size).toBe(2);
    await memo.get("a", fn); // évincée → miss
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("les clés sont indépendantes", async () => {
    const memo = createSsrMemo({ ttlMs: 1000 });
    const fn = vi.fn(async () => "x");
    await memo.get("zones", fn);
    await memo.get("thematiques", fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("clear() vide tout", async () => {
    const memo = createSsrMemo({ ttlMs: 1000 });
    const fn = vi.fn(async () => "x");
    await memo.get("k", fn);
    memo.clear();
    expect(memo.size).toBe(0);
    await memo.get("k", fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
