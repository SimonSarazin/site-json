import { describe, it, expect, vi } from "vitest";
import { allEmbedded, makeVariantRegistry, staticVariant, type LazyVariant } from "./variants";

// Faux variant : composant + méthode .preload() (comme un `lazy` de vite-preload).
const mkVariant = () =>
  Object.assign(() => null, { preload: vi.fn(() => Promise.resolve("chunk")) }) as unknown as LazyVariant<unknown>;

describe("makeVariantRegistry (socle)", () => {
  it("preload renvoie la promesse du chunk — un test peut l'attendre", async () => {
    const def = mkVariant();
    const reg = makeVariantRegistry<unknown>({ default: def });
    await expect(reg.preload()).resolves.toBe("chunk");
  });

  it("le label nomme le registre fautif dans l'erreur", () => {
    expect(() => makeVariantRegistry<unknown>({ x: mkVariant() }, "aac detail")).toThrow(/\[aac detail\]/);
    expect(() => makeVariantRegistry<unknown>({ x: mkVariant() })).toThrow(/\[variants\]/);
  });

  it("une clé héritée du prototype retombe sur default", () => {
    const def = mkVariant();
    const reg = makeVariantRegistry<unknown>({ default: def });
    expect(reg.get("constructor")).toBe(def);
    expect(reg.get("toString")).toBe(def);
    expect(reg.has("constructor")).toBe(false);
  });
});

describe("staticVariant", () => {
  it("embarque le composant : préchargement immédiat, marqué `embedded`", async () => {
    const Comp = () => null;
    const v = staticVariant(Comp);
    expect(v).toBe(Comp);
    await expect(v.preload()).resolves.toBe(Comp);
    expect(allEmbedded(v)).toBe(true);
  });

  it("un seul variant code-splitté suffit à exiger une frontière Suspense", () => {
    expect(allEmbedded(staticVariant(() => null), mkVariant())).toBe(false);
  });
});
