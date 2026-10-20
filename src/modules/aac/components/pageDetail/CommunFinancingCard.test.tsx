// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode, type MouseEvent } from "react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { AacResolvedConfig } from "../../types";
import type { CoFormAnswer } from "@/modules/coform/types";
import type { SharedFinderInfo } from "@/modules/coform/utils/formParser";

/**
 * La carte de financement de la fiche d'un commun (review MR 53, lot 2).
 *
 * Ce qui est sous test, c'est le CÂBLAGE de la carte — l'étape qu'elle lit, ce
 * qu'elle fait d'un visiteur non connecté, ce qu'elle compte — pas les hooks
 * data (cagnotte, React Query), mockés à leur frontière.
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string, params?: Record<string, unknown>) => {
    const base = fallback ?? key;
    if (!params) return base;
    return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)), base);
  },
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const CONNECTED = { id: "u1", isConnected: true, serverData: { id: "u1", name: "Alice" } };
const ANONYMOUS = { id: "", isConnected: false, serverData: undefined };
let me: typeof CONNECTED | typeof ANONYMOUS = CONNECTED;
const ENTITY = { id: "host", searchCostum: vi.fn().mockResolvedValue({ results: {} }) };
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ me, entity: ENTITY }),
}));

const toggleReaction = vi.fn().mockResolvedValue(true);
vi.mock("@/modules/aac/hooks/useCommunReactions", async (importActual) => {
  const actual = await importActual<typeof import("@/modules/aac/hooks/useCommunReactions")>();
  return { ...actual, useCommunReactions: () => ({ toggleReaction }) };
});

let depenses: Array<Record<string, unknown>> = [];
const useCommunRawDepenses = vi.fn(() => ({ data: depenses }));
vi.mock("@/modules/aac/hooks/useCommunRawDepenses", () => ({
  useCommunRawDepenses: (...args: unknown[]) => useCommunRawDepenses(...(args as [])),
}));
vi.mock("@/modules/aac/hooks/useCommunFundingContext", () => ({
  useCommunFundingContext: () => ({ context: null }),
}));
vi.mock("@/modules/aac/hooks/useCommunFundingHost", () => ({
  useCommunFundingHost: () => ({ hostEntity: null }),
}));
vi.mock("@/modules/aac/hooks/useReactorNames", () => ({
  useReactorNames: () => ({ names: [], isLoading: false }),
}));

const openLogin = vi.fn();
vi.mock("@/modules/auth", () => ({ useAuthModal: () => ({ openLogin }) }));

let usageFormId: string | null = null;
// Le hook du périmètre est mocké à sa frontière (`useSite`), mais résout avec la
// VRAIE fonction : les attentes portent sur `placeKind` / `placeSourceKeys` de la config.
let placeKind: "tiersLieu" | "cae" | undefined = undefined;
let placeSourceKeysOverride: string[] | undefined = undefined;
vi.mock("@/modules/aac/hooks/useAacDetailSections", async (importOriginal) => {
  const { placeKindSourceKeys } = await import("@/modules/coform/utils/finderFilters");
  const { placeKindFromTypeCoFinancer } = await importOriginal<typeof import("@/modules/aac/hooks/useAacDetailSections")>();
  return {
    useAacUsageFormId: () => usageFormId,
    useAacPlaceSourceKeys: (typeCoFinancer?: string | null) =>
      placeKindSourceKeys(placeKind ?? placeKindFromTypeCoFinancer(typeCoFinancer), placeSourceKeysOverride),
  };
});
let usageForm: unknown = null;
let usageFormError: Error | null = null;
const useCoFormQuery = vi.fn((opts: { formId: string; enabled?: boolean }) => ({
  formData: opts.enabled ? usageForm : null,
  error: opts.enabled ? usageFormError : null,
}));
vi.mock("@/modules/coform/hooks/useCoFormQuery", () => ({
  useCoFormQuery: (opts: { formId: string; enabled?: boolean }) => useCoFormQuery(opts),
}));
let sharedFinder: SharedFinderInfo | null = null;
vi.mock("@/modules/coform/utils/formParser", async (importActual) => ({
  ...(await importActual<typeof import("@/modules/coform/utils/formParser")>()),
  getSharedFinderInfo: () => sharedFinder,
}));

/**
 * `CagnotteDialog` réel enveloppe son enfant dans un `DialogTrigger asChild`
 * (Radix) : le handler du trigger est composé avec celui de l'enfant et NE JOUE
 * PAS si l'enfant a fait `preventDefault()`. Le stub reproduit exactement cette
 * règle — c'est elle qui rend le test discriminant.
 */
function CagnotteDialogStub({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      data-testid="cagnotte-dialog"
      onClick={(e: MouseEvent) => {
        if (!e.defaultPrevented) setOpen(true);
      }}
    >
      {children}
      {open ? <div data-testid="cagnotte-open" /> : null}
    </div>
  );
}

vi.mock("@/modules/cagnotte/components/CagnotteDialog", () => ({
  default: CagnotteDialogStub,
}));

const { CommunFinancingCard } = await import("./CommunFinancingCard");
const { CommunReactionStats } = await import("./CommunReactionStats");
const { CommunSectionNavContext } = await import("@/modules/aac/hooks/useCommunSectionNav");
type PostLoginIntent = Parameters<typeof CommunFinancingCard>[0]["postLoginIntent"];

function makeConfig(depenseStepKey: string | null, typeCoFinancer: string | null = null): AacResolvedConfig {
  return {
    formId: "f1",
    configId: null,
    aapType: "aac",
    steps: [],
    roles: { depenseStepKey, evalStepKey: null, evalStepKeyFound: null, financementStepKey: null, suiviStepKey: null },
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
    typeCoFinancer,
  };
}

const ANSWER = {
  _id: { $id: "a1" },
  answers: {},
  links: { contributors: { u9: { type: "citoyens" } } },
  vote: {},
} as unknown as CoFormAnswer;

/**
 * La PAGE, réduite à ce qui compte ici : elle porte l'intention post-connexion
 * (la carte est démontée pendant le rechargement post-login, cf. le test M14/M15
 * du démontage) et monte — ou non — la carte selon l'état de ses requêtes.
 */
function PageHarness({
  carteMontee = true,
  ...over
}: Partial<Parameters<typeof CommunFinancingCard>[0]> & { carteMontee?: boolean }) {
  const [intent, setIntent] = useState<PostLoginIntent>(null);
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <QueryClientProvider client={queryClient}>
    <LocalizationProvider>
      {carteMontee ? (
        <CommunFinancingCard
          formData={{ id: "f1", name: "Appel", inputs: {} } as never}
          answerQuery={ANSWER}
          aacConfig={makeConfig("etapeA")}
          funding={null}
          postLoginIntent={intent}
          onPostLoginIntent={setIntent}
          {...over}
        />
      ) : null}
    </LocalizationProvider>
    </QueryClientProvider>
  );
}

function renderCard(over: Partial<Parameters<typeof CommunFinancingCard>[0]> = {}) {
  return render(<PageHarness {...over} />);
}

beforeEach(() => {
  me = CONNECTED;
  depenses = [];
  ENTITY.searchCostum.mockClear();
  useCommunRawDepenses.mockClear();
  toggleReaction.mockClear();
  openLogin.mockClear();
  usageFormId = null;
  placeKind = undefined;
  placeSourceKeysOverride = undefined;
  usageForm = null;
  usageFormError = null;
  sharedFinder = null;
  useCoFormQuery.mockClear();
});

describe("CommunFinancingCard — l'étape des dépenses est celle que la page a résolue (M13)", () => {
  it("passe `roles.depenseStepKey` à `useCommunRawDepenses`, jamais `aapStep1` en dur", () => {
    renderCard({ aacConfig: makeConfig("etapeA") });
    expect(useCommunRawDepenses).toHaveBeenCalledWith("a1", "etapeA");
  });

  it("sans étape résolue, laisse le hook à son défaut (argument absent)", () => {
    renderCard({ aacConfig: makeConfig(null) });
    expect(useCommunRawDepenses).toHaveBeenCalledWith("a1", undefined);
  });
});

/**
 * Un élément NEUF à chaque rendu : rerendre le même objet React laisse React
 * court-circuiter tout l'arbre (props identiques), et le nouveau `me` du mock
 * ne serait jamais lu. Le harness, lui, garde sa place dans l'arbre — donc son
 * état, exactement comme la page.
 */
const makeUi = (carteMontee = true) => <PageHarness carteMontee={carteMontee} />;

/** Simule une connexion réussie : le callback `onSuccess` du modal, puis l'arrivée de `me`. */
async function connecter(rerender: (ui: React.ReactElement) => void) {
  const opts = openLogin.mock.calls[0]?.[0] as { onSuccess?: () => void } | undefined;
  await act(async () => {
    opts?.onSuccess?.();
  });
  me = CONNECTED;
  await act(async () => {
    rerender(makeUi());
  });
}

describe("CommunFinancingCard — « Financer ce commun » hors connexion ouvre la connexion (M14)", () => {
  /**
   * Avant : `disabled={… || !me?.isConnected}` — un bouton grisé, sans message
   * ni chemin vers la connexion (CLAUDE.md, gotcha n° 11).
   */
  it("le bouton reste actif ; le clic ouvre le modal de connexion, PAS la cagnotte", () => {
    me = ANONYMOUS;
    depenses = [{ poste: "Serveur", priceInt: 1000 }];
    renderCard();

    const bouton = screen.getByRole("button", { name: /detail\.financing\.cta/ });
    expect(bouton).not.toBeDisabled();

    fireEvent.click(bouton);
    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("cagnotte-open")).toBeNull();
  });

  it("une fois connecté, la cagnotte s'ouvre d'elle-même", async () => {
    me = ANONYMOUS;
    depenses = [{ poste: "Serveur", priceInt: 1000 }];
    const { rerender } = render(makeUi());
    fireEvent.click(screen.getByRole("button", { name: /detail\.financing\.cta/ }));
    expect(screen.queryByTestId("cagnotte-open")).toBeNull();

    await connecter(rerender);
    expect(screen.getByTestId("cagnotte-open")).toBeTruthy();
  });

  it("connecté, le clic ouvre directement la cagnotte", () => {
    me = CONNECTED;
    depenses = [{ poste: "Serveur", priceInt: 1000 }];
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /detail\.financing\.cta/ }));
    expect(openLogin).not.toHaveBeenCalled();
    expect(screen.getByTestId("cagnotte-open")).toBeTruthy();
  });
});

describe("CommunFinancingCard — le compteur de cofinanceurs compte ce que la table liste (M16)", () => {
  /**
   * Avant : `new Set(allFunding.map(c => c.financerId)).size` — toutes les lignes
   * sans id ne comptaient que pour UNE entrée (`undefined`), quand la table les
   * écartait toutes. Désormais les deux lisent `aggregateCofinancers` : une
   * ligne par id, sinon par nom.
   */
  it("trois lignes (un id, deux noms sans id) ⇒ 3 cofinanceurs", () => {
    depenses = [
      {
        poste: "Serveur",
        priceInt: 1000,
        financer: [
          { id: "org1", name: "CAE Sud", amount: 500 },
          { name: "Anonyme A", amount: 100 },
          { name: "Anonyme B", amount: 50 },
        ],
      },
    ];
    renderCard();

    const boite = screen.getByText("detail.financing.cofinancers").closest("div");
    expect(boite?.querySelector("div")?.textContent).toBe("3");
  });
});

describe("CommunFinancingCard — mise en page `hero` (interface editorial)", () => {
  const DEPENSES_3_COFINANCEURS = [
    {
      poste: "Serveur",
      priceInt: 1000,
      financer: [
        { id: "org1", name: "CAE Sud", amount: 500 },
        { name: "Anonyme A", amount: 100 },
        { name: "Anonyme B", amount: 50 },
      ],
    },
  ];

  it("« Financement réuni » et son résumé remplacent la carte « Financement participatif »", () => {
    depenses = DEPENSES_3_COFINANCEURS;
    renderCard({ layout: "hero" });

    expect(screen.getByText("detail.financing.raised")).toBeTruthy();
    expect(screen.getByText("detail.financing.cofinancersCount_other")).toBeTruthy();
    expect(screen.getByText(/detail\.financing\.remainingToFund/)).toBeTruthy();
    expect(screen.queryByText("detail.financing.title")).toBeNull();
  });

  it("un seul cofinanceur : le résumé passe au singulier", () => {
    depenses = [{ poste: "Serveur", priceInt: 1000, financer: [{ id: "org1", name: "CAE Sud", amount: 500 }] }];
    renderCard({ layout: "hero" });

    expect(screen.getByText("detail.financing.cofinancersCount_one")).toBeTruthy();
  });

  it("pas de réactions dans la carte (la vue les place) ; l'emplacement vient AVANT « Soutenir »", () => {
    depenses = [{ poste: "Serveur", priceInt: 1000 }];
    renderCard({ layout: "hero", secondaryAction: <button type="button">Exporter</button> });

    for (const cta of [/detail\.contribute/, /detail\.vote/, /detail\.use/]) {
      expect(screen.queryByRole("button", { name: cta })).toBeNull();
    }
    const exporter = screen.getByRole("button", { name: "Exporter" });
    const soutenir = screen.getByRole("button", { name: /detail\.financing\.support/ });
    expect(exporter.compareDocumentPosition(soutenir) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("hors connexion, « Soutenir ce projet » ouvre la connexion, PAS la cagnotte (M14)", () => {
    me = ANONYMOUS;
    depenses = [{ poste: "Serveur", priceInt: 1000 }];
    renderCard({ layout: "hero" });

    fireEvent.click(screen.getByRole("button", { name: /detail\.financing\.support/ }));
    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("cagnotte-open")).toBeNull();
  });

  it("connecté, « Soutenir ce projet » ouvre la cagnotte", () => {
    depenses = [{ poste: "Serveur", priceInt: 1000 }];
    renderCard({ layout: "hero" });

    fireEvent.click(screen.getByRole("button", { name: /detail\.financing\.support/ }));
    expect(screen.getByTestId("cagnotte-open")).toBeTruthy();
  });
});

/** L'interface editorial, réduite à ce qui compte ici : réactions à part et carte `hero`, une seule intention de page. */
function EditorialHarness() {
  const [intent, setIntent] = useState<PostLoginIntent>(null);
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const shared = {
    answerQuery: ANSWER,
    aacConfig: makeConfig("etapeA"),
    postLoginIntent: intent,
    onPostLoginIntent: setIntent,
  };
  return (
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider>
        <CommunReactionStats {...shared} compact />
        <CommunFinancingCard formData={{ id: "f1", name: "Appel", inputs: {} } as never} funding={null} layout="hero" {...shared} />
      </LocalizationProvider>
    </QueryClientProvider>
  );
}

describe("Interface editorial — réactions à part et carte `hero` rejouent chacune SA demande", () => {
  async function connecterEditorial(rerender: (ui: React.ReactElement) => void) {
    const opts = openLogin.mock.calls[0]?.[0] as { onSuccess?: () => void } | undefined;
    await act(async () => {
      opts?.onSuccess?.();
    });
    me = CONNECTED;
    await act(async () => {
      rerender(<EditorialHarness />);
    });
  }

  it("« Je contribue » hors connexion : la réaction part une fois connecté, la cagnotte reste fermée", async () => {
    me = ANONYMOUS;
    depenses = [{ poste: "Serveur", priceInt: 1000 }];
    const { rerender } = render(<EditorialHarness />);

    fireEvent.click(screen.getByRole("button", { name: /detail\.contribute/ }));
    await connecterEditorial(rerender);

    expect(toggleReaction).toHaveBeenCalledTimes(1);
    expect(toggleReaction).toHaveBeenCalledWith("a1", "utilise", "u1", "Alice");
    expect(screen.queryByTestId("cagnotte-open")).toBeNull();
  });

  it("« Soutenir » hors connexion : la cagnotte s'ouvre une fois connecté, aucune réaction", async () => {
    me = ANONYMOUS;
    depenses = [{ poste: "Serveur", priceInt: 1000 }];
    const { rerender } = render(<EditorialHarness />);

    fireEvent.click(screen.getByRole("button", { name: /detail\.financing\.support/ }));
    await connecterEditorial(rerender);

    expect(screen.getByTestId("cagnotte-open")).toBeTruthy();
    expect(toggleReaction).not.toHaveBeenCalled();
  });
});

describe("CommunFinancingCard — les liens mènent à leur section, selon l'interface", () => {
  /** Les éléments sur lesquels `scrollIntoView` a été appelé. */
  const scrolled: Element[] = [];
  beforeEach(() => {
    scrolled.length = 0;
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    });
    depenses = [{ poste: "Serveur", priceInt: 1000, financer: [{ id: "org1", name: "CAE Sud", amount: 500 }] }];
  });

  /** La carte dans une interface qui fournit SA navigation (onglets…) : on note ce qu'elle demande. */
  function renderInInterface(layout: "full" | "hero") {
    const showSection = vi.fn();
    render(
      <CommunSectionNavContext.Provider value={showSection}>
        <PageHarness layout={layout} />
      </CommunSectionNavContext.Provider>,
    );
    return showSection;
  }

  it("`hero` : montant et « N cofinanceurs » demandent leur section", () => {
    const showSection = renderInInterface("hero");

    fireEvent.click(screen.getByText("detail.financing.raised"));
    expect(showSection).toHaveBeenLastCalledWith("besoins-financiers");

    fireEvent.click(screen.getByRole("button", { name: "detail.financing.cofinancersCount_one" }));
    expect(showSection).toHaveBeenLastCalledWith("cofinanceurs");
  });

  it("réactions rendues à part : la valeur « Contributeurs » demande les cofinanceurs", () => {
    const showSection = vi.fn();
    render(
      <CommunSectionNavContext.Provider value={showSection}>
        <EditorialHarness />
      </CommunSectionNavContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /detail\.contributors/ }));
    expect(showSection).toHaveBeenLastCalledWith("cofinanceurs");
  });

  it("`full` dans une interface qui fournit sa navigation : les mêmes demandes passent par elle", () => {
    const showSection = renderInInterface("full");

    fireEvent.click(screen.getByText("detail.financing.cofinancers"));
    expect(showSection).toHaveBeenLastCalledWith("cofinanceurs");
    expect(scrolled).toEqual([]);
  });

  it("fiche verticale (aucun fournisseur) : défilement direct vers l'ancre", () => {
    render(
      <>
        <section id="besoins-financiers" />
        <section id="cofinanceurs" />
        <PageHarness />
      </>,
    );

    fireEvent.click(screen.getByText("detail.financing.cofinancers"));
    fireEvent.keyDown(screen.getByText("detail.financing.collected"), { key: "Enter" });

    expect(scrolled.map((el) => el.id)).toEqual(["cofinanceurs", "besoins-financiers"]);
  });
});

describe("CommunFinancingCard — les CTA de réaction hors connexion ouvrent la connexion (M15)", () => {
  /**
   * Avant : le clic appliquait l'optimisme (+1), appelait `toggleReaction` sans
   * réacteur → toast d'erreur, puis −1. L'action ne pouvait jamais aboutir.
   */
  it("« Je contribue » n'appelle pas `toggleReaction`, ne touche pas au compteur, ouvre la connexion", () => {
    me = ANONYMOUS;
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /detail\.contribute/ }));

    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(toggleReaction).not.toHaveBeenCalled();
    // Un contributeur dans `links.contributors` : le compteur reste à 1.
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("une fois connecté, la réaction demandée est rejouée avec le réacteur de la session", async () => {
    me = ANONYMOUS;
    const { rerender } = render(makeUi());
    fireEvent.click(screen.getByRole("button", { name: /detail\.vote/ }));
    expect(toggleReaction).not.toHaveBeenCalled();

    await connecter(rerender);
    expect(toggleReaction).toHaveBeenCalledWith("a1", "love", "u1", "Alice");
  });

  /**
   * Le scénario RÉEL, celui qui ne marchait pas : la connexion change `me.id`,
   * donc les clés des trois requêtes user-scopées de la fiche ; elles repassent
   * en chargement, la page rend son squelette et la carte est DÉMONTÉE au rendu
   * même où la session arrive. Tant que l'intention vivait dans un `useState` de
   * la carte, elle partait avec elle et l'action n'était jamais rejouée.
   */
  it("la carte démontée pendant le rechargement post-login : l'action part quand même, une fois et une seule", async () => {
    me = ANONYMOUS;
    const { rerender } = render(makeUi());

    // Déconnecté : « Ça m'intéresse » ouvre la connexion, rien d'autre.
    fireEvent.click(screen.getByRole("button", { name: /detail\.vote/ }));
    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(toggleReaction).not.toHaveBeenCalled();

    // La session arrive : le `onSuccess` du modal (qui survit au démontage) pose
    // l'intention, puis la fiche recharge ses requêtes → plus de carte.
    const opts = openLogin.mock.calls[0]?.[0] as { onSuccess?: () => void } | undefined;
    await act(async () => {
      opts?.onSuccess?.();
    });
    me = CONNECTED;
    await act(async () => {
      rerender(makeUi(false));
    });
    expect(toggleReaction).not.toHaveBeenCalled();

    // La fiche revient avec les données du connecté : l'action part enfin.
    await act(async () => {
      rerender(makeUi(true));
    });
    expect(toggleReaction).toHaveBeenCalledTimes(1);
    expect(toggleReaction).toHaveBeenCalledWith("a1", "love", "u1", "Alice");

    // …et une seule fois : un rendu de plus ne la rejoue pas (intention consommée).
    await act(async () => {
      rerender(makeUi(true));
    });
    expect(toggleReaction).toHaveBeenCalledTimes(1);
  });
});

/**
 * « J'utilise » propose les organisations du périmètre de la plateforme :
 * `config.aac.detail.placeKind`, à défaut le `typeCoFinancer` du form.
 */
describe("CommunFinancingCard — le périmètre de « J'utilise » suit `placeKind`", () => {
  async function ouvrirLaListe() {
    renderCard();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detail\.use/ }));
    });
  }

  it("non déclaré : mes tiers-lieux (source franceTierslieux)", async () => {
    await ouvrirLaListe();
    expect(ENTITY.searchCostum).toHaveBeenCalledTimes(1);
    expect(ENTITY.searchCostum).toHaveBeenCalledWith({
      searchType: ["organizations"],
      sourceKey: ["franceTierslieux"],
    });
  });

  it("`cae` : mes CAE (source federationDesCae)", async () => {
    placeKind = "cae";
    await ouvrirLaListe();
    expect(ENTITY.searchCostum).toHaveBeenCalledWith({
      searchType: ["organizations"],
      sourceKey: ["federationDesCae"],
    });
  });

  it("`placeSourceKeys` en config : l'emporte sur le préréglage de `placeKind`", async () => {
    placeKind = "cae";
    placeSourceKeysOverride = ["federationDesCae", "autreReseauCae"];
    await ouvrirLaListe();
    expect(ENTITY.searchCostum).toHaveBeenCalledWith({
      searchType: ["organizations"],
      sourceKey: ["federationDesCae", "autreReseauCae"],
    });
  });

  it("sans `placeKind`, le `typeCoFinancer` du form décide", async () => {
    renderCard({ aacConfig: makeConfig("etapeA", "cae") });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detail\.use/ }));
    });
    expect(ENTITY.searchCostum).toHaveBeenCalledWith({
      searchType: ["organizations"],
      sourceKey: ["federationDesCae"],
    });
  });

  it("`placeKind` l'emporte sur le `typeCoFinancer` du form", async () => {
    placeKind = "tiersLieu";
    renderCard({ aacConfig: makeConfig("etapeA", "cae") });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detail\.use/ }));
    });
    expect(ENTITY.searchCostum).toHaveBeenCalledWith({
      searchType: ["organizations"],
      sourceKey: ["franceTierslieux"],
    });
  });
});

/**
 * Avec un form d'usage déclaré, « J'utilise » applique AUSSI les filtres de son
 * finder partagé (tags, exclusions) — comme la recherche « rejoindre un lieu » de
 * `PlacesListView` (`searchConfig`) —, toujours dans le périmètre `placeKind`.
 */
describe("CommunFinancingCard — « J'utilise » suit le finder du form d'usage", () => {
  const FINDER: SharedFinderInfo = {
    subFormId: "etape",
    fieldName: "finderLieu",
    fullPath: "etape.finderLieu",
    type: "organizations",
    filters: [{ attributeName: "tags", valueName: "CAE" }],
    excludeFilters: [{ attributeName: "tags", valueName: "Réseau" }],
    notSourceKey: true,
  };
  const FILTRES_FINDER = { $or: { tags: { $in: ["CAE"] } }, tags: { $nin: ["Réseau"] } };

  function ouvrir() {
    return renderCard();
  }

  async function cliquerJUtilise() {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detail\.use/ }));
    });
  }

  it("le form d'usage n'est demandé qu'à l'ouverture de la modale", async () => {
    usageFormId = "usage1";
    ouvrir();
    expect(useCoFormQuery).toHaveBeenLastCalledWith({ formId: "usage1", enabled: false });
    await cliquerJUtilise();
    expect(useCoFormQuery).toHaveBeenLastCalledWith({ formId: "usage1", enabled: true });
  });

  it("finder partagé + `cae` ⇒ filtres du finder ($or + $nin) dans le périmètre CAE, sans notSourceKey", async () => {
    usageFormId = "usage1";
    usageForm = { id: "usage1" };
    sharedFinder = FINDER;
    placeKind = "cae";
    ouvrir();
    await cliquerJUtilise();
    expect(ENTITY.searchCostum).toHaveBeenCalledTimes(1);
    // `notSourceKey: true` du finder NE doit PAS partir : sa présence désarmerait le périmètre.
    expect(ENTITY.searchCostum).toHaveBeenCalledWith({
      searchType: ["organizations"],
      filters: FILTRES_FINDER,
      sourceKey: ["federationDesCae"],
    });
  });

  it("form encore en vol ⇒ aucune recherche sans ses filtres, puis celle du finder à son arrivée", async () => {
    usageFormId = "usage1";
    const { rerender } = ouvrir();
    await cliquerJUtilise();
    expect(ENTITY.searchCostum).not.toHaveBeenCalled();

    usageForm = { id: "usage1" };
    sharedFinder = FINDER;
    await act(async () => {
      rerender(<PageHarness />);
    });
    expect(ENTITY.searchCostum).toHaveBeenCalledTimes(1);
    expect(ENTITY.searchCostum).toHaveBeenCalledWith({
      searchType: ["organizations"],
      filters: FILTRES_FINDER,
      sourceKey: ["franceTierslieux"],
    });
  });

  it("form sans finder partagé ⇒ périmètre seul, avec un avertissement", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    usageFormId = "usage1";
    usageForm = { id: "usage1" };
    sharedFinder = null;
    placeKind = "cae";
    ouvrir();
    await cliquerJUtilise();
    expect(ENTITY.searchCostum).toHaveBeenCalledWith({
      searchType: ["organizations"],
      sourceKey: ["federationDesCae"],
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("form en erreur ⇒ périmètre seul plutôt qu'une modale bloquée", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    usageFormId = "usage1";
    usageFormError = new Error("boom");
    ouvrir();
    await cliquerJUtilise();
    expect(ENTITY.searchCostum).toHaveBeenCalledTimes(1);
    expect(ENTITY.searchCostum).toHaveBeenCalledWith({
      searchType: ["organizations"],
      sourceKey: ["franceTierslieux"],
    });
    warn.mockRestore();
  });
});
