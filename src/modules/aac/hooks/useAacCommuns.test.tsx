// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Form } from "@communecter/cocolight-api-client";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { useAacCommuns } from "./useAacCommuns";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";
import { EMPTY_AAC_FILTERS, type AacDirectoryFiltersState } from "../lib/filtersKey";
import type { AacCardFields } from "../lib/resolveAacCardFields";

/**
 * Chemin BALAYAGE du transport (M11) : dès qu'un filtre client est actif
 * (`maturity` ici), la requête serveur ne dépend plus de la page — c'est la même
 * pour toute la liste, découpée en mémoire. Le scroll infini ne doit donc payer
 * QU'UN balayage, pas un par page ; et une invalidation du listing doit le
 * refaire UNE fois, pas une par page rejouée.
 */

// Titre et maturité vivent dans une ÉTAPE : le titre part au serveur (`$exists`),
// la maturité reste client — c'est elle qui impose le balayage.
const FIELDS: AacCardFields = {
  title: { stepKey: "aapStep1", id: "titre", path: "answers.aapStep1.titre", label: "", options: [] },
  maturity: { stepKey: "aapStep1", id: "mat", path: "answers.aapStep1.mat", label: "", options: [] },
  description: null,
  tags: null,
  image: null,
  depense: null,
  choose: null,
  users: null,
};

const SCAN_FILTERS: AacDirectoryFiltersState = { ...EMPTY_AAC_FILTERS, maturity: ["Oui"] };

function row(i: number, maturity: string) {
  return {
    _id: { $id: `commun-${i}` },
    name: `Commun ${i}`,
    answers: { aapStep1: { titre: `Commun ${i}`, mat: maturity } },
  };
}

/** 20 « Oui » + 10 « Non » : deux états de filtre client aux totaux distincts. */
function defaultRows() {
  return [
    ...Array.from({ length: 20 }, (_, i) => row(i, "Oui")),
    ...Array.from({ length: 10 }, (_, i) => row(20 + i, "Non")),
  ];
}

/** Un `Form` réduit à `getProposals`, qui pagine ce que `rows()` lui donne. */
function makeForm(rows: () => unknown[]) {
  const getProposals = vi.fn(async (params: { indexMin: number; indexStep: number }) => {
    const all = rows();
    return {
      results: all.slice(params.indexMin, params.indexMin + params.indexStep),
      count: { answers: all.length },
    };
  });
  return { form: { getProposals } as unknown as Form, getProposals };
}

function setup(filters: AacDirectoryFiltersState, rows: () => unknown[] = defaultRows) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { form, getProposals } = makeForm(rows);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(LocalizationProvider, null, children)
    );

  const hook = renderHook(
    (props: { filters: AacDirectoryFiltersState }) =>
      useAacCommuns({ formId: "form-1", form, fields: FIELDS, filters: props.filters, pageSize: 12 }),
    { wrapper, initialProps: { filters } }
  );

  return { ...hook, queryClient, getProposals };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useAacCommuns — chemin balayage (M11)", () => {
  it("deux pages de scroll infini ne coûtent qu'UN balayage", async () => {
    const { result, getProposals } = setup(SCAN_FILTERS);

    await waitFor(() => expect(result.current.communs).toHaveLength(12));
    expect(result.current.totalCount).toBe(20);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.communs).toHaveLength(20));
    expect(result.current.hasNextPage).toBe(false);

    // Le cœur du constat : la 2ᵉ page se sert du balayage déjà en cache.
    expect(getProposals).toHaveBeenCalledTimes(1);
    expect(getProposals.mock.calls[0][0]).toMatchObject({ indexMin: 0, indexStep: 300 });
  });

  it("changer un filtre CLIENT ne refait pas le balayage : la requête serveur est la même", async () => {
    const { result, rerender, getProposals } = setup(SCAN_FILTERS);
    await waitFor(() => expect(result.current.totalCount).toBe(20));

    rerender({ filters: { ...EMPTY_AAC_FILTERS, maturity: ["Non"] } });

    await waitFor(() => expect(result.current.totalCount).toBe(10));
    expect(result.current.communs).toHaveLength(10);
    expect(getProposals).toHaveBeenCalledTimes(1);
  });

  it("une invalidation du listing refait le balayage — UNE fois pour toutes les pages, avec les données fraîches", async () => {
    let rows = defaultRows();
    const { result, queryClient, getProposals } = setup(SCAN_FILTERS, () => rows);

    await waitFor(() => expect(result.current.communs).toHaveLength(12));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.communs).toHaveLength(20));
    expect(getProposals).toHaveBeenCalledTimes(1);

    // Un dépôt a eu lieu : le serveur a 5 « Oui » de plus, et l'écrivain
    // n'invalide que le PRÉFIXE du listing — il ne connaît pas le balayage.
    rows = [...rows, ...Array.from({ length: 5 }, (_, i) => row(30 + i, "Oui"))];
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: AAC_QUERY_KEYS.COMMUNS_PREFIX() });
    });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    // Les deux pages ont été rejouées, mais le balayage n'a été refait qu'une fois…
    expect(getProposals).toHaveBeenCalledTimes(2);
    // …et c'est bien le NOUVEAU balayage qui les sert, pas l'ancien resservi.
    await waitFor(() => expect(result.current.totalCount).toBe(25));
    expect(result.current.communs).toHaveLength(24);
  });
});

describe("useAacCommuns — chemin paginé serveur (non-régression)", () => {
  it("sans filtre client, chaque page est un appel serveur à son propre offset", async () => {
    const { result, getProposals } = setup(EMPTY_AAC_FILTERS);

    await waitFor(() => expect(result.current.communs).toHaveLength(12));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.communs).toHaveLength(24));

    expect(getProposals).toHaveBeenCalledTimes(2);
    expect(getProposals.mock.calls[0][0]).toMatchObject({ indexMin: 0, indexStep: 12 });
    expect(getProposals.mock.calls[1][0]).toMatchObject({ indexMin: 12, indexStep: 12 });
    expect(result.current.totalCount).toBe(30);
  });
});
