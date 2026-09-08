// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useListSources } from "./useListSources";

/**
 * Ce que ces tests protègent, au-delà de la fusion elle-même (couverte par `listSources.test.ts`) :
 *  - la DÉTECTION de forme — une statique ne doit JAMAIS partir en requête (le serveur la refuse), une
 *    recette doit toujours y partir ;
 *  - la levée de l'ancienne garde `enabled: statiques.length === 0` : un champ à socle non vide DOIT
 *    désormais interroger le serveur, sinon les valeurs réellement saisies restent invisibles — c'est
 *    exactement le blocage constaté sur le formulaire d'ajout d'article de parent62.
 */

const appels: Array<{ slug: string; list: string }> = [];

function makeApi(reponses: Record<string, { values: string[]; variants?: Record<string, string[]> }>) {
  return {
    endpointApi: {
      costumListValues: async ({ slug, list }: { slug: string; list: string }) => {
        appels.push({ slug, list });
        const r = reponses[list];
        if (!r) return { result: false, msg: "liste non declaree" };
        return { result: true, values: r.values, ...(r.variants ? { variants: r.variants } : {}) };
      },
    },
  };
}

let contexte: { api: unknown; entity: unknown } = { api: null, entity: null };
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => contexte,
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/** Carrier minimal : un slug (obligatoire pour que la requête parte) + les déclarations `costum.lists`. */
function poser(lists: Record<string, unknown>, reponses: Record<string, { values: string[]; variants?: Record<string, string[]> }> = {}) {
  appels.length = 0;
  contexte = {
    api: makeApi(reponses),
    entity: { serverData: { slug: "parent62", costum: { lists } } },
  };
}

describe("useListSources — détection de forme", () => {
  it("liste STATIQUE : fusionnée avec le socle, AUCUNE requête", async () => {
    poser({ themes: ["La santé", "Le deuil"] });
    const { result } = renderHook(
      () => useListSources("themes", { declared: ["La santé", "Les jeux"] }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    // Socle d'abord (il fixe la graphie et le libellé), puis ce que la liste ajoute.
    expect(result.current.values).toEqual(["La santé", "Les jeux", "Le deuil"]);
    expect(appels).toEqual([]);
  });

  it("RECETTE avec un socle NON VIDE : la requête part quand même, et les deux fusionnent", async () => {
    // Régression visée : avant, `enabled: statiques.length === 0` empêchait tout appel dès qu'un
    // `enum` était déclaré — les valeurs réellement saisies n'apparaissaient jamais.
    poser(
      { themes: { collection: "poi", distinct: "themes", where: {} } },
      { themes: { values: ["Le répit", "la santé"] } },
    );
    const { result } = renderHook(
      () => useListSources("themes", { declared: ["La santé"] }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.values.length).toBe(2));
    expect(appels).toEqual([{ slug: "parent62", list: "themes" }]);
    // « la santé » du serveur est absorbée par « La santé » du socle (casse), « Le répit » s'ajoute.
    expect(result.current.values).toEqual(["La santé", "Le répit"]);
  });

  it("liste NON DÉCLARÉE : aucune requête inutile, le socle seul répond", async () => {
    poser({});
    const { result } = renderHook(
      () => useListSources("themes", { declared: ["La santé"] }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.values).toEqual(["La santé"]);
    expect(appels).toEqual([]);
  });
});

describe("useListSources — plusieurs listes", () => {
  it("fusionne N listes de formes DIFFÉRENTES et unit leurs variants", async () => {
    poser(
      {
        themes: ["La santé"],
        themesPoi: { collection: "poi", distinct: "themes", where: {} },
        themesEvents: { collection: "events", distinct: "themes", where: {} },
      },
      {
        themesPoi: { values: ["Pêche"], variants: { "Pêche": ["Pêche", "PÊCHE"] } },
        themesEvents: { values: ["pêche", "Les jeux"] },
      },
    );
    const { result } = renderHook(
      () => useListSources(["themes", "themesPoi", "themesEvents"], { declared: [] }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.values.length).toBe(3));
    expect(result.current.values).toEqual(["La santé", "Pêche", "Les jeux"]);
    // La graphie propre aux `events` reste interrogeable : sans cette union, le filtre raterait
    // toutes les fiches de cette collection.
    expect(result.current.variants["Pêche"]).toEqual(["Pêche", "PÊCHE", "pêche"]);
    expect(appels.map((a) => a.list).sort()).toEqual(["themesEvents", "themesPoi"]);
  });
});

describe("useListSources — ready", () => {
  it("statique seule : prête d'emblée", () => {
    poser({ themes: ["La santé"] });
    const { result } = renderHook(() => useListSources("themes"), { wrapper });
    expect(result.current.ready).toBe(true);
  });

  it("recette : pas prête tant que la requête n'a pas répondu, prête ensuite", async () => {
    poser(
      { themes: { collection: "poi", distinct: "themes", where: {} } },
      { themes: { values: ["Le répit"] } },
    );
    const { result } = renderHook(() => useListSources("themes"), { wrapper });
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.values).toEqual(["Le répit"]);
  });

  it("refus serveur : PRÊTE quand même (sinon la page resterait figée) et sans valeur", async () => {
    poser({ themes: { collection: "poi", distinct: "themes", where: {} } }, {});
    const { result } = renderHook(() => useListSources("themes", { declared: ["La santé"] }), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.values).toEqual(["La santé"]);
  });

  it("`enabled: false` : aucune requête, prête, socle seul", async () => {
    poser(
      { themes: { collection: "poi", distinct: "themes", where: {} } },
      { themes: { values: ["Le répit"] } },
    );
    const { result } = renderHook(
      () => useListSources("themes", { declared: ["La santé"], enabled: false }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.values).toEqual(["La santé"]);
    expect(appels).toEqual([]);
  });
});
