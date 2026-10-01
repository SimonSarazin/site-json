// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import type { FinderConfig, FinderElement, FinderSearchResult } from "../types";
import { organisationSdk } from "../__fixtures__/organisationSdk";
import { COFORM_QUERY_KEYS } from "../constants/queryKeys";

/**
 * Le bouton « Ajouter » d'un finder (réglage `addNew`) : il ouvre la modale de CRÉATION déclarée par
 * le site, pré-remplie avec le nom cherché, et l'élément créé entre aussitôt dans la question —
 * comme le legacy (`finder.addInForm`). Jusqu'ici, le bouton n'affichait qu'un toast « à implémenter ».
 *
 * La modale de création est une frontière (son formulaire est testé à part) : on la remplace par un
 * bouton qui rend une VRAIE organisation SDK, pour que la conversion de l'élément créé soit la réelle.
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, _fallback?: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const etat = vi.hoisted(() => ({
  resultats: [] as FinderSearchResult[],
  /** La réponse affichée est celle de la saisie (`false` : recherche en vol, liste conservée, debounce). */
  courante: true,
  /** Une requête est en vol : le spinner du champ s'affiche. */
  charge: false,
  erreur: null as Error | null,
  relancer: (() => {}) as () => void,
  relancable: true,
  creee: null as unknown,
  modales: [] as Array<{ modalName: string; createDefaults?: Record<string, unknown> }>,
}));
vi.mock("../hooks/useFinderSearchResults", async (importOriginal) => ({
  // Le VRAI seuil : une copie ici pourrait diverger de celui du hook sans que rien ne casse.
  ...(await importOriginal<typeof import("../hooks/useFinderSearchResults")>()),
  useFinderSearchResults: () => ({
    results: etat.resultats,
    isFetching: etat.charge,
    isCurrentAnswer: etat.courante,
    error: etat.erreur,
    retry: etat.relancer,
    canRetry: etat.relancable,
  }),
}));
vi.mock("@/modules/profil/components/add/ModalRegistry", () => ({
  DynamicModal: (props: { modalName: string; createDefaults?: Record<string, unknown>; onCreated?: (e: unknown) => void }) => {
    etat.modales.push({ modalName: props.modalName, createDefaults: props.createDefaults });
    return (
      <button type="button" onClick={() => props.onCreated?.(etat.creee)}>
        enregistrer la création
      </button>
    );
  },
}));

const { FinderSearchModal } = await import("./FinderSearchModal");

const CREEE_ID = "6a0000000000000000000001";

/** La CAE « créée » : une vraie organisation SDK. */
const organisationCreee = () =>
  organisationSdk({ id: CREEE_ID, name: "Nouvelle CAE", type: "Cooperative", profilThumbImageUrl: "/upload/x/thumb/logo.png" });

function finder(overrides: Partial<FinderConfig> = {}): FinderConfig {
  return {
    type: "organizations",
    filters: [],
    excludeFilters: [],
    notSourceKey: true,
    myContacts: false,
    initCurrentUser: false,
    elementLabel: "CAE",
    buttonLabel: "Rechercher",
    placeholderSearchField: "Rechercher une CAE",
    field: "Partenaires",
    multiple: true,
    addNew: true,
    invite: false,
    linkToAnswer: false,
    singleAnswerPerElement: false,
    msgSingleAnswerPerElement: "",
    redirectSingleAnswerPerElement: "Accueil",
    editElement: false,
    addToLinks: { value: false, links: "" },
    ...overrides,
  };
}

const EXISTANTE: FinderSearchResult = { id: "687f9ccf3d82cf6bf133d3f0", name: "Suite126", type: "organizations" };

function monter(
  config: FinderConfig,
  addNewModal: string | null = "add-cae",
  selectedElements: Record<string, FinderElement> = {}
) {
  const onValidate = vi.fn();
  const onClose = vi.fn();
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <FinderSearchModal
        config={config}
        selectedElements={selectedElements}
        onClose={onClose}
        onValidate={onValidate}
        addNewModal={addNewModal}
      />
    </QueryClientProvider>
  );
  return { onValidate, onClose, queryClient, user: userEvent.setup() };
}

const CREEE_RANGEE = {
  id: CREEE_ID,
  name: "Nouvelle CAE",
  type: "organizations",
  img: "/upload/x/thumb/logo.png", // relative : la frontière d'écriture du finder
};

beforeEach(async () => {
  etat.resultats = [];
  etat.courante = true;
  etat.charge = false;
  etat.erreur = null;
  etat.relancer = vi.fn();
  etat.relancable = true;
  etat.modales = [];
  etat.creee = await organisationCreee();
});

describe("FinderSearchModal — « Ajouter »", () => {
  it("sans résultat : ouvre la création pré-remplie, et range l'élément créé dans la question", async () => {
    const { onValidate, onClose, user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "Nouvelle CAE");

    await user.click(screen.getByRole("button", { name: "coform.finder.modal.addNewButton" }));
    expect(etat.modales[etat.modales.length - 1]).toEqual({ modalName: "add-cae", createDefaults: { name: "Nouvelle CAE" } });

    await user.click(screen.getByRole("button", { name: "enregistrer la création" }));
    expect(onValidate).toHaveBeenCalledWith([CREEE_RANGEE]);
    expect(onClose).toHaveBeenCalled();
  });

  it("des résultats, mais pas le bon : l'ajout reste proposé sous la liste", async () => {
    etat.resultats = [EXISTANTE];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "Suite");

    expect(screen.getByText(/coform\.finder\.modal\.addNewNotListed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "coform.finder.modal.addNewButton" })).toBeInTheDocument();
  });

  it("choix multiple : l'élément créé S'AJOUTE à la sélection en cours", async () => {
    etat.resultats = [EXISTANTE];
    const { onValidate, user } = monter(finder({ multiple: true }));
    await user.type(screen.getByRole("textbox"), "Suite");
    await user.click(screen.getByRole("checkbox", { name: /Suite126/ }));

    await user.click(screen.getByRole("button", { name: "coform.finder.modal.addNewButton" }));
    await user.click(screen.getByRole("button", { name: "enregistrer la création" }));
    expect(onValidate).toHaveBeenCalledWith([expect.objectContaining({ id: EXISTANTE.id }), CREEE_RANGEE]);
  });

  it("choix unique : l'élément créé REMPLACE la sélection en cours", async () => {
    etat.resultats = [EXISTANTE];
    const { onValidate, user } = monter(finder({ multiple: false }));
    await user.type(screen.getByRole("textbox"), "Suite");
    await user.click(screen.getByRole("checkbox", { name: /Suite126/ }));

    await user.click(screen.getByRole("button", { name: "coform.finder.modal.addNewButton" }));
    await user.click(screen.getByRole("button", { name: "enregistrer la création" }));
    expect(onValidate).toHaveBeenCalledWith([CREEE_RANGEE]);
  });

  it("réponse pas encore celle de la saisie : la place est tenue — une seule annonce —, sans rien conclure", async () => {
    // Première recherche en vol, réponse VIDE conservée (champ vidé puis retapé), ou debounce en cours :
    // annoncer « aucun résultat » et offrir « Ajouter » ici, c'était créer avant de savoir.
    etat.courante = false;
    etat.charge = true; // le spinner du champ est rendu : il ne doit pas annoncer une seconde fois
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "Nouvelle CAE");

    expect(screen.getByRole("status")).toHaveTextContent("coform.finder.modal.searching");
    expect(screen.getAllByText("coform.finder.modal.searching")).toHaveLength(1);
    expect(screen.queryByText(/coform\.finder\.modal\.noResults/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "coform.finder.modal.addNewButton" })).not.toBeInTheDocument();
  });

  it("liste conservée d'une saisie précédente : elle reste affichée, mais « Ajouter » attend la réponse", async () => {
    etat.resultats = [EXISTANTE];
    etat.courante = false;
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "Suite12");

    expect(screen.getByRole("checkbox", { name: /Suite126/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "coform.finder.modal.addNewButton" })).not.toBeInTheDocument();
  });

  it("une erreur se dit, avec de quoi relancer — plus de « Recherche en cours… » sans fin", async () => {
    etat.courante = false;
    etat.erreur = new Error("500");
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "Nouvelle CAE");

    expect(screen.getByRole("alert")).toHaveTextContent("coform.finder.modal.searchError");
    expect(screen.queryByText("coform.finder.modal.searching")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "coform.finder.modal.addNewButton" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "coform.finder.modal.retry" }));
    expect(etat.relancer).toHaveBeenCalledTimes(1);
    // La relance retire l'alerte qui porte le bouton : le focus repart au champ, pas dans le vide.
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("sans entité hôte, pas de « Réessayer » : la relance ne pourrait rien changer", async () => {
    etat.courante = false;
    etat.erreur = new Error("hôte");
    etat.relancable = false;
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "Nouvelle CAE");

    expect(screen.getByRole("alert")).toHaveTextContent("coform.finder.modal.searchError");
    expect(screen.queryByRole("button", { name: "coform.finder.modal.retry" })).not.toBeInTheDocument();
  });

  it("créer par « Ajouter » oublie les recherches gardées en cache : l'élément créé répondra à la suivante", async () => {
    // Sinon la réponse VIDE en cache (30 s) se donnerait pour courante : « aucun résultat » et « Ajouter »
    // reproposés pour l'élément qui vient d'être créé — un doublon.
    const { queryClient, user } = monter(finder());
    queryClient.setQueryData(COFORM_QUERY_KEYS.FINDER_SEARCH(["organizations"], "Nouvelle CAE", undefined, true), []);
    await user.type(screen.getByRole("textbox"), "Nouvelle CAE");

    await user.click(screen.getByRole("button", { name: "coform.finder.modal.addNewButton" }));
    await user.click(screen.getByRole("button", { name: "enregistrer la création" }));
    expect(queryClient.getQueryCache().findAll({ queryKey: COFORM_QUERY_KEYS.FINDER_SEARCH_PREFIX() })).toHaveLength(0);
  });

  it("tout ce qui répond est déjà dans la question : « déjà sélectionnés », jamais « aucun résultat »", async () => {
    // « Aucun résultat » + « Ajouter » invitait à créer un doublon de ce qui est déjà dans la question.
    // Aucune liste n'est affichée : l'ajout se propose sans parler de « la liste ».
    etat.resultats = [EXISTANTE];
    const { user } = monter(finder(), "add-cae", { [EXISTANTE.id]: { id: EXISTANTE.id, name: "Suite126", type: "organizations" } });
    await user.type(screen.getByRole("textbox"), "Suite");

    expect(screen.getByText(/coform\.finder\.modal\.allAlreadySelected/)).toBeInTheDocument();
    expect(screen.queryByText(/coform\.finder\.modal\.noResults/)).not.toBeInTheDocument();
    expect(screen.queryByText(/coform\.finder\.modal\.addNewNotListed/)).not.toBeInTheDocument();
    expect(screen.getByText(/coform\.finder\.modal\.addNewPrompt/)).toBeInTheDocument();
  });

  it("sans modale de création résolue : pas de bouton, et l'invitation reprend sa place", async () => {
    const { user } = monter(finder({ type: "citoyens", invite: true }), null);
    await user.type(screen.getByRole("textbox"), "Dora");

    expect(screen.queryByRole("button", { name: "coform.finder.modal.addNewButton" })).not.toBeInTheDocument();
    expect(screen.getByText("coform.finder.modal.inviteTitle")).toBeInTheDocument();
  });
});
