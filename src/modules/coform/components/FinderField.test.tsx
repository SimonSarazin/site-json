// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SiteContext } from "@/contexts/SiteContext";
import type { FormFieldMapping } from "../types";

/**
 * `FinderField` : la modale de création du bouton « Ajouter » vient de la config du SITE — lue de façon
 * FACULTATIVE, car `CoFormReadOnly` rend ce champ hors providers (une réponse doit rester lisible).
 * Le choix de la modale est testé à part (`finderAddNew.test.ts`) ; ici, ce que le CHAMP en fait.
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

/** Le formulaire costum « Créer votre CAE », seul formulaire d'organisations du site. */
const COSTUM_FORMS = { cae: { id: "cae", entityType: "organizations", costumSlug: "federationDesCae" } };
const siteAvec = (finderAddNew?: Record<string, string>) =>
  ({ config: { coform: finderAddNew ? { finderAddNew } : undefined, costumForms: COSTUM_FORMS }, setConfig: () => {} });

/** Monte le champ dans un site, cherche « Nouvelle CAE » (aucun résultat) et rend de quoi cliquer. */
async function chercherSansResultat(champ: FormFieldMapping, site: ReturnType<typeof siteAvec>) {
  render(avecRequetes(
    <SiteContext.Provider value={site as never}>
      <FinderField field={champ} errors={{}} value={null} onChange={() => {}} />
    </SiteContext.Provider>
  ));
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Partenaires du commun/ }));
  await user.type(screen.getByRole("textbox"), "Nouvelle CAE");
  return user;
}

beforeEach(() => {
  modales.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("FinderField — « Ajouter »", () => {
  it("en lecture seule, HORS providers de site et de session : la réponse s'affiche", () => {
    render(avecRequetes(
      <FinderField field={CHAMP} errors={{}} readOnly hideLabel value={{ a1: { id: "a1", name: "Suite126", type: "organizations" } }} />
    ));
    expect(screen.getByText("Suite126")).toBeInTheDocument();
  });

  it("ouvre la modale que le site déclare pour cette question", async () => {
    const user = await chercherSansResultat(CHAMP, siteAvec({ finderaapStep1partenaires: "add-cae" }));
    await user.click(screen.getByRole("button", { name: "coform.finder.modal.addNewButton" }));
    expect(modales[modales.length - 1]).toBe("add-cae");
  });

  it("sans déclaration, ouvre la modale STANDARD — pas le formulaire costum du site, même unique pour le type", async () => {
    const user = await chercherSansResultat(CHAMP, siteAvec());
    await user.click(screen.getByRole("button", { name: "coform.finder.modal.addNewButton" }));
    expect(modales[modales.length - 1]).toBe("add-organization");
  });

  it("finder à PLUSIEURS types : « Ajouter » reste, sur le formulaire du premier type", async () => {
    // Le typage dit une chaîne ; la donnée n'y est pas tenue. Sans cela : pas de bouton, sans trace.
    const champ = {
      ...CHAMP,
      finderConfig: { ...CHAMP.finderConfig, type: ["projects", "organizations"] },
    } as unknown as FormFieldMapping;
    const user = await chercherSansResultat(champ, siteAvec());
    await user.click(screen.getByRole("button", { name: "coform.finder.modal.addNewButton" }));
    expect(modales[modales.length - 1]).toBe("add-project");
  });

  it("une déclaration qui ne désigne aucune modale : pas de bouton « Ajouter », plutôt qu'un bouton sans effet", async () => {
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => {});
    await chercherSansResultat(CHAMP, siteAvec({ finderaapStep1partenaires: "add-ca" }));
    expect(screen.getByText(/coform\.finder\.modal\.noResults/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "coform.finder.modal.addNewButton" })).not.toBeInTheDocument();
    // … et c'est dit, en développement, à qui configure — UNE fois, pas à chaque rendu du champ
    // (ouvrir la modale et taper l'ont déjà fait se rendre plusieurs fois).
    expect(avertir).toHaveBeenCalledTimes(1);
    expect(avertir.mock.calls[0][0]).toContain("coform.finderAddNew.finderaapStep1partenaires = « add-ca »");
  });

  it("hors développement, la déclaration morte ne dit rien dans la console", async () => {
    vi.stubEnv("DEV", false);
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => {});
    await chercherSansResultat(CHAMP, siteAvec({ finderaapStep1partenaires: "add-ca" }));
    expect(screen.queryByRole("button", { name: "coform.finder.modal.addNewButton" })).not.toBeInTheDocument();
    expect(avertir).not.toHaveBeenCalled();
  });

  it("une déclaration ouvrable, ou pas de déclaration : aucun avertissement", async () => {
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => {});
    await chercherSansResultat(CHAMP, siteAvec({ finderaapStep1partenaires: "add-cae" }));
    expect(screen.getByRole("button", { name: "coform.finder.modal.addNewButton" })).toBeInTheDocument();
    expect(avertir).not.toHaveBeenCalled();
  });

  it("en lecture seule, rien n'est résolu ni signalé : le bouton « Ajouter » n'y existe pas", () => {
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(avecRequetes(
      <SiteContext.Provider value={siteAvec({ finderaapStep1partenaires: "add-ca" }) as never}>
        <FinderField field={CHAMP} errors={{}} readOnly value={{ a1: { id: "a1", name: "Suite126", type: "organizations" } }} />
      </SiteContext.Provider>
    ));
    expect(screen.getByText("Suite126")).toBeInTheDocument();
    expect(avertir).not.toHaveBeenCalled();
  });

  it("un finder de personnes sans déclaration : pas de bouton, et rien à signaler — il n'y a rien à créer", async () => {
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => {});
    const champ = { ...CHAMP, finderConfig: { ...CHAMP.finderConfig, type: "citoyens" } } as unknown as FormFieldMapping;
    await chercherSansResultat(champ, siteAvec());
    expect(screen.queryByRole("button", { name: "coform.finder.modal.addNewButton" })).not.toBeInTheDocument();
    expect(avertir).not.toHaveBeenCalled();
  });
});

describe("FinderField — libellés non configurés", () => {
  it("rend les libellés traduits, jamais un défaut écrit en français (« Your Élément… » en anglais)", async () => {
    const champ = { ...CHAMP, finderConfig: { type: "organizations", addNew: true, multiple: true } } as unknown as FormFieldMapping;
    const site = siteAvec({ finderaapStep1partenaires: "add-cae" });
    render(avecRequetes(
      <SiteContext.Provider value={site as never}>
        <FinderField field={champ} errors={{}} value={null} onChange={() => {}} />
      </SiteContext.Provider>
    ));
    expect(screen.getByText("coform.finder.fallbackButton")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Partenaires du commun/ }));
    expect(screen.getByRole("dialog", { name: "coform.finder.modal.title" })).toBeInTheDocument();
    const saisie = screen.getByRole("textbox");
    expect(saisie).toHaveAttribute("placeholder", "coform.finder.modal.searchPlaceholder");
    await user.type(saisie, "Nouvelle CAE");
    expect(
      screen.getByText(`coform.finder.modal.addNewPrompt ${JSON.stringify({ label: "coform.finder.fallbackElement" })}`)
    ).toBeInTheDocument();
  });
});
