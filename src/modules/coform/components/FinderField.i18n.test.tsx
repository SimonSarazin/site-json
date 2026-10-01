// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "@/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { SiteContext } from "@/contexts/SiteContext";
import type { CoFormData } from "../types";
import { parseCoFormFields } from "../utils/formParser";
import "../i18n/i18n";

/**
 * Le rendu ANGLAIS d'un finder configuré dans le legacy, SANS mock de `useT` (contrairement à
 * `FinderField.test.tsx`) : libellés absents ou restés aux défauts que la modale de configuration
 * legacy enregistre, le finder affichait du français — « Your Elément doesn't exist yet? ». Le bundle
 * coform est enregistré par import, comme le font `DynamicCoForm` et `MultiStepCoForm`.
 */

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
vi.mock("@/modules/profil/components/add/ModalRegistry", () => ({ DynamicModal: () => null }));

const { FinderField } = await import("./FinderField");

// Un finder tel qu'il est en base : défauts legacy, et pas de `buttonLabel` (aucun des 86 n'en a).
const FORMULAIRE = {
  _id: { _str: "form123" },
  id: "form123",
  name: "Dépôt",
  created: 0,
  creator: "creator1",
  type: "form",
  inputs: {
    step1: {
      name: "Étape 1",
      id: "step1",
      formParent: "form123",
      inputs: { partenaires: { label: "Partenaires", type: "tpls.forms.cplx.finder" } },
    },
  },
  params: {
    finderpartenaires: {
      type: "organizations",
      addNew: "true",
      elementLabel: "Elément",
      placeholderSearchField: "Saisir le nom de l'élément que vous recherchez",
    },
  },
} as unknown as CoFormData;

describe("FinderField — en anglais, un finder aux libellés legacy par défaut", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("bouton, titre, placeholder et invite « Ajouter » sont en anglais", async () => {
    const champ = parseCoFormFields(FORMULAIRE)[0].fields[0];
    const site = { config: { coform: { finderAddNew: { [champ.name]: "add-cae" } } }, setConfig: () => {} };
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LocalizationProvider>
          <SiteContext.Provider value={site as never}>
            <FinderField field={champ} errors={{}} value={null} onChange={() => {}} />
          </SiteContext.Provider>
        </LocalizationProvider>
      </QueryClientProvider>
    );
    expect(screen.getByText("Search and add")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Partenaires/ }));
    expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument();
    const saisie = screen.getByRole("textbox");
    expect(saisie).toHaveAttribute("placeholder", "Enter the name of the element to search");
    await user.type(saisie, "New cooperative");
    expect(screen.getByText("Your element doesn't exist yet?")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Elément|Élément|Saisir|Rechercher/);
  });
});
