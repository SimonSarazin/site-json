// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Suspense, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { EMPTY_AAC_FILTERS } from "../../../lib/filtersKey";
import { EMPTY_AAC_USAGE } from "../../../lib/aacUsage";
import { DEFAULT_AAC_DIRECTORY_FILTERS, type AacDirectoryEnabledFilters } from "../../../lib/directoryFilters";
import { communPath } from "../../../lib/communPath";
import type { AacCommunCard as CommunCard } from "../../../lib/parseAacAnswer";
import type { AacDirectoryReadyVM } from "../../../hooks/useAacDirectoryController";
import type { LazyVariant } from "@/lib/variants";

/**
 * Conformité des interfaces de l'annuaire, paramétrée sur les clés des registres.
 *  - Communs (carte et ligne) : lien vers la fiche, titre ou repli, badge « en attente » ssi
 *    `isSelected === false`, suppression ssi le droit est accordé, sur ce commun.
 *  - Dispositions : un contrôle `data-aac-filter="<nom>"` par filtre activé et résolu, compteur,
 *    bascule, dépôt, résultats du contrôleur ; en vitrine, le lien « voir tout » sans commande.
 */

// Paramètres d'interpolation visibles : le compteur peut être dans la chaîne traduite.
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, _default?: unknown, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(" ")}` : key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

/** Les props reçues par chaque sonde, au dernier rendu. */
const received: Record<string, unknown> = {};

// Sonde du panneau par défaut : un marqueur par filtre reçu activé.
vi.mock("../AacDirectoryFilters", () => ({
  AacDirectoryFilters: ({ enabled }: { enabled: AacDirectoryEnabledFilters }) => (
    <div>
      {(Object.keys(enabled) as Array<keyof AacDirectoryEnabledFilters>)
        .filter((k) => enabled[k])
        .map((k) => (
          <span key={k} data-aac-filter={k} />
        ))}
    </div>
  ),
}));
vi.mock("../AacDirectoryResults", () => ({
  AacDirectoryResults: (props: Record<string, unknown>) => {
    received.results = props;
    return <div data-testid="results" />;
  },
}));
vi.mock("../AacDepositButton", () => ({
  AacDepositButton: (props: Record<string, unknown>) => {
    received.deposit = props;
    return <button type="button">deposit</button>;
  },
}));
vi.mock("../AacHiddenTagsBadge", () => ({ AacHiddenTagsBadge: () => null }));

const { AAC_DIRECTORY_CARD_VARIANTS, AAC_DIRECTORY_ROW_VARIANTS, AAC_DIRECTORY_SKELETON_VARIANTS } =
  await import("./items");
const { AAC_DIRECTORY_SHELL_VARIANTS } = await import("./shells");

function commun(patch: Partial<CommunCard> = {}): CommunCard {
  return {
    id: "c1",
    title: "Peertube des CAE",
    hasTitle: true,
    description: "Partage vidéo",
    tags: ["video", "libre", "mutualisation"],
    keywords: [],
    maturity: "Utilisable",
    imageUrl: null,
    funds: [],
    totalRequested: 1000,
    totalFunded: 250,
    progressPercent: 25,
    hasFundingRequest: true,
    usersCount: 4,
    interestCount: 2,
    isSelected: true,
    usage: EMPTY_AAC_USAGE,
    address: null,
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  };
}

async function renderLazy(variant: LazyVariant<never>, node: ReactNode) {
  await act(async () => {
    await variant.preload();
  });
  await act(async () => {
    render(
      <MemoryRouter>
        <Suspense fallback={<div data-testid="suspended" />}>{node}</Suspense>
      </MemoryRouter>
    );
  });
  await waitFor(() => expect(screen.queryByTestId("suspended")).toBeNull());
}

beforeEach(() => {
  for (const k of Object.keys(received)) delete received[k];
});
afterEach(cleanup);

describe("registres des communs de l'annuaire", () => {
  it("carte et ligne vont par paire : mêmes clés", () => {
    expect(AAC_DIRECTORY_CARD_VARIANTS.keys().sort()).toEqual(AAC_DIRECTORY_ROW_VARIANTS.keys().sort());
  });

  it("un squelette n'existe que pour une interface de commun déclarée", () => {
    for (const key of AAC_DIRECTORY_SKELETON_VARIANTS.keys()) {
      expect(AAC_DIRECTORY_CARD_VARIANTS.has(key), `squelette « ${key} » sans carte`).toBe(true);
    }
  });
});

describe.each(AAC_DIRECTORY_CARD_VARIANTS.keys())("interface de commun « %s »", (key) => {
  const Card = AAC_DIRECTORY_CARD_VARIANTS.get(key);
  const Row = AAC_DIRECTORY_ROW_VARIANTS.get(key);

  describe.each([
    ["carte", Card],
    ["ligne", Row],
  ] as const)("%s", (_label, Item) => {
    it("mène à la fiche du commun, sous son titre", async () => {
      await renderLazy(Item as LazyVariant<never>, <Item commun={commun()} />);

      const links = document.querySelectorAll(`a[href="${communPath("c1")}"]`);
      expect(links.length).toBeGreaterThan(0);
      expect(screen.getAllByText("Peertube des CAE").length).toBeGreaterThan(0);
    });

    it("sans titre : le repli, jamais un titre vide", async () => {
      await renderLazy(Item as LazyVariant<never>, <Item commun={commun({ hasTitle: false, title: "(No title)" })} />);

      expect(screen.getAllByText("directory.card.untitled").length).toBeGreaterThan(0);
    });

    it("badge « en attente » ssi le commun n'est pas sélectionné", async () => {
      await renderLazy(Item as LazyVariant<never>, <Item commun={commun({ isSelected: false })} />);
      expect(screen.getAllByText("directory.card.pending").length).toBeGreaterThan(0);
      cleanup();

      await renderLazy(Item as LazyVariant<never>, <Item commun={commun({ isSelected: null })} />);
      expect(screen.queryByText("directory.card.pending")).toBeNull();
    });

    it("suppression : un bouton ssi le droit est accordé, et il vise CE commun", async () => {
      await renderLazy(Item as LazyVariant<never>, <Item commun={commun()} />);
      expect(screen.queryByRole("button", { name: /directory\.card\.deleteAria/ })).toBeNull();
      cleanup();

      const onRequestDelete = vi.fn();
      const c = commun();
      await renderLazy(Item as LazyVariant<never>, <Item commun={c} onRequestDelete={onRequestDelete} />);
      fireEvent.click(screen.getByRole("button", { name: /directory\.card\.deleteAria/ }));
      expect(onRequestDelete).toHaveBeenCalledWith(c);
    });
  });
});

/** Un annuaire COMPLET prêt : tous les filtres activés ET résolus, avec des options. */
function makeVM(patch: Partial<AacDirectoryReadyVM> = {}, enabled: Partial<AacDirectoryEnabledFilters> = {}): AacDirectoryReadyVM {
  return {
    status: "ready",
    mode: "full",
    header: { title: "Les communs", description: null, deposit: { formId: "f1", stepKey: "aapStep1" } },
    filters: {
      filters: EMPTY_AAC_FILTERS,
      onChange: vi.fn(),
      usageTree: [{ id: "outil", label: "Outil", count: 1, children: [] }],
      tagOptions: [{ id: "video", label: "video", count: 1 }],
      communeOptions: [{ id: "Saint-Denis", label: "Saint-Denis", count: 1 }],
      maturityField: {
        stepKey: "s",
        id: "m",
        path: "answers.s.m",
        label: "Utilisable ?",
        options: [{ value: "oui", label: "Oui" }],
      },
      enabled: { ...DEFAULT_AAC_DIRECTORY_FILTERS, ...enabled },
      isLoading: false,
    },
    count: 12,
    display: { value: "grid", onChange: vi.fn() },
    results: { communs: [], display: "grid", columns: 3, isLoading: false, isFetchingNextPage: false, error: null, lastItemRef: () => {}, itemVariant: "x" },
    moreLink: { href: "/aac/communs", label: "Tout voir" },
    deletion: {} as AacDirectoryReadyVM["deletion"],
    ...patch,
  } as AacDirectoryReadyVM;
}

const FILTERS = ["search", "usage", "tags", "maturity", "commune", "sort"] as const;
const filterControl = (name: string) => document.querySelector(`[data-aac-filter="${name}"]`);

describe.each(AAC_DIRECTORY_SHELL_VARIANTS.keys())("disposition d'annuaire « %s »", (key) => {
  const Shell = AAC_DIRECTORY_SHELL_VARIANTS.get(key);

  it("annuaire complet : un contrôle par filtre activé et résolu", async () => {
    await renderLazy(Shell as LazyVariant<never>, <Shell vm={makeVM()} />);

    for (const name of FILTERS) {
      expect(filterControl(name), `filtre « ${name} » sans contrôle`).not.toBeNull();
    }
  });

  it("un filtre éteint en config n'a pas de contrôle", async () => {
    await renderLazy(Shell as LazyVariant<never>, <Shell vm={makeVM({}, { tags: false, sort: false })} />);

    expect(filterControl("tags")).toBeNull();
    expect(filterControl("sort")).toBeNull();
    expect(filterControl("search")).not.toBeNull();
  });

  it("compteur, bascule grille/liste, dépôt et résultats tels que câblés", async () => {
    const vm = makeVM();
    await renderLazy(Shell as LazyVariant<never>, <Shell vm={vm} />);

    expect(screen.getByText(/12/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "directory.display.list" }));
    expect(vm.display.onChange).toHaveBeenCalledWith("list");
    expect(received.deposit).toEqual(vm.header?.deposit);
    expect(received.results).toEqual(vm.results);
  });

  it("vitrine : les résultats et le lien « voir tout », sans aucune commande", async () => {
    const vm = makeVM({ mode: "preview" });
    await renderLazy(Shell as LazyVariant<never>, <Shell vm={vm} />);

    expect(received.results).toEqual(vm.results);
    expect(document.querySelector('a[href="/aac/communs"]')).not.toBeNull();
    for (const name of FILTERS) expect(filterControl(name)).toBeNull();
    expect(screen.queryByRole("radio", { name: "directory.display.list" })).toBeNull();
  });
});
