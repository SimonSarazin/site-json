// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useState, type ReactNode, type MouseEvent } from "react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { AacResolvedConfig } from "../../types";
import type { CoFormAnswer } from "@/modules/coform/types";

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
type PostLoginIntent = Parameters<typeof CommunFinancingCard>[0]["postLoginIntent"];

function makeConfig(depenseStepKey: string | null, typeCoFinancer: string | null = null): AacResolvedConfig {
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
  return (
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
 * Depuis que `resolveTypeCoFinancer` rend la valeur RÉELLE du form parent (et non
 * plus `null` systématiquement), le `if/else if` sans `else` de `loadOrganizations`
 * est atteignable : toute valeur inconnue — ou d'une autre casse — laissait
 * `orgParam` vide, `searchCostum({})` levait (le SDK exige `searchType`), l'erreur
 * était avalée et la modale annonçait « aucune organisation ».
 */
describe("CommunFinancingCard — la population cofinanceuse a toujours un repli", () => {
  const TIERS_LIEUX = {
    searchType: ["organizations"],
    filters: {
      $or: {
        "source.keys": "franceTierslieux",
        "reference.costum": "franceTierslieux",
        mainTag: "TiersLieux",
      },
    },
    notSourceKey: true,
  };
  const CAE = {
    searchType: ["organizations"],
    filters: { tags: { $in: ["CAE", "cae", "Cae"] } },
    notSourceKey: true,
  };

  /** « J'utilise » ouvre le modal de sélection, qui charge les organisations. */
  async function ouvrirLaListe(typeCoFinancer: string | null) {
    renderCard({ aacConfig: makeConfig("etapeA", typeCoFinancer) });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detail\.use/ }));
    });
  }

  it("`cae` : la recherche porte sur les organisations taguées CAE", async () => {
    await ouvrirLaListe("cae");
    expect(ENTITY.searchCostum).toHaveBeenCalledWith(CAE);
  });

  it("`CAE` : la casse du form parent n'est pas un contrat — même recherche", async () => {
    await ouvrirLaListe("CAE");
    expect(ENTITY.searchCostum).toHaveBeenCalledWith(CAE);
  });

  it("non déclaré (`null`) : repli tiers-lieux, le défaut legacy", async () => {
    await ouvrirLaListe(null);
    expect(ENTITY.searchCostum).toHaveBeenCalledWith(TIERS_LIEUX);
  });

  it("valeur inconnue : repli tiers-lieux — JAMAIS une requête sans `searchType`", async () => {
    await ouvrirLaListe("scic");
    expect(ENTITY.searchCostum).toHaveBeenCalledTimes(1);
    expect(ENTITY.searchCostum).toHaveBeenCalledWith(TIERS_LIEUX);
    // Le défaut d'origine : `{}` — et la modale vide qui s'ensuivait.
    expect(ENTITY.searchCostum).not.toHaveBeenCalledWith({});
  });
});
