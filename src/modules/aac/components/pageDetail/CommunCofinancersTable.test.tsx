// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { AacResolvedConfig } from "../../types";
import type { CoFormAnswer } from "@/modules/coform/types";

/**
 * La table des cofinanceurs de la fiche d'un commun (review MR 53, lot 2).
 */

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

/** Fiches renvoyées par le SDK, par id — vide par défaut (pas de photo, pas de slug). */
let fiches: Record<string, Record<string, unknown>> = {};
const api = {
  organization: vi.fn(async ({ id }: { id: string }) => ({ serverData: fiches[id] ?? {} })),
  user: vi.fn(async ({ id }: { id: string }) => ({ serverData: fiches[id] ?? {} })),
};
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ entity: { id: "host" }, api }),
}));

let depenses: Array<Record<string, unknown>> = [];
const useCommunRawDepenses = vi.fn(() => ({ data: depenses }));
vi.mock("@/modules/aac/hooks/useCommunRawDepenses", () => ({
  useCommunRawDepenses: (...args: unknown[]) => useCommunRawDepenses(...(args as [])),
}));

const { CommunCofinancersTable } = await import("./CommunCofinancersTable");

function makeConfig(depenseStepKey: string | null): AacResolvedConfig {
  return {
    formId: "f1",
    configId: null,
    aapType: "aac",
    steps: [],
    roles: { depenseStepKey, evalStepKey: null, financementStepKey: null, suiviStepKey: null },
    criteria: [],
    criteriaSource: "none",
    gates: {
      active: true,
      onlyMemberAccess: false,
      oneAnswerPerPers: false,
      canReadOtherAnswers: false,
      showAnswers: false,
      coremu: true,
      anyOnewithLinkCanAnswer: false,
    },
    campaigns: [],
    typeCoFinancer: null,
  };
}

const ANSWER = { _id: { $id: "a1" }, answers: {} } as unknown as CoFormAnswer;

function renderTable(over: Partial<Parameters<typeof CommunCofinancersTable>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LocalizationProvider>
          <CommunCofinancersTable
            formData={{ id: "f1", name: "Appel", inputs: {} } as never}
            answerQuery={ANSWER}
            aacConfig={makeConfig("etapeA")}
            funding={null}
            {...over}
          />
        </LocalizationProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  depenses = [];
  fiches = {};
  useCommunRawDepenses.mockClear();
  api.organization.mockClear();
  api.user.mockClear();
});

describe("CommunCofinancersTable — l'étape des dépenses est celle que la page a résolue (M13)", () => {
  it("passe `roles.depenseStepKey` à `useCommunRawDepenses`, jamais `aapStep1` en dur", () => {
    renderTable({ aacConfig: makeConfig("etapeA") });
    expect(useCommunRawDepenses).toHaveBeenCalledWith("a1", "etapeA");
  });
});

describe("CommunCofinancersTable — un financeur sans `financerId` reste listé (M16)", () => {
  /**
   * Le doublonnage porteur (doc/34 §2) arrive sans `id` : l'écarter le ferait disparaître de
   * la table, alors que la carte juste au-dessus le compte.
   */
  it("une ligne par financeur, id ou pas, avec son montant", () => {
    depenses = [
      {
        poste: "Serveur",
        priceInt: 1000,
        financer: [
          { id: "org1", name: "CAE Sud", amount: 500 },
          { name: "Doublonnage porteur", amount: 100, fundingType: "prepaid" },
        ],
      },
    ];
    renderTable();

    expect(screen.queryByText("detail.cofinancers.empty")).toBeNull();
    expect(screen.getByText("CAE Sud")).toBeTruthy();
    expect(screen.getByText("Doublonnage porteur")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(3); // en-tête + 2 lignes
  });

  it("avec uniquement des lignes sans id, la table n'affiche pas « aucun cofinanceur »", () => {
    depenses = [{ poste: "Serveur", priceInt: 1000, financer: [{ name: "Anonyme", amount: 40 }] }];
    renderTable();

    expect(screen.queryByText("detail.cofinancers.empty")).toBeNull();
    expect(screen.getByText("Anonyme")).toBeTruthy();
  });
});

describe("CommunCofinancersTable — photo et lien du cofinanceur, lus sur sa fiche", () => {
  it("le nom mène au profil `/profil/<slug>` du cofinanceur", async () => {
    fiches = { org1: { name: "CAE Sud", slug: "cae-sud", profilImageUrl: "/cae.jpg" } };
    depenses = [{ poste: "Serveur", priceInt: 1000, financer: [{ id: "org1", name: "CAE Sud", amount: 500 }] }];
    renderTable();

    const lien = await screen.findByRole("link", { name: "CAE Sud" });
    expect(lien.getAttribute("href")).toBe("/profil/cae-sud");
  });

  it("sans slug sur la fiche, le nom reste du texte simple", async () => {
    fiches = { org1: { name: "CAE Sud" } };
    depenses = [{ poste: "Serveur", priceInt: 1000, financer: [{ id: "org1", name: "CAE Sud", amount: 500 }] }];
    renderTable();

    await vi.waitFor(() => expect(api.organization).toHaveBeenCalled());
    expect(screen.getByText("CAE Sud")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("un citoyen se lit par `api.user`, un tiers-lieu (`tl`) comme une organisation", async () => {
    depenses = [
      {
        poste: "Serveur",
        priceInt: 1000,
        financer: [
          { id: "u1", name: "Alice", type: "citoyens", amount: 50 },
          { id: "tl1", name: "Tiers-lieu", type: "tl", amount: 300 },
        ],
      },
    ];
    renderTable();

    await vi.waitFor(() => {
      expect(api.user).toHaveBeenCalledWith({ id: "u1" });
      expect(api.organization).toHaveBeenCalledWith({ id: "tl1" });
    });
    expect(api.user).not.toHaveBeenCalledWith({ id: "tl1" });
  });

  it("une ligne sans id (doublonnage) ne déclenche aucune lecture de fiche", async () => {
    depenses = [{ poste: "Serveur", priceInt: 1000, financer: [{ name: "Anonyme", amount: 40 }] }];
    renderTable();

    expect(screen.getByText("Anonyme")).toBeTruthy();
    expect(api.organization).not.toHaveBeenCalled();
    expect(api.user).not.toHaveBeenCalled();
  });
});
