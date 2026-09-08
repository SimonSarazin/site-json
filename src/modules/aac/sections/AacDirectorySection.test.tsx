// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { AacDirectoryEnabledFilters } from "../lib/directoryFilters";
import { EMPTY_AAC_CARD_FIELDS } from "../lib/resolveAacCardFields";
import type { AacDirectorySectionProps } from "../schema";

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

vi.mock("../hooks/useAacDirectoryContext", () => ({
  useAacDirectoryContext: () => ({
    formId: "f1",
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
  }),
}));
vi.mock("../hooks/useAacCommuns", () => ({
  useAacCommuns: () => ({
    communs: [],
    totalCount: 0,
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    lastItemRef: () => {},
    error: null,
  }),
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
vi.mock("../components/directory/AacDirectoryResults", () => ({
  AacDirectoryResults: () => null,
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
