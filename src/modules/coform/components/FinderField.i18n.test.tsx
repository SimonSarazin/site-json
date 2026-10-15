// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "@/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { SiteContext } from "@/contexts/SiteContext";
import type { CoFormData, FormFieldMapping } from "../types";
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

// Un finder tel qu'il est en base : défauts legacy, et pas de `buttonLabel` (aucun des 89 blocs de
// la base de dev n'en porte, mesuré le 12/10).
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

/** Le champ de `FORMULAIRE`, son bloc de paramètres remplacé par celui donné. */
function champAvec(finder: Record<string, unknown>): FormFieldMapping {
  const formulaire = { ...FORMULAIRE, params: { finderpartenaires: finder } } as unknown as CoFormData;
  return parseCoFormFields(formulaire)[0].fields[0];
}

function rendre(champ: FormFieldMapping, config: Record<string, unknown> = {}) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LocalizationProvider>
        <SiteContext.Provider value={{ config, setConfig: () => {} } as never}>
          <FinderField field={champ} errors={{}} value={null} onChange={() => {}} />
        </SiteContext.Provider>
      </LocalizationProvider>
    </QueryClientProvider>
  );
}

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

describe("FinderField — en anglais, un finder aux libellés legacy par défaut", () => {
  it("bouton, titre, placeholder et invite « Ajouter » sont en anglais", async () => {
    const champ = parseCoFormFields(FORMULAIRE)[0].fields[0];
    rendre(champ, {
      coform: { finderAddNew: { [champ.name]: "add-cae" } },
      costumForms: { cae: { id: "cae", entityType: "organizations" } },
    });
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

// Aucune modale legacy n'écrit `buttonLabel`, mais `cplx/finder.php` le lit : on peut l'avoir posé en
// base à la main.
describe("FinderField — en anglais, un `buttonLabel` posé en base", () => {
  it("personnalisé, il s'affiche tel quel sur le bouton", () => {
    rendre(champAvec({ type: "organizations", buttonLabel: "Chercher ma coopérative" }));
    expect(screen.getByRole("button", { name: /Partenaires/ })).toHaveTextContent("Chercher ma coopérative");
    expect(screen.queryByText("Search and add")).not.toBeInTheDocument();
  });

  it("égal au défaut du legacy, il passe en anglais", () => {
    rendre(champAvec({ type: "organizations", buttonLabel: "Rechercher et ajouter" }));
    expect(screen.getByRole("button", { name: /Partenaires/ })).toHaveTextContent("Search and add");
    expect(document.body.textContent).not.toMatch(/Rechercher/);
  });
});
