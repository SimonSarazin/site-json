import { describe, expect, test } from "vitest";
import { executerParSite, type OptionsLot } from "../../scripts/lib/deploy-lot";

/**
 * Verrouille la sémantique de lot de `scripts/deploy.ts` : TOLÉRANT par
 * défaut (un échec n'arrête pas les suivants, bilan + reprise réduite aux
 * ratés), fail-fast en option (la reprise couvre alors ratés + non tentés).
 */

const options = (failFast: boolean): OptionsLot & { sorties: string[] } => {
  const sorties: string[] = [];
  return {
    failFast,
    reprise: (slugs) => `npm run deploy -- ${slugs.join(" ")} --yes`,
    log: (m) => sorties.push(m),
    err: (m) => sorties.push(m),
    sorties,
  };
};

describe("deploy-lot : executerParSite", () => {
  test("tolérant : un échec au milieu n'empêche pas les suivants", async () => {
    const opts = options(false);
    const tentes: string[] = [];
    const bilan = await executerParSite(
      ["a", "b", "c"],
      async (slug) => {
        tentes.push(slug);
        if (slug === "b") throw new Error("boum");
      },
      opts,
    );
    expect(tentes).toEqual(["a", "b", "c"]);
    expect(bilan.code).toBe(1);
    expect(bilan.resultats).toEqual([
      { slug: "a", ok: true },
      { slug: "b", ok: false, detail: "boum" },
      { slug: "c", ok: true },
    ]);
    expect(bilan.reprise).toBe("npm run deploy -- b --yes");
  });

  test("fail-fast : arrêt au premier échec, les non-tentés rejoignent la reprise", async () => {
    const opts = options(true);
    const tentes: string[] = [];
    const bilan = await executerParSite(
      ["a", "b", "c", "d"],
      async (slug) => {
        tentes.push(slug);
        if (slug === "b") throw new Error("boum");
      },
      opts,
    );
    expect(tentes).toEqual(["a", "b"]);
    expect(bilan.resultats.map((r) => r.slug)).toEqual(["a", "b"]);
    expect(bilan.reprise).toBe("npm run deploy -- b c d --yes");
    expect(bilan.code).toBe(1);
  });

  test("tout réussit : code 0, pas de reprise", async () => {
    const opts = options(false);
    const bilan = await executerParSite(["a", "b"], async () => {}, opts);
    expect(bilan).toEqual({
      resultats: [
        { slug: "a", ok: true },
        { slug: "b", ok: true },
      ],
      code: 0,
    });
    expect(opts.sorties.at(-1)).toContain("✓ 2/2");
  });

  test("le bilan d'échec nomme les ratés et imprime la reprise", async () => {
    const opts = options(false);
    await executerParSite(
      ["a", "b"],
      async (slug) => {
        if (slug === "a") throw new Error("réseau");
      },
      opts,
    );
    const texte = opts.sorties.join("\n");
    expect(texte).toContain("✗ réseau");
    expect(texte).toContain("1/2 traité(s), 1 échec(s) : a");
    expect(texte).toContain("Reprendre :  npm run deploy -- a --yes");
  });

  test("lot vide : code 0 sans rien tenter", async () => {
    const opts = options(false);
    const bilan = await executerParSite([], async () => {}, opts);
    expect(bilan.code).toBe(0);
    expect(bilan.resultats).toEqual([]);
  });
});
