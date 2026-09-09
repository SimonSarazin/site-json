// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { AacDirectoryEnabledFilters } from "../lib/directoryFilters";
import { EMPTY_AAC_CARD_FIELDS } from "../lib/resolveAacCardFields";
import type { AacDirectorySectionProps } from "../schema";
import type { UseAacCommunsResult } from "../hooks/useAacCommuns";

vi.mock("../i18n", () => ({}));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLocalization", () => ({
  useLocalization: () => ({
    t: (value: unknown) =>
      typeof value === "string" ? value : ((value as { fr?: string } | undefined)?.fr ?? ""),
  }),
}));
// Le debounce est un délai, pas un comportement à vérifier ici.
vi.mock("@/hooks/useDebounce", () => ({ useDebounce: <T,>(value: T) => value }));

/**
 * Le socle partagé, MUTABLE lui aussi : c'est l'état de la RÉSOLUTION du
 * formulaire — en vol, terminée, ou en échec — qui départage le squelette de
 * l'état vide. Au repos : terminée, ni en vol ni en erreur.
 */
const contextState = {
  formId: "f1" as string | null,
  config: null,
  form: null,
  fields: EMPTY_AAC_CARD_FIELDS,
  resolved: null,
  contextId: "ctx",
  context: null,
  formParams: null,
  visibility: "public",
  baseUrl: "http://localhost",
  isFormLoading: false,
  configError: null as Error | null,
  refetchConfig: (() => {}) as () => void,
};
const CONTEXT_AT_REST = { ...contextState };

vi.mock("../hooks/useAacDirectoryContext", () => ({
  useAacDirectoryContext: () => contextState,
}));
/**
 * État du listing, MUTABLE d'un test à l'autre : c'est l'état de la requête
 * qu'on fait varier, pas le composant. Remis au repos avant chaque test.
 */
const communsState: UseAacCommunsResult = {
  communs: [],
  totalCount: 0,
  isLoading: false,
  isPending: false,
  isFetching: false,
  isFetchingNextPage: false,
  isFetchNextPageError: false,
  hasNextPage: false,
  fetchNextPage: () => Promise.resolve(),
  lastItemRef: () => {},
  error: null,
  refetch: () => Promise.resolve(),
};
const COMMUNS_AT_REST = { ...communsState };

vi.mock("../hooks/useAacCommuns", () => ({
  useAacCommuns: () => communsState,
}));
vi.mock("../hooks/useAacFacets", () => ({
  useAacFacets: () => ({ usageTree: [], tagOptions: [], isLoading: false }),
}));

// Le panneau n'est pas le sujet : on ne retient que ce que la section lui DIT
// d'afficher — un marqueur par filtre activé.
vi.mock("../components/directory/AacDirectoryFilters", () => ({
  AacDirectoryFilters: ({ enabled }: { enabled: AacDirectoryEnabledFilters }) => (
    <div>
      {(Object.keys(enabled) as Array<keyof AacDirectoryEnabledFilters>)
        .filter((key) => enabled[key])
        .map((key) => (
          <span key={key} data-testid={`filter-${key}`} />
        ))}
    </div>
  ),
}));
// Les résultats ne sont pas le sujet non plus : on ne retient que l'ÉTAT que
// la section leur transmet — c'est lui qui décide entre squelette et « vide ».
vi.mock("../components/directory/AacDirectoryResults", () => ({
  AacDirectoryResults: ({
    isLoading,
    error,
    onRetry,
  }: {
    isLoading: boolean;
    error: Error | null;
    onRetry?: () => void;
  }) => (
    <div data-testid="results" data-loading={String(isLoading)} data-error={String(!!error)}>
      <button type="button" onClick={onRetry}>
        retry
      </button>
    </div>
  ),
}));
vi.mock("../components/directory/AacDepositButton", () => ({
  AacDepositButton: () => null,
}));

import AacDirectorySection from "./AacDirectorySection";

const ALL_FILTERS = ["search", "usage", "tags", "maturity", "sort"] as const;

/**
 * Les props arrivent de la config SANS parse Zod : le type `z.infer` promet un
 * bloc `filters` complet, la réalité livre ce que le JSON contient. Le cast
 * reproduit exactement cette réalité.
 */
function renderSection(props: Record<string, unknown>) {
  return render(
    <MemoryRouter>
      <AacDirectorySection props={props as unknown as AacDirectorySectionProps} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.assign(communsState, COMMUNS_AT_REST);
  Object.assign(contextState, CONTEXT_AT_REST);
});

describe("AacDirectorySection — bloc `filters` de la config", () => {
  it("un bloc PARTIEL n'éteint que le filtre cité (M4/M22/M24)", () => {
    renderSection({ filters: { search: false } });

    expect(screen.queryByTestId("filter-search")).toBeNull();
    for (const key of ALL_FILTERS.filter((k) => k !== "search")) {
      expect(screen.getByTestId(`filter-${key}`)).toBeTruthy();
    }
  });

  it("sans bloc `filters`, tout est affiché", () => {
    renderSection({});

    for (const key of ALL_FILTERS) {
      expect(screen.getByTestId(`filter-${key}`)).toBeTruthy();
    }
  });

  it("un bloc COMPLET est honoré tel quel", () => {
    renderSection({
      filters: { search: false, usage: false, tags: false, maturity: false, sort: false },
    });

    for (const key of ALL_FILTERS) {
      expect(screen.queryByTestId(`filter-${key}`)).toBeNull();
    }
  });
});

/**
 * H8 — tant que le formulaire n'est pas résolu, la requête des communs est
 * DÉSACTIVÉE : React Query la dit `pending` sans la dire `fetching`, donc
 * `isLoading` vaut false alors que rien n'a encore été demandé. Passé tel quel,
 * cet `isLoading` faisait tomber les résultats sur « Aucun commun » — en SSR et
 * au premier rendu client — là où le squelette est attendu.
 */
describe("AacDirectorySection — attente du formulaire (H8)", () => {
  it("annonce le chargement quand la requête est en attente sans être en vol", () => {
    // Le listing est désactivé (`pending` sans `fetching`) PARCE QUE la
    // résolution du formulaire, elle, est en vol : c'est bien une attente.
    communsState.isPending = true;
    communsState.isLoading = false;
    contextState.isFormLoading = true;

    renderSection({});

    expect(screen.getByTestId("results").dataset.loading).toBe("true");
  });

  it("idem en variante `preview`", () => {
    communsState.isPending = true;
    communsState.isLoading = false;
    contextState.isFormLoading = true;

    renderSection({ variant: "preview" });

    expect(screen.getByTestId("results").dataset.loading).toBe("true");
  });

  it("ne le fait plus une fois la première réponse arrivée, même vide", () => {
    // `isPending` retombe dès la première réponse : une liste vide est alors
    // une VRAIE absence de communs, à afficher comme telle.
    communsState.isPending = false;
    communsState.isLoading = false;

    renderSection({});

    expect(screen.getByTestId("results").dataset.loading).toBe("false");
  });
});

/**
 * Le revers de H8 : une requête DÉSACTIVÉE reste `pending` indéfiniment. Quand
 * la résolution du formulaire n'aboutit jamais — formulaire supprimé, 403, pas
 * d'entité costum — `isPending` seul figeait l'annuaire (et l'aperçu de
 * l'accueil) sur une grille de squelettes perpétuels : ni message, ni reprise,
 * ni état vide. L'attente ne vaut donc que tant que la résolution est en vol.
 */
describe("AacDirectorySection — le formulaire ne se résoudra jamais", () => {
  it("conclut à l'état vide plutôt que de laisser un squelette perpétuel", () => {
    communsState.isPending = true;
    communsState.isLoading = false;
    contextState.isFormLoading = false;

    renderSection({});

    expect(screen.getByTestId("results").dataset.loading).toBe("false");
  });

  it("idem en variante `preview`", () => {
    communsState.isPending = true;
    communsState.isLoading = false;
    contextState.isFormLoading = false;

    renderSection({ variant: "preview" });

    expect(screen.getByTestId("results").dataset.loading).toBe("false");
  });

  it("annonce l'échec de résolution aux résultats — le panneau d'erreur, pas « aucun commun »", () => {
    communsState.isPending = true;
    communsState.isLoading = false;
    contextState.configError = new Error("form supprimé");

    renderSection({});

    const results = screen.getByTestId("results");
    expect(results.dataset.error).toBe("true");
    expect(results.dataset.loading).toBe("false");
  });

  it("la reprise rejoue la RÉSOLUTION, pas un listing qui n'a jamais démarré", () => {
    const refetchConfig = vi.fn();
    const refetch = vi.fn(() => Promise.resolve());
    const fetchNextPage = vi.fn(() => Promise.resolve());
    contextState.configError = new Error("form supprimé");
    contextState.refetchConfig = refetchConfig;
    Object.assign(communsState, { isPending: true, refetch, fetchNextPage });

    renderSection({});
    fireEvent.click(screen.getByRole("button", { name: "retry" }));

    expect(refetchConfig).toHaveBeenCalledTimes(1);
    expect(refetch).not.toHaveBeenCalled();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});

/**
 * H9 — la reprise relance la PAGE en défaut si c'est une page suivante qui a
 * échoué (les précédentes sont intactes dans le cache), tout le listing sinon.
 * Refetcher 24 cartes pour en récupérer 12 serait un gaspillage ; relancer
 * `fetchNextPage` sur une erreur de première page ne relancerait rien.
 */
describe("AacDirectorySection — reprise après échec (H9)", () => {
  it("relance la page suivante quand c'est elle qui a échoué", () => {
    const fetchNextPage = vi.fn(() => Promise.resolve());
    const refetch = vi.fn(() => Promise.resolve());
    Object.assign(communsState, {
      error: new Error("503"),
      isFetchNextPageError: true,
      fetchNextPage,
      refetch,
    });

    renderSection({});
    fireEvent.click(screen.getByRole("button", { name: "retry" }));

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(refetch).not.toHaveBeenCalled();
  });

  it("relance tout le listing sinon", () => {
    const fetchNextPage = vi.fn(() => Promise.resolve());
    const refetch = vi.fn(() => Promise.resolve());
    Object.assign(communsState, {
      error: new Error("503"),
      isFetchNextPageError: false,
      fetchNextPage,
      refetch,
    });

    renderSection({});
    fireEvent.click(screen.getByRole("button", { name: "retry" }));

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});
