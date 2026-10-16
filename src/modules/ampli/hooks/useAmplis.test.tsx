// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * Aiguillage de la source des amplis. Les providers sont mockés : ce qui est
 * vérifié, c'est QUELLE source est lue selon `config.ampli`.
 */

let ampliConfig: unknown;
let costum: unknown;

vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: { ampli: ampliConfig } }) }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ entity: { serverData: { costum } } }),
}));

const { useAmplis, useAmpli } = await import("./useAmplis");

const PATH = { name: "step.name", address: "step.address" };
const COSTUM = {
  ampli: {
    sinistre: { slug: "sinistre", name: "Sinistre", path: PATH, coform: "6927e9f0db22da724360303c" },
  },
};

describe("useAmplis", () => {
  beforeEach(() => {
    ampliConfig = undefined;
    costum = COSTUM;
  });

  it("`ampli: true` lit costum.ampli du porteur", () => {
    ampliConfig = true;
    const { result } = renderHook(() => useAmplis());

    expect(result.current.mode).toBe("costum");
    expect(result.current.amplis.map((ampli) => ampli.slug)).toEqual(["sinistre"]);
  });

  // La forme tableau historique a été retirée du schéma : une config restée
  // dessus n'active plus rien.
  it("une config encore en forme tableau n'active aucun ampli", () => {
    ampliConfig = [{ slug: "amplifions", props: { coform: "69426516f7a7f229f7399da2", path: PATH } }];
    const { result } = renderHook(() => useAmplis());

    expect(result.current.mode).toBe("off");
    expect(result.current.amplis).toEqual([]);
  });

  it("sans `config.ampli`, aucun ampli même si le costum en déclare", () => {
    const { result } = renderHook(() => useAmplis());

    expect(result.current.mode).toBe("off");
    expect(result.current.amplis).toEqual([]);
  });

  // La liste part en dépendance des filtres et compteurs de la page liste :
  // une identité neuve à chaque rendu relancerait leurs mémos.
  it("garde la même liste d'un rendu à l'autre", () => {
    ampliConfig = true;
    const { result, rerender } = renderHook(() => useAmplis());
    const first = result.current.amplis;

    rerender();

    expect(result.current.amplis).toBe(first);
  });
});

describe("useAmpli", () => {
  beforeEach(() => {
    ampliConfig = true;
    costum = COSTUM;
  });

  it("rend l'ampli du slug", () => {
    const { result } = renderHook(() => useAmpli("sinistre"));
    expect(result.current?.name).toBe("Sinistre");
  });

  it("rend null pour un slug inconnu ou absent", () => {
    expect(renderHook(() => useAmpli("inconnu")).result.current).toBeNull();
    expect(renderHook(() => useAmpli(undefined)).result.current).toBeNull();
  });
});
