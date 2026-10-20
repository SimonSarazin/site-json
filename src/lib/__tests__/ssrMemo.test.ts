import { describe, it, expect, vi } from "vitest";
import { createSsrMemo } from "../ssrMemo";

/**
 * `createSsrMemo` : le mémo serveur derrière le cache des facettes (`facetCache`).
 * Chaque test fige une clause du contrat écrit en tête du module — en particulier celles qui
 * distinguent ce mémo d'un cache naïf : jamais d'échec mémorisé, regroupement des appels en vol,
 * copie à chaque lecture, `clear()` qui rend caducs les appels en vol, passe-plat quand il est
 * désactivé, et une promesse en toute circonstance.
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

  it("toujours une promesse : un fn qui LÈVE (pas rejette) devient un rejet, rien n'est mémorisé", async () => {
    const memo = createSsrMemo({ ttlMs: 1000 });
    const fn = vi.fn(() => { throw new Error("synchrone"); });
    let p!: Promise<unknown>;
    expect(() => { p = memo.get("k", fn as unknown as () => Promise<unknown>); }).not.toThrow();
    await expect(p).rejects.toThrow("synchrone");
    expect(memo.size).toBe(0);
  });

  it("toujours une promesse : une valeur NON clonable fait rejeter, et n'est PAS mémorisée", async () => {
    const memo = createSsrMemo({ ttlMs: 1000 });
    // Une fonction propre n'est pas clonable par structuredClone (DataCloneError).
    const fn = vi.fn(async () => ({ f: () => 1 }));
    let p!: Promise<unknown>;
    expect(() => { p = memo.get("k", fn); }).not.toThrow();
    await expect(p).rejects.toThrow();
    // Un échec comme un autre : rien derrière lui, la demande suivante relance fn (sinon la clé
    // resterait empoisonnée toute la durée de vie, chaque lecture rejetant sur la copie).
    expect(memo.size).toBe(0);
    fn.mockResolvedValueOnce({ f: 1 } as unknown as { f: () => 1 });
    expect(await memo.get("k", fn)).toEqual({ f: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(memo.size).toBe(1);
  });

  it("les demandes regroupées sur une valeur non clonable échouent toutes, rien n'est mémorisé", async () => {
    const memo = createSsrMemo({ ttlMs: 1000 });
    let resolve!: (v: unknown) => void;
    const fn = vi.fn(() => new Promise((r) => { resolve = r; }));
    const a = memo.get("k", fn);
    const b = memo.get("k", fn);
    resolve({ f: () => 1 });
    await expect(a).rejects.toThrow();
    await expect(b).rejects.toThrow();
    expect(memo.size).toBe(0);
  });

  it("clear() pendant un appel en vol : le résultat tardif est servi mais pas mémorisé, et n'évince pas l'appel relancé", async () => {
    const memo = createSsrMemo({ ttlMs: 1000 });
    let resolveA!: (v: string) => void;
    let resolveB!: (v: string) => void;
    const fn = vi.fn<() => Promise<string>>()
      .mockImplementationOnce(() => new Promise((r) => { resolveA = r; }))
      .mockImplementationOnce(() => new Promise((r) => { resolveB = r; }));

    const a = memo.get("k", fn); // A part
    memo.clear();                // purge : A devient caduc
    const b = memo.get("k", fn); // B part (A n'est plus en vol pour le mémo)
    expect(fn).toHaveBeenCalledTimes(2);

    resolveA("ancien");
    expect(await a).toBe("ancien"); // servi à qui l'attendait…
    expect(memo.size).toBe(0);      // …mais pas mémorisé

    const c = memo.get("k", fn);    // rejoint B : A n'a pas évincé B en se terminant
    expect(fn).toHaveBeenCalledTimes(2);
    resolveB("nouveau");
    expect(await b).toBe("nouveau");
    expect(await c).toBe("nouveau");
    expect(memo.size).toBe(1);
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
