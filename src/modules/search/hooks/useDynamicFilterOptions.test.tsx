// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDynamicFilterOptions } from "./useDynamicFilterOptions";

/**
 * Ce que ces tests protègent, sur un hook qui pilote les 24 filtres de parent62 ET l'hydratation
 * URL→filtres de la page entière :
 *  - la NON-RÉGRESSION des deux formes historiques (`optionsKey` statique, `optionsFrom` recette),
 *    qui substituent les options déclarées ;
 *  - le SOCLE opt-in (`withDeclared`), seul mode où les libellés i18n déclarés survivent ;
 *  - `optionsReady`, dont dépend le deep-link : un `false` qui ne repasse jamais à `true` gèle la
 *    synchro URL de toute la page, pas seulement du filtre concerné.
 */

const appels: string[] = [];

function makeApi(reponses: Record<string, { values: string[]; variants?: Record<string, string[]> }>) {
  return {
    endpointApi: {
      costumListValues: async ({ list }: { slug: string; list: string }) => {
        appels.push(list);
        const r = reponses[list];
        if (!r) return { result: false, msg: "liste non declaree" };
        return { result: true, values: r.values, ...(r.variants ? { variants: r.variants } : {}) };
      },
    },
  };
}

let contexte: { api: unknown; entity: unknown } = { api: null, entity: null };
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => contexte }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function poser(
  lists: Record<string, unknown>,
  reponses: Record<string, { values: string[]; variants?: Record<string, string[]> }> = {},
) {
  appels.length = 0;
  contexte = { api: makeApi(reponses), entity: { serverData: { slug: "parent62", costum: { lists } } } };
}

/** Un filtre « Thèmes » tel qu'il est écrit en config : options déclarées avec libellés i18n. */
type OptionDeTest = { id: string; label: unknown; value?: string; name?: string; variants?: string[] };
const declarees: OptionDeTest[] = [
  { id: "la-sante", value: "La santé", label: { fr: "La santé", en: "Health" } },
  { id: "les-jeux", value: "Les jeux", label: { fr: "Les jeux", en: "Games" } },
];
/** Filtre sans socle : `options` doit rester TYPÉ (un `[]` nu s'infère `never[]`). */
const sansSocle: OptionDeTest[] = [];

describe("useDynamicFilterOptions — formes historiques (non-régression)", () => {
  it("`optionsKey` sur une liste STATIQUE : substitution, aucune requête", async () => {
    poser({ themes: ["Le deuil", "Le répit"] });
    const { result } = renderHook(
      () => useDynamicFilterOptions([{ id: "theme", optionsKey: "themes", options: declarees }]),
      { wrapper },
    );
    await waitFor(() => expect(result.current[0].optionsReady).toBe(true));
    expect(result.current[0].options?.map((o) => o.value)).toEqual(["Le deuil", "Le répit"]);
    expect(appels).toEqual([]);
  });

  it("`optionsFrom` sur une RECETTE : substitution par défaut (pas de socle sans `withDeclared`)", async () => {
    poser({ territoire: { collection: "organizations", distinct: "territoire" } }, {
      territoire: { values: ["Saint-Denis", "Le Port"] },
    });
    const { result } = renderHook(
      () => useDynamicFilterOptions([{ id: "t", optionsFrom: { list: "territoire" }, options: declarees }]),
      { wrapper },
    );
    // Attendre une condition DISCRIMINANTE : les options déclarées en font déjà 2, donc attendre
    // `length === 2` passerait avant même la réponse serveur (et testerait le repli, pas la résolution).
    await waitFor(() => expect(result.current[0].options?.[0].value).toBe("Saint-Denis"));
    expect(result.current[0].options?.map((o) => o.value)).toEqual(["Saint-Denis", "Le Port"]);
    expect(appels).toEqual(["territoire"]);
  });

  it("filtre SANS source : renvoyé inchangé, prêt, sans requête", async () => {
    poser({ themes: ["x"] });
    const { result } = renderHook(
      () => useDynamicFilterOptions([{ id: "libre", options: declarees }]),
      { wrapper },
    );
    expect(result.current[0].optionsReady).toBe(true);
    expect(result.current[0].options).toEqual(declarees);
    expect(appels).toEqual([]);
  });

  it("liste résolue mais VIDE : options déclarées conservées, et filtre PRÊT", async () => {
    poser({ themes: { collection: "poi", distinct: "themes" } }, { themes: { values: [] } });
    const { result } = renderHook(
      () => useDynamicFilterOptions([{ id: "theme", optionsFrom: { list: "themes" }, options: declarees }]),
      { wrapper },
    );
    await waitFor(() => expect(result.current[0].optionsReady).toBe(true));
    expect(result.current[0].options).toEqual(declarees);
  });

  /**
   * Filtre 100 % DYNAMIQUE : aucune option écrite en config. Le `.default([])` du schéma ne s'applique
   * pas — la config JSON n'est jamais parsée par Zod au runtime — donc `options` arrivait ici à
   * `undefined` et ressortait tel quel. `SearchHeaderSection` lit `filter.options.filter(…)` sans garde :
   * la section « Paroles de parents » entière tombait en erreur au retrait des catégories déclarées.
   */
  it("SANS aucune option déclarée : `options` ressort en tableau, jamais `undefined`", async () => {
    poser({ categoriesParole: { collection: "poi", distinct: "category" } }, { categoriesParole: { values: [] } });
    const { result } = renderHook(
      () => useDynamicFilterOptions([{ id: "category", optionsFrom: { list: ["categoriesParole"] } }]),
      { wrapper },
    );
    await waitFor(() => expect(result.current[0].optionsReady).toBe(true));
    expect(result.current[0].options).toEqual([]);
  });

  it("SANS aucune option déclarée ET sans source : `options` vaut `[]` (chemin sans requête)", async () => {
    poser({});
    const { result } = renderHook(() => useDynamicFilterOptions([{ id: "libre" }]), { wrapper });
    expect(result.current[0].optionsReady).toBe(true);
    expect(result.current[0].options).toEqual([]);
  });
});

describe("useDynamicFilterOptions — socle déclaré (`withDeclared`)", () => {
  it("fusionne, et les options déclarées GARDENT leur libellé i18n", async () => {
    poser(
      { themes: ["La santé"], themesPoi: { collection: "poi", distinct: "themes" } },
      { themesPoi: { values: ["la santé", "Le deuil"] } },
    );
    const { result } = renderHook(
      () => useDynamicFilterOptions([{
        id: "theme",
        optionsFrom: { list: ["themes", "themesPoi"], withDeclared: true },
        options: declarees,
      }]),
      { wrapper },
    );
    await waitFor(() => expect(result.current[0].options?.length).toBe(3));
    const options = result.current[0].options ?? [];
    // Socle d'abord (ordre config), puis ce que les listes ajoutent.
    expect(options.map((o) => o.value)).toEqual(["La santé", "Les jeux", "Le deuil"]);
    // Le libellé traduit survit — c'est tout l'intérêt du socle.
    expect(options[0].label).toEqual({ fr: "La santé", en: "Health" });
    // La valeur venue de la base n'a pas de libellé : seule la casse d'affichage est retouchée.
    expect(options[2].label).toBe("Le deuil");
  });

  it("une seule requête par liste DYNAMIQUE ; la statique du même filtre n'en déclenche aucune", async () => {
    poser(
      { themes: ["La santé"], themesPoi: { collection: "poi", distinct: "themes" } },
      { themesPoi: { values: ["Le deuil"] } },
    );
    renderHook(
      () => useDynamicFilterOptions([{ id: "theme", optionsFrom: { list: ["themes", "themesPoi"] } }]),
      { wrapper },
    );
    await waitFor(() => expect(appels).toEqual(["themesPoi"]));
  });

  it("unit les `variants` de deux listes : la graphie de l'autre collection reste interrogeable", async () => {
    poser(
      {
        themesPoi: { collection: "poi", distinct: "themes" },
        themesEvents: { collection: "events", distinct: "themes" },
      },
      {
        themesPoi: { values: ["Pêche"], variants: { "Pêche": ["Pêche", "PÊCHE"] } },
        themesEvents: { values: ["pêche"] },
      },
    );
    const { result } = renderHook(
      () => useDynamicFilterOptions([{ id: "t", options: sansSocle, optionsFrom: { list: ["themesPoi", "themesEvents"] } }]),
      { wrapper },
    );
    await waitFor(() => expect(result.current[0].options?.length).toBe(1));
    expect(result.current[0].options?.[0].variants).toEqual(["Pêche", "PÊCHE", "pêche"]);
  });
});

describe("useDynamicFilterOptions — optionsReady (garde du deep-link)", () => {
  it("faux tant qu'une source dynamique n'a pas répondu, vrai ensuite", async () => {
    poser({ themes: { collection: "poi", distinct: "themes" } }, { themes: { values: ["Le deuil"] } });
    const { result } = renderHook(
      () => useDynamicFilterOptions([{ id: "theme", optionsFrom: { list: "themes" }, options: declarees }]),
      { wrapper },
    );
    expect(result.current[0].optionsReady).toBe(false);
    await waitFor(() => expect(result.current[0].optionsReady).toBe(true));
  });

  it("refus serveur : PRÊT quand même — sinon la page resterait figée pour toujours", async () => {
    poser({ themes: { collection: "poi", distinct: "themes" } }, {});
    const { result } = renderHook(
      () => useDynamicFilterOptions([{ id: "theme", optionsFrom: { list: "themes" }, options: declarees }]),
      { wrapper },
    );
    await waitFor(() => expect(result.current[0].optionsReady).toBe(true));
    expect(result.current[0].options).toEqual(declarees);
  });

  it("socle NON VIDE + recette en vol : PAS prêt tant que la recette n'a pas répondu", async () => {
    // Régression réelle (parent62 /recherche) : marquer « prêt » dès que le socle donne des valeurs
    // laissait l'hydratation URL partir trop tôt ; l'arrivée des valeurs rejouait ensuite l'effet de
    // lecture, qui EFFAÇAIT la cible de recherche par défaut. `optionsReady` = toutes les sources ont
    // répondu, jamais « on a déjà de quoi afficher ».
    poser({ themes: { collection: "poi", distinct: "themes" } }, { themes: { values: ["Le deuil"] } });
    const { result } = renderHook(
      () => useDynamicFilterOptions([{
        id: "theme",
        optionsFrom: { list: "themes", withDeclared: true },
        options: declarees,
      }]),
      { wrapper },
    );
    // Le socle est déjà affichable…
    expect(result.current[0].options?.length).toBe(2);
    // …mais le filtre n'est PAS prêt : une source est encore en vol.
    expect(result.current[0].optionsReady).toBe(false);
    await waitFor(() => expect(result.current[0].optionsReady).toBe(true));
    expect(result.current[0].options?.map((o) => o.value)).toEqual(["La santé", "Les jeux", "Le deuil"]);
  });

  it("un filtre 100 % statique est prêt d'emblée, sans attendre les autres", () => {
    poser({ themes: ["La santé"], gros: { collection: "poi", distinct: "x" } }, { gros: { values: ["a"] } });
    const { result } = renderHook(
      () => useDynamicFilterOptions([
        { id: "theme", optionsKey: "themes" },
        { id: "autre", optionsFrom: { list: "gros" } },
      ]),
      { wrapper },
    );
    expect(result.current[0].optionsReady).toBe(true);
    expect(result.current[1].optionsReady).toBe(false);
  });
});
