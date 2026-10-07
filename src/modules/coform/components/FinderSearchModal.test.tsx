// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

/**
 * Un élément sélectionné dans la modale change de zone : il quitte les résultats pour « Sélectionnés ».
 * Il s'affichait dans les deux à la fois — coché dans la liste, et en double au-dessus.
 */
describe("FinderSearchModal — sélection", () => {
  const AUTRE: FinderSearchResult = { id: "687f9ccf3d82cf6bf133d3f1", name: "Coopaname", type: "organizations" };
  const TROISIEME: FinderSearchResult = { id: "687f9ccf3d82cf6bf133d3f2", name: "Oxalis", type: "organizations" };
  const DANS_LA_QUESTION = { [EXISTANTE.id]: { id: EXISTANTE.id, name: "Suite126", type: "organizations" as const } };
  const resultats = (count: number) => `coform.finder.modal.resultsHeading ${JSON.stringify({ count: String(count) })}`;
  const annonce = (cle: string, name: string) => `coform.finder.modal.${cle} ${JSON.stringify({ name })}`;
  const caseDe = (nom: RegExp) => screen.getByRole("checkbox", { name: nom });

  it("l'élément sélectionné quitte les résultats ; désélectionné, il y revient", async () => {
    etat.resultats = [EXISTANTE, AUTRE];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "coop");
    expect(screen.getByText(resultats(2))).toBeInTheDocument();

    await user.click(caseDe(/Suite126/));
    // Une seule carte pour l'élément — celle de « Sélectionnés », cochée —, et un résultat de moins.
    expect(screen.getAllByRole("checkbox", { name: /Suite126/ })).toHaveLength(1);
    expect(caseDe(/Suite126/)).toBeChecked();
    expect(screen.getByText("coform.finder.modal.selectedHeading_one")).toBeInTheDocument();
    expect(screen.getByText(resultats(1))).toBeInTheDocument();
    expect(caseDe(/Coopaname/)).not.toBeChecked();

    await user.click(caseDe(/Suite126/));
    expect(screen.getAllByRole("checkbox", { name: /Suite126/ })).toHaveLength(1);
    expect(caseDe(/Suite126/)).not.toBeChecked();
    expect(screen.queryByText("coform.finder.modal.selectedHeading_one")).not.toBeInTheDocument();
    expect(screen.getByText(resultats(2))).toBeInTheDocument();
  });

  it("choix unique : l'élément remplacé retourne dans les résultats", async () => {
    etat.resultats = [EXISTANTE, AUTRE];
    const { onValidate, user } = monter(finder({ multiple: false }));
    await user.type(screen.getByRole("textbox"), "coop");

    await user.click(caseDe(/Suite126/));
    await user.click(caseDe(/Coopaname/));
    expect(caseDe(/Coopaname/)).toBeChecked();
    expect(caseDe(/Suite126/)).not.toBeChecked();
    expect(screen.getByText(resultats(1))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "coform.finder.modal.validate" }));
    expect(onValidate).toHaveBeenCalledWith([expect.objectContaining({ id: AUTRE.id })]);
  });

  it("sélectionner le dernier résultat : « déjà sélectionnés », et l'offre d'ajout garde sa forme", async () => {
    // Elle devenait « n'existe pas encore ? » à bouton plein, sous l'élément qu'on venait de trouver.
    etat.resultats = [EXISTANTE];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "Suite");
    expect(screen.getByText(/coform\.finder\.modal\.addNewNotListed/)).toBeInTheDocument();

    await user.click(caseDe(/Suite126/));
    const message = screen.getByText(/coform\.finder\.modal\.allAlreadySelected/);
    const encart = screen.getByText(/coform\.finder\.modal\.addNewNotListed/);
    // Le message d'abord, l'encart ensuite.
    expect(message.compareDocumentPosition(encart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/coform\.finder\.modal\.noResults/)).not.toBeInTheDocument();
    expect(screen.queryByText(/coform\.finder\.modal\.resultsHeading/)).not.toBeInTheDocument();
    expect(screen.queryByText(/coform\.finder\.modal\.addNewPrompt/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "coform.finder.modal.addNewButton" })).toHaveLength(1);
  });

  it("une partie déjà dans la question, le reste sélectionné ici : l'offre d'ajout reste discrète", async () => {
    etat.resultats = [EXISTANTE, AUTRE];
    const { user } = monter(finder(), "add-cae", DANS_LA_QUESTION);
    await user.type(screen.getByRole("textbox"), "coop");

    await user.click(caseDe(/Coopaname/));
    expect(screen.getByText(/coform\.finder\.modal\.allAlreadySelected/)).toBeInTheDocument();
    expect(screen.getByText(/coform\.finder\.modal\.addNewNotListed/)).toBeInTheDocument();
    expect(screen.queryByText(/coform\.finder\.modal\.addNewPrompt/)).not.toBeInTheDocument();
  });

  it("tout est déjà dans la question, malgré une sélection faite sous une AUTRE recherche : « n'existe pas encore ? »", async () => {
    // Ce qui compte est la recherche affichée : aucun de SES résultats n'a été sélectionné ici.
    etat.resultats = [AUTRE];
    const { user } = monter(finder(), "add-cae", DANS_LA_QUESTION);
    await user.type(screen.getByRole("textbox"), "coop");
    await user.click(caseDe(/Coopaname/));

    etat.resultats = [EXISTANTE]; // la recherche suivante ne ramène que ce qui est déjà dans la question
    await user.type(screen.getByRole("textbox"), "x");
    expect(screen.getByText(/coform\.finder\.modal\.allAlreadySelected/)).toBeInTheDocument();
    expect(screen.getByText(/coform\.finder\.modal\.addNewPrompt/)).toBeInTheDocument();
    expect(screen.queryByText(/coform\.finder\.modal\.addNewNotListed/)).not.toBeInTheDocument();
  });

  it("liste conservée, entièrement sélectionnée : la place est tenue, rien ne conclut", async () => {
    etat.resultats = [EXISTANTE];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "Suite");
    await user.click(caseDe(/Suite126/));

    etat.courante = false; // la saisie suivante n'a pas encore sa réponse : la liste affichée est l'ancienne
    await user.type(screen.getByRole("textbox"), "1");
    expect(screen.getByRole("status")).toHaveTextContent("coform.finder.modal.searching");
    expect(screen.queryByText(/coform\.finder\.modal\.allAlreadySelected/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "coform.finder.modal.addNewButton" })).not.toBeInTheDocument();
  });

  it("la bascule se dit : ajout, puis retrait, avec le nom", async () => {
    // La carte change de zone et, au clavier, le focus passe à sa voisine : sans annonce, rien ne
    // confirmerait ce qui vient d'être fait.
    etat.resultats = [EXISTANTE, AUTRE];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "coop");

    await user.click(caseDe(/Suite126/));
    expect((await screen.findByText(annonce("selectedAnnouncement", "Suite126"))).parentElement).toHaveAttribute("aria-live", "polite");
    await user.click(caseDe(/Suite126/));
    expect(await screen.findByText(annonce("deselectedAnnouncement", "Suite126"))).toBeInTheDocument();
    // « Recherche en cours… » reste le seul `role="status"` de la modale.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("l'annonce suit le déplacement du focus : elle n'est dite qu'après un délai", async () => {
    // Un lecteur d'écran coupe ce qu'il disait quand le focus change : dite dans le même temps, la
    // confirmation se perdrait au clavier, là où elle sert.
    etat.resultats = [EXISTANTE, AUTRE];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "coop");

    vi.useFakeTimers(); // après la saisie : `user-event` attend de vrais minuteurs
    try {
      caseDe(/Suite126/).focus();
      fireEvent.click(caseDe(/Suite126/)); // `detail` vaut 0, comme un clic né du clavier
      expect(caseDe(/Coopaname/)).toHaveFocus();
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.queryByText(annonce("selectedAnnouncement", "Suite126"))).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.getByText(annonce("selectedAnnouncement", "Suite126"))).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("deux homonymes sélectionnés à la suite : l'annonce est redite", async () => {
    // Même texte deux fois : sans remonter le nœud, la région ne changerait pas et resterait muette.
    etat.resultats = [EXISTANTE, { ...AUTRE, name: "Suite126" }];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "Suite");

    await user.click(screen.getAllByRole("checkbox", { name: /Suite126/ })[0]!);
    const premiere = await screen.findByText(annonce("selectedAnnouncement", "Suite126"));
    await user.click(screen.getAllByRole("checkbox", { name: /Suite126/, checked: false })[0]!);
    await waitFor(() => expect(screen.getByText(annonce("selectedAnnouncement", "Suite126"))).not.toBe(premiere));
  });

  it("choix unique : l'annonce dit la sélection, pas un ajout", async () => {
    etat.resultats = [EXISTANTE, AUTRE];
    const { user } = monter(finder({ multiple: false }));
    await user.type(screen.getByRole("textbox"), "coop");

    await user.click(caseDe(/Suite126/));
    await user.click(caseDe(/Coopaname/));
    expect(await screen.findByText(annonce("selectedSingleAnnouncement", "Coopaname"))).toBeInTheDocument();
  });

  it("au clavier, le focus passe à la carte qui prend la place : on garde sa place dans la liste", async () => {
    // La case qu'on vient de basculer disparaît avec sa carte : sans cela le focus repartait au début
    // de la modale ; et suivre l'élément dans l'autre zone obligeait à retraverser toute la liste.
    etat.resultats = [EXISTANTE, AUTRE, TROISIEME];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "coop");

    caseDe(/Coopaname/).focus(); // la carte du milieu : elle a ses deux voisines
    await user.keyboard(" ");
    expect(caseDe(/Coopaname/)).toBeChecked();
    expect(caseDe(/Oxalis/)).toHaveFocus(); // la suivante, pas la précédente

    await user.keyboard(" ");
    expect(caseDe(/Oxalis/)).toBeChecked();
    expect(caseDe(/Suite126/)).toHaveFocus(); // plus de suivante : la précédente

    // Désélection, dans « Sélectionnés » : même règle, dans cette zone.
    caseDe(/Coopaname/).focus();
    await user.keyboard(" ");
    expect(caseDe(/Coopaname/)).not.toBeChecked();
    expect(caseDe(/Oxalis/)).toHaveFocus();
    expect(caseDe(/Oxalis/)).toBeChecked();
  });

  it("au clavier, sans carte suivante : la précédente ; zone épuisée : le champ, jamais l'autre zone", async () => {
    // Le focus passait dans l'autre zone, où l'Espace suivant faisait l'inverse sur un autre élément :
    // sélectionner le dernier résultat menait sur une carte sélectionnée, que l'Espace d'après retirait.
    etat.resultats = [EXISTANTE, AUTRE];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "coop");

    caseDe(/Coopaname/).focus(); // le dernier résultat
    await user.keyboard(" ");
    expect(caseDe(/Suite126/)).toHaveFocus();

    await user.keyboard(" "); // plus aucun résultat
    expect(screen.getByRole("textbox")).toHaveFocus();
    await user.keyboard(" "); // l'Espace de trop part dans le champ : rien n'est retiré
    expect(caseDe(/Suite126/)).toBeChecked();
    expect(caseDe(/Coopaname/)).toBeChecked();
  });

  it("au clavier, « Sélectionnés » vidée : le champ, pas le premier résultat", async () => {
    etat.resultats = [EXISTANTE, AUTRE, TROISIEME];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "coop");
    await user.click(caseDe(/Suite126/));
    await user.click(caseDe(/Coopaname/));

    caseDe(/Suite126/).focus();
    await user.keyboard(" ");
    expect(caseDe(/Coopaname/)).toHaveFocus(); // l'autre carte sélectionnée
    await user.keyboard(" ");
    expect(screen.getByRole("textbox")).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.queryByRole("checkbox", { checked: true })).not.toBeInTheDocument();
  });

  it("au clavier, la seule carte de la modale : le focus repart au champ", async () => {
    etat.resultats = [EXISTANTE];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "Suite");

    caseDe(/Suite126/).focus();
    await user.keyboard(" ");
    expect(caseDe(/Suite126/)).toBeChecked();
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("choix unique au clavier : le focus repart au champ — un second Espace ne remplace pas le choix", async () => {
    etat.resultats = [EXISTANTE, AUTRE, TROISIEME];
    const { user } = monter(finder({ multiple: false }));
    await user.type(screen.getByRole("textbox"), "coop");

    caseDe(/Suite126/).focus();
    await user.keyboard(" ");
    expect(screen.getByRole("textbox")).toHaveFocus();
    await user.keyboard(" ");
    expect(caseDe(/Suite126/)).toBeChecked();
    expect(caseDe(/Coopaname/)).not.toBeChecked();
  });

  it("un clic sans compte de clics, focus resté dans le champ : le focus n'est pas tiré vers une carte", async () => {
    // Une aide technique peut activer une carte sans y porter le focus : il n'y a alors rien à rendre.
    etat.resultats = [EXISTANTE, AUTRE];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "coop");

    fireEvent.click(caseDe(/Suite126/)); // `detail` vaut 0, comme un clic né du clavier
    expect(caseDe(/Suite126/)).toBeChecked();
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("double-clic : le second clic n'active pas ce qui est venu sous le curseur", async () => {
    // La carte cliquée change de zone, la liste se décale d'un cran : au navigateur, le second clic
    // d'un double-clic tombait sur la VOISINE (mesuré : 8 fois sur 15) — deux éléments sélectionnés pour
    // un, et le mauvais en choix unique. Sans mise en page ici : on rejoue ce second clic sur la voisine.
    etat.resultats = [EXISTANTE, AUTRE];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "coop");

    await user.click(caseDe(/Coopaname/));
    fireEvent.click(caseDe(/Suite126/), { detail: 2 });
    fireEvent.click(caseDe(/Suite126/), { detail: 3 });
    expect(caseDe(/Coopaname/)).toBeChecked();
    expect(caseDe(/Suite126/)).not.toBeChecked();

    // La garde vaut pour TOUTE la zone : ce qui glisse sous le curseur peut être le bouton « Ajouter ».
    const ajouter = screen.getByRole("button", { name: "coform.finder.modal.addNewButton" });
    fireEvent.click(ajouter, { detail: 2 });
    expect(etat.modales).toHaveLength(0);
    await user.click(ajouter);
    expect(etat.modales).toHaveLength(1);
  });

  it("à la souris, le focus n'est déplacé vers aucune carte — même après une bascule au clavier", async () => {
    // Focaliser une carte ferait défiler la liste ; et le drapeau « clavier » ne survit pas au clic suivant.
    // Quatre résultats : la carte cliquée à la fin garde une voisine, vers laquelle le focus pourrait partir.
    etat.resultats = [EXISTANTE, AUTRE, TROISIEME, { id: "687f9ccf3d82cf6bf133d3f3", name: "Smart", type: "organizations" }];
    const { user } = monter(finder());
    await user.type(screen.getByRole("textbox"), "coop");

    await user.click(caseDe(/Coopaname/));
    expect(caseDe(/Coopaname/)).toBeChecked();
    expect(document.activeElement).not.toHaveAttribute("role", "checkbox");

    caseDe(/Suite126/).focus();
    await user.keyboard(" ");
    expect(caseDe(/Oxalis/)).toHaveFocus(); // au clavier, le focus a pris la carte suivante
    await user.click(caseDe(/Oxalis/));
    expect(caseDe(/Oxalis/)).toBeChecked();
    expect(document.activeElement).not.toHaveAttribute("role", "checkbox");
  });
});
