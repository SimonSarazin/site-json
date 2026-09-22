// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import type { AacResolvedConfig } from "../types";
import type { AacDetailSection } from "../lib/resolveAacDetailSections";

/**
 * La fiche d'un commun ne monte ses trois blocs financement — la carte, « Besoins
 * financiers », « Cofinanceurs » — que si l'appel porte une ÉTAPE de financement
 * (`roles.financementStepKey`, l'étape de l'input `financer`) : parité
 * `detailProposal.php:100-104`, l'onglet `#proposition-funding`. Ce n'est pas
 * `coremu`, qui ne garde que l'onglet Contributions (l.105-108) — le brancher là
 * (09/09) avait éteint le financement de la Fédération des CAE, dont le form ne
 * porte pas la clé.
 *
 * Le hook de permissions et son calculateur sont RÉELS : c'est le câblage
 * page → `config` → calculateur → rendu qui est sous test, pas un stub.
 *
 * Second lot : la page ATTEND cette config (deux appels séquentiels, elle
 * arrive après `formQuery`) et refuse de se rendre sans elle — sinon un appel
 * financé se peignait d'abord sans financement, puis basculait en grille.
 */

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("../i18n", () => ({}));
vi.mock("@/components/layout/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/layout/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("@/lib/constant/common", () => ({ getBaseUrl: () => "http://backend.test" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("react-router", () => ({
  useParams: () => ({ answerId: "a1" }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

const CONNECTED = { id: "u1", isConnected: true };
const ANONYMOUS = { id: "", isConnected: false };
let me: { id: string; isConnected: boolean } = CONNECTED;
const ENTITY = { id: "host", isAdmin: () => false };
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ api: {}, loading: false, entity: ENTITY, me, refreshMe: vi.fn() }),
}));

/**
 * Base mutable : les tests de lignée de brouillon jouent sur `created`/`updated`.
 * `name`, `descriptionStr` et `image` sont les champs PRÉ-CALCULÉS par le backend
 * sur le document réponse : les seuls que le SEO puisse lire tant que la config de
 * l'appel n'est pas là — c'est-à-dire au rendu SSR.
 */
type TestAnswer = {
  _id: { $id: string };
  form: string;
  user: string;
  answers: Record<string, unknown>;
  documents: unknown[];
  created?: number;
  updated?: number;
  name: string;
  descriptionStr: string;
  image: string;
};
const BASE_ANSWER: TestAnswer = { _id: { $id: "a1" }, form: "f1", user: "u1", answers: {}, documents: [], name: "", descriptionStr: "", image: "" };
let ANSWER: TestAnswer = { ...BASE_ANSWER };
const FORM = { id: "f1", name: "Appel test", inputs: {} };
const refetchAnswer = vi.fn().mockResolvedValue(undefined);
const invalidateQueries = vi.fn().mockResolvedValue(undefined);
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: queryKey[0] === "aac-commun-detail" ? ANSWER : FORM,
    isLoading: false,
    isSuccess: true,
    error: null,
    refetch: queryKey[0] === "aac-commun-detail" ? refetchAnswer : vi.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries }),
}));

/** Un objet STABLE par test : `permData` est mémoïsé sur `gates` et `roles.financementStepKey`. */
function makeConfig(hasFundingStep: boolean): AacResolvedConfig {
  return {
    formId: "f1",
    configId: null,
    aapType: "aac",
    steps: [],
    roles: {
      depenseStepKey: "aapStep1",
      evalStepKey: null,
      financementStepKey: hasFundingStep ? "aapStep3" : null,
      suiviStepKey: null,
    },
    criteria: [],
    criteriaSource: "none",
    gates: {
      active: true,
      onlyMemberAccess: false,
      oneAnswerPerPers: false,
      canReadOtherAnswers: false,
      showAnswers: false,
      coremu: false,
      anyOnewithLinkCanAnswer: false,
    },
    campaigns: [],
    typeCoFinancer: null,
  };
}
let config: AacResolvedConfig | null = makeConfig(false);
let isConfigLoading = false;
let configError: Error | null = null;
vi.mock("../hooks/useAacConfig", () => ({
  useAacConfig: () => ({ config, isLoading: isConfigLoading, error: configError }),
}));

vi.mock("../hooks/useAacDirectoryContext", () => ({
  useAacDirectoryContext: () => ({
    formId: "f1",
    config: null,
    form: null,
    fields: {},
    resolved: null,
    contextId: "ctx",
    context: null,
    formParams: null,
    visibility: { isAdmin: false, currentUserId: "u1", contextId: "ctx" },
    baseUrl: "",
    isFormLoading: false,
  }),
}));
vi.mock("../hooks/useCommunFundingContext", () => ({
  useCommunFundingContext: () => ({ context: null, originFormName: undefined }),
}));
vi.mock("../hooks/useCommunFundingHost", () => ({
  useCommunFundingHost: () => ({ hostEntity: null, isLoading: false }),
}));
vi.mock("../hooks/useAacFundingResource", () => ({
  useAacFundingResource: () => ({ targetResource: null, projectSlug: null }),
}));
vi.mock("../hooks/useCommunObjectivesController", () => ({
  useCommunObjectivesController: () => ({}),
}));
/** Un bloc déclaré, tel que `useAacDetailSections` le résout depuis `config.aac.detail.sections`. */
const CONTEXTE_SECTION: AacDetailSection = {
  id: "contexte",
  title: "Contexte",
  field: { stepKey: "aapStep1", id: "contexte", path: "answers.aapStep1.contexte", label: "Contexte", options: [] },
};
let detailSections: AacDetailSection[] = [];
vi.mock("../hooks/useAacDetailSections", () => ({
  useAacDetailSections: () => detailSections,
  useAacGallerySubKey: () => null,
}));
// La modale d'édition expose la LIGNÉE de péremption qu'elle reçoit : c'est
// elle que `SmartCoForm` exige pour activer le brouillon, et qu'il grave dans
// l'entrée localStorage (cf. `useCoFormDraft.computeDraftState`).
vi.mock("@/modules/coform/components/CoFormModal", () => ({
  CoFormModal: (props: { baseUpdatedAt?: number | null }) => (
    <div data-testid="edit-modal" data-base-updated-at={String(props.baseUpdatedAt ?? "null")} />
  ),
}));

// Les blocs eux-mêmes ont leurs propres dépendances (cagnotte, React Query) hors
// du périmètre de CE test : on ne vérifie que leur PRÉSENCE dans l'arbre.
vi.mock("../components/pageDetail/CommunSelectionControl.tsx", () => ({ CommunSelectionControl: () => null }));
vi.mock("../components/pageDetail/CommunProjectControl.tsx", () => ({ CommunProjectControl: () => null }));
vi.mock("../components/pageDetail/CommunHero.tsx", () => ({ CommunHero: () => <div data-testid="hero" /> }));
// La carte expose son crochet `onFunded` — ce que `CagnotteDialog` joue après
// une contribution enregistrée (`onRefresh`) — et l'intention post-connexion,
// qu'elle POSE mais que la page DÉTIENT (la carte est démontée entre-temps).
vi.mock("../components/pageDetail/CommunFinancingCard.tsx", () => ({
  CommunFinancingCard: ({
    onFunded,
    postLoginIntent,
    onPostLoginIntent,
  }: {
    onFunded?: () => void | Promise<void>;
    postLoginIntent?: { kind: string } | null;
    onPostLoginIntent?: (intent: { kind: string }) => void;
  }) => (
    <div data-testid="financing-card" data-intent={postLoginIntent?.kind ?? ""}>
      <button type="button" onClick={() => void onFunded?.()}>
        funded
      </button>
      <button type="button" onClick={() => onPostLoginIntent?.({ kind: "fund" })}>
        intention
      </button>
    </div>
  ),
}));
// Le SEO est un Helmet (exige un `HelmetProvider`) : seul ce que la page lui
// DIT est vérifié ici — titre, description, image, chemin canonique.
vi.mock("../AacSeo", () => ({
  AacSeo: (props: { title?: string | null; description?: string | null; image?: string | null; path?: string | null }) => (
    <div
      data-testid="seo"
      data-title={props.title ?? ""}
      data-description={props.description ?? ""}
      data-image={props.image ?? ""}
      data-path={props.path ?? ""}
    />
  ),
}));
vi.mock("../components/pageDetail/CommunTocNav.tsx", () => ({
  CommunTocNav: ({
    sections,
    activeSection,
  }: {
    sections: Array<{ id: string; icon: React.ElementType }>;
    activeSection: string;
  }) => (
    <nav data-testid="toc" data-active={activeSection}>
      {sections.map((s) => (
        <span key={s.id} data-testid={`toc-${s.id}`}>
          <s.icon className="toc-icon" />
        </span>
      ))}
    </nav>
  ),
}));
vi.mock("../components/pageDetail/CommunFinancingSection.tsx", () => ({
  CommunFinancingSection: () => <div data-testid="financing-section" />,
}));
vi.mock("../components/pageDetail/CommunActionsSection.tsx", () => ({ CommunActionsSection: () => null }));
vi.mock("../components/pageDetail/CommunMilestoneDialogs.tsx", () => ({ CommunMilestoneDialogs: () => null }));
vi.mock("../components/pageDetail/CommunContributorsSection.tsx", () => ({ CommunContributorsSection: () => null }));
vi.mock("../components/pageDetail/CommunCofinancersTable.tsx", () => ({
  CommunCofinancersTable: () => <div data-testid="cofinancers-table" />,
}));
vi.mock("../components/pageDetail/CommunProse.tsx", () => ({ CommunProse: () => null }));
vi.mock("../components/pageDetail/CommunContentSections.tsx", () => ({ GallerySection: () => null }));

// jsdom n'a pas d'IntersectionObserver ; la page en crée un pour le sommaire.
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

const { default: AacCommunDetailPage } = await import("./AacCommunDetailPage");

const FUNDING_IDS = ["financing-card", "financing-section", "cofinancers-table"] as const;
const FUNDING_TOC = ["toc-besoins-financiers", "toc-cofinanceurs"] as const;

beforeEach(() => {
  me = CONNECTED;
  // `ANSWER` est un objet PARTAGÉ par les douze tests du fichier : la remise à
  // zéro appartient au `beforeEach`, pas au corps du test qui l'a rempli. Écrite
  // là-bas, elle ne s'exécutait pas si l'assertion précédente échouait — et la
  // réponse d'un test partait alors dans tous les suivants. On repart d'un objet
  // neuf : `created`/`updated` et les champs SEO sont mutés eux aussi.
  ANSWER = { ...BASE_ANSWER };
  config = makeConfig(false);
  isConfigLoading = false;
  configError = null;
  detailSections = [];
  refetchAnswer.mockClear();
  invalidateQueries.mockClear();
});

describe("AacCommunDetailPage — le financement suit l'étape de financement", () => {
  it("sans étape de financement : ni carte, ni « Besoins financiers », ni « Cofinanceurs » — et pas d'entrée de sommaire", () => {
    config = makeConfig(false);
    render(<AacCommunDetailPage />);

    expect(screen.getByTestId("hero")).toBeTruthy();
    for (const id of [...FUNDING_IDS, ...FUNDING_TOC]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  it("avec l'étape : les trois blocs et leurs entrées de sommaire sont montés", () => {
    config = makeConfig(true);
    render(<AacCommunDetailPage />);

    for (const id of [...FUNDING_IDS, ...FUNDING_TOC]) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
  });

  /**
   * L'affichage suit l'étape SEULE : le legacy montre l'onglet funding aux
   * anonymes (`detailProposal.php:100-104` ne teste pas la session). La connexion
   * ne conditionne que l'ACTION de financer, à l'intérieur de la carte.
   */
  it("avec l'étape, un visiteur non connecté voit aussi les blocs financement", () => {
    config = makeConfig(true);
    me = ANONYMOUS;
    render(<AacCommunDetailPage />);

    for (const id of FUNDING_IDS) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
  });
});

describe("AacCommunDetailPage — la fiche attend la configuration de l'appel", () => {
  /**
   * Avant : la garde de chargement ne lisait que `answerQuery` et `formQuery`.
   * La config, plus lente, arrivait après — et `showFunding` avec elle : la
   * fiche d'un appel financé se rendait d'abord SANS carte ni « Besoins
   * financiers », héros pleine largeur, puis tout basculait en grille.
   */
  it("config en cours de chargement : le squelette — ni héros, ni financement, ni sommaire", () => {
    config = null;
    isConfigLoading = true;
    render(<AacCommunDetailPage />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByTestId("hero")).toBeNull();
    expect(screen.queryByTestId("toc")).toBeNull();
    for (const id of FUNDING_IDS) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  /**
   * Sans config, ni gates ni blocs déclarés ne se résolvent : la fiche se
   * rendait vidée de son financement et de sa prose, sans un mot. Même
   * traitement que `formQuery.error`, avec un message qui nomme la cause.
   */
  it("config en erreur : un message explicite, pas une fiche vidée en silence", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    config = null;
    configError = new Error("boom");
    render(<AacCommunDetailPage />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("page.error");
    expect(screen.getByText("page.configErrorMessage")).toBeTruthy();
    expect(screen.queryByTestId("hero")).toBeNull();
    consoleError.mockRestore();
  });
});

describe("AacCommunDetailPage — section active du sommaire", () => {
  /**
   * L'état partait de `"besoins-financiers"` en dur : sans étape de financement,
   * cette ancre n'existe pas et aucune entrée n'était active avant le premier
   * défilement.
   */
  it("sans financement, c'est la première entrée réelle qui est active", () => {
    config = makeConfig(false);
    detailSections = [CONTEXTE_SECTION];
    render(<AacCommunDetailPage />);

    expect(screen.getByTestId("toc-contexte")).toBeTruthy();
    expect(screen.getByTestId("toc").getAttribute("data-active")).toBe("contexte");
  });

  it("avec financement, « Besoins financiers » reste la première entrée active", () => {
    config = makeConfig(true);
    detailSections = [CONTEXTE_SECTION];
    render(<AacCommunDetailPage />);

    expect(screen.getByTestId("toc").getAttribute("data-active")).toBe("besoins-financiers");
  });
});

describe("AacCommunDetailPage — après un paiement, la fiche se rafraîchit (H5)", () => {
  /**
   * `CommunFinancingCard` déclarait `onFunded` et le passait à `CagnotteDialog`
   * (`onRefresh`), mais la page ne le fournissait pas. La modale n'invalide que
   * ses propres caches : la réponse (dont `funding` est recalculé) et les
   * dépenses brutes des trois blocs restaient périmées — « 0 € collectés »
   * après un paiement réussi.
   */
  it("`onFunded` relit la réponse et invalide les dépenses brutes du commun", async () => {
    config = makeConfig(true);
    render(<AacCommunDetailPage />);

    await act(async () => {
      fireEvent.click(screen.getByText("funded"));
    });

    expect(refetchAnswer).toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["aac-milestone-list-depenses", "a1"] });
  });
});

describe("AacCommunDetailPage — l'intention post-connexion est portée par la PAGE (M14/M15)", () => {
  /**
   * La connexion change `me.id`, donc les clés des trois requêtes user-scopées
   * de la fiche : elles repassent en chargement et la garde rend le squelette,
   * au rendu même où la session arrive. La carte est démontée à cet instant —
   * une intention gardée dans SON état partait avec elle, et l'action demandée
   * hors connexion n'était jamais rejouée.
   */
  it("posée par la carte, elle traverse le squelette de chargement et lui revient", () => {
    config = makeConfig(true);
    const { rerender } = render(<AacCommunDetailPage />);

    fireEvent.click(screen.getByText("intention"));
    expect(screen.getByTestId("financing-card").getAttribute("data-intent")).toBe("fund");

    // Rechargement post-login : plus de carte.
    config = null;
    isConfigLoading = true;
    rerender(<AacCommunDetailPage />);
    expect(screen.queryByTestId("financing-card")).toBeNull();

    // La fiche revient : l'intention est toujours là, la carte peut la rejouer.
    config = makeConfig(true);
    isConfigLoading = false;
    rerender(<AacCommunDetailPage />);
    expect(screen.getByTestId("financing-card").getAttribute("data-intent")).toBe("fund");
  });
});

describe("AacCommunDetailPage — la fiche rend son SEO (M12)", () => {
  /**
   * Avant : aucun Helmet — la page écrivait `document.title` dans un effet,
   * donc APRÈS hydratation, depuis le nom du FORMULAIRE, sans nettoyage. Le
   * `<head>` SSR portait un `<title>` vide et zéro balise `og:*` sur un lien
   * pourtant partageable.
   */
  it("titre du COMMUN, résumé en texte brut et URL canonique de la fiche", () => {
    ANSWER.answers = { aapStep1: { titre: "Une instance peertube", description: "Partage **vidéo**" } };
    render(<AacCommunDetailPage />);

    const seo = screen.getByTestId("seo");
    expect(seo.getAttribute("data-title")).toBe("Une instance peertube");
    expect(seo.getAttribute("data-description")).toBe("Partage vidéo");
    expect(seo.getAttribute("data-path")).toBe("/aac/commun/a1");
  });

  it("sans titre de commun, le nom de l'appel ; sans résumé, le libellé générique", () => {
    render(<AacCommunDetailPage />);

    const seo = screen.getByTestId("seo");
    expect(seo.getAttribute("data-title")).toBe("Appel test");
    expect(seo.getAttribute("data-description")).toBe("page.communDetailDescription");
  });

  it("le squelette de chargement porte déjà un SEO (nom de l'appel)", () => {
    config = null;
    isConfigLoading = true;
    render(<AacCommunDetailPage />);

    expect(screen.getByTestId("seo").getAttribute("data-title")).toBe("Appel test");
    expect(screen.getByTestId("seo").getAttribute("data-path")).toBe("/aac/commun/a1");
  });

  /**
   * L'ÉTAT DU SSR : le loader de route précharge la réponse, mais pas la config
   * de l'appel — la page rend donc son squelette côté serveur. Le SEO était
   * calculé APRÈS les gardes de chargement : le `<head>` servi au robot ou à
   * l'aperçu de messagerie ne portait qu'un titre générique, sans
   * `og:description` ni `og:image`, sur un lien pourtant fait pour être partagé.
   */
  it("le squelette porte le SEO DU COMMUN dès que la réponse est préchargée (SSR)", () => {
    ANSWER.name = "Une instance peertube";
    ANSWER.descriptionStr = "Partage **vidéo**";
    ANSWER.image = "/upload/commun.jpg";
    config = null;
    isConfigLoading = true;
    render(<AacCommunDetailPage />);

    // On est bien dans la branche squelette…
    expect(screen.getByRole("status")).toBeTruthy();
    // …et le `<head>` porte déjà le commun.
    const seo = screen.getByTestId("seo");
    expect(seo.getAttribute("data-title")).toBe("Une instance peertube");
    expect(seo.getAttribute("data-description")).toBe("Partage vidéo");
    expect(seo.getAttribute("data-image")).toBe("http://backend.test/upload/commun.jpg");
  });
});

describe("AacCommunDetailPage — icône d'un bloc déclaré (bonus)", () => {
  /**
   * `iconFor` promettait « inconnu ⇒ FileText », mais `DynamicIcon` rend `null`
   * sur un nom inconnu tant qu'aucun `fallback` ne lui est passé : l'entrée
   * de sommaire restait sans icône.
   */
  it("un nom d'icône inconnu rend FileText au sommaire, pas rien", () => {
    // `DynamicIcon` journalise l'échec du chargement — attendu ici.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    detailSections = [{ ...CONTEXTE_SECTION, icon: "icone-qui-n-existe-pas" }];
    render(<AacCommunDetailPage />);

    const entree = screen.getByTestId("toc-contexte");
    expect(entree.querySelector("svg.lucide-file-text")).toBeTruthy();
    consoleError.mockRestore();
  });
});

/**
 * Régression du lot 2 (H19) : `SmartCoForm` refuse désormais d'ouvrir un
 * brouillon d'édition sans lignée de péremption (`answerId` + `baseUpdatedAt ==
 * null`). Or la fiche ne passait que `answer.updated` — champ OPTIONNEL, absent
 * de tout commun jamais remanié depuis son dépôt. Le brouillon, activé par le
 * lot 1, se retrouvait silencieusement coupé sur ce sous-ensemble.
 *
 * `created` est une lignée équivalente : `computeDraftState` ne compare que
 * cette valeur à elle-même dans le temps, et la première modification serveur
 * pose un `updated` strictement supérieur au `created` gravé dans le brouillon.
 */
describe("AacCommunDetailPage — lignée de péremption du brouillon d'édition", () => {
  const baseUpdatedAt = () => screen.getByTestId("edit-modal").getAttribute("data-base-updated-at");

  it("commun jamais remanié (pas d'`updated`) : `created` sert de lignée", () => {
    ANSWER = { ...BASE_ANSWER, created: 1_700_000_000 };
    render(<AacCommunDetailPage />);

    expect(baseUpdatedAt()).toBe("1700000000");
  });

  it("commun déjà remanié : `updated` l'emporte, comportement inchangé", () => {
    ANSWER = { ...BASE_ANSWER, created: 1_700_000_000, updated: 1_700_009_999 };
    render(<AacCommunDetailPage />);

    expect(baseUpdatedAt()).toBe("1700009999");
  });

  it("ni l'un ni l'autre : `null`, la garde de `SmartCoForm` coupe le brouillon", () => {
    ANSWER = { ...BASE_ANSWER };
    render(<AacCommunDetailPage />);

    expect(baseUpdatedAt()).toBe("null");
  });
});
