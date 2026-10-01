// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SiteContext } from "@/contexts/SiteContext";
import type { FormFieldMapping } from "../types";

/**
 * `FinderField` : la modale de création du bouton « Ajouter » vient de la config du SITE — lue de façon
 * FACULTATIVE, car `CoFormReadOnly` rend ce champ hors providers (une réponse doit rester lisible).
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, _fallback?: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("../hooks/useFinderSearchResults", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../hooks/useFinderSearchResults")>()),
  useFinderSearchResults: () => ({
    results: [],
    isFetching: false,
    isCurrentAnswer: true,
    error: null,
    retry: () => {},
    canRetry: true,
  }),
}));
const modales = vi.hoisted(() => [] as string[]);
vi.mock("@/modules/profil/components/add/ModalRegistry", () => ({
  DynamicModal: ({ modalName }: { modalName: string }) => {
    modales.push(modalName);
    return null;
  },
}));

const { FinderField } = await import("./FinderField");

const CHAMP = {
  name: "finderaapStep1partenaires",
  label: "Partenaires du commun",
  componentType: "finder",
  finderConfig: { type: "organizations", addNew: true, elementLabel: "CAE", multiple: true },
} as unknown as FormFieldMapping;

const avecRequetes = (enfant: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{enfant}</QueryClientProvider>
);

beforeEach(() => {
  modales.length = 0;
});

describe("FinderField — « Ajouter »", () => {
  it("en lecture seule, HORS providers de site et de session : la réponse s'affiche", () => {
    render(avecRequetes(
      <FinderField field={CHAMP} errors={{}} readOnly hideLabel value={{ a1: { id: "a1", name: "Suite126", type: "organizations" } }} />
    ));
    expect(screen.getByText("Suite126")).toBeInTheDocument();
  });

  it("ouvre la modale que le site déclare pour cette question", async () => {
    const site = { config: { coform: { finderAddNew: { finderaapStep1partenaires: "add-cae" } } }, setConfig: () => {} };
    render(avecRequetes(
      <SiteContext.Provider value={site as never}>
        <FinderField field={CHAMP} errors={{}} value={null} onChange={() => {}} />
      </SiteContext.Provider>
    ));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Partenaires du commun/ }));
    await user.type(screen.getByRole("textbox"), "Nouvelle CAE");
    await user.click(screen.getByRole("button", { name: "coform.finder.modal.addNewButton" }));
    expect(modales[modales.length - 1]).toBe("add-cae");
  });
});
