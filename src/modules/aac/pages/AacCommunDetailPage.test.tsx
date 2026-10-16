// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
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

// La suppression d'un commun fait QUITTER la fiche : la navigation est capturée
// pour pouvoir vérifier où elle mène, sans embarquer un routeur.
const navigate = vi.fn();
vi.mock("react-router", () => ({
  useParams: () => ({ answerId: "a1" }),
  useNavigate: () => navigate,
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
  links?: Record<string, unknown>;
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
      evalStepKeyFound: null,
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
    variants: {},
  }),
}));
vi.mock("../hooks/useCommunFundingContext", () => ({
  useCommunFundingContext: () => ({ context: null, originFormName: undefined }),
}));
vi.mock("../hooks/useCommunFundingHost", () => ({
  useCommunFundingHost: () => ({ hostEntity: null, isLoading: false }),
}));
/**
 * `isLoading` des deux hooks de données : c'est lui qui commande les squelettes.
 * Mutables, remis à `false` par le `beforeEach` — seuls les tests de chargement
 * les lèvent.
 */
let isFundingLoading = false;
let isDetailSectionsLoading = false;
vi.mock("../hooks/useAacFundingResource", () => ({
  useAacFundingResource: () => ({ targetResource: null, projectSlug: null, isLoading: isFundingLoading }),
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
  useAacDetailSections: () => ({ sections: detailSections, isLoading: isDetailSectionsLoading }),
  useAacGallerySubKey: () => null,
  useAacDemoBlocks: () => false,
}));
// La question liée aux contributeurs à l'édition se résout par la même entrée de cache que la
// config : sans formulaire déclaré ici, aucune question.
vi.mock("../hooks/useAacFormMeta", () => ({
  useAacFormMeta: () => ({ meta: null, isLoading: false, error: null }),
  useAacFormParams: () => undefined,
}));
// La modale d'édition expose la LIGNÉE de péremption qu'elle reçoit : c'est
// elle que `SmartCoForm` exige pour activer le brouillon, et qu'il grave dans
// l'entrée localStorage (cf. `useCoFormDraft.computeDraftState`).
vi.mock("@/modules/coform/components/CoFormModal", () => ({
  CoFormModal: (props: { baseUpdatedAt?: number | null; hiddenStepKeys?: string[] }) => (
    <div
      data-testid="edit-modal"
      data-base-updated-at={String(props.baseUpdatedAt ?? "null")}
      data-hidden-steps={(props.hiddenStepKeys ?? []).join(",")}
    />
  ),
}));

// Les blocs eux-mêmes ont leurs propres dépendances (cagnotte, React Query) hors
// du périmètre de CE test : on ne vérifie que leur PRÉSENCE dans l'arbre.
// La barre d'actions a ses propres tests (état, aplat, menu, écritures) : la page n'est observée
// que sur ce qu'elle lui passe. Elle apporterait sinon ses mutations, hors périmètre.
vi.mock("../components/pageDetail/CommunActionBar.tsx", () => ({
  CommunActionBar: (props: {
    canEdit: boolean;
    canManageEditors: boolean;
    selection: { contextId: string | null };
    project: { isLoading: boolean };
  }) => (
    <div
      data-testid="action-bar"
      data-can-edit={String(props.canEdit)}
      data-can-manage-editors={String(props.canManageEditors)}
      data-context-id={String(props.selection.contextId)}
      data-project-loading={String(props.project.isLoading)}
    />
  ),
}));
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
    isLoading,
  }: {
    sections: Array<{ id: string; icon: React.ElementType }>;
    activeSection: string;
    isLoading?: boolean;
  }) => (
    <nav data-testid="toc" data-active={activeSection} data-loading={String(!!isLoading)}>
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
  isFundingLoading = false;
  isDetailSectionsLoading = false;
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

/**
 * « Objectifs » et « Membres du projet » dépendent de la PHASE, que seule l'enveloppe résout —
 * après la config, donc après la garde de chargement de la page. En vol, la section garde son
 * titre et son ancre (l'`IntersectionObserver` reste câblé) et n'expose qu'un squelette : sans
 * ce troisième état, elles surgissent après coup et le sommaire s'allonge sous le curseur.
 */
describe("AacCommunDetailPage — la phase du commun en cours de résolution", () => {
  it("enveloppe en vol : les deux sections gardent titre et ancre, le sommaire est en squelette", () => {
    isFundingLoading = true;
    render(<AacCommunDetailPage />);

    expect(screen.getByText("detail.toc.actions")).toBeTruthy();
    expect(screen.getByText("detail.toc.contributors")).toBeTruthy();
    expect(screen.getByTestId("toc").getAttribute("data-loading")).toBe("true");
    // Sans quoi la barre proposerait « Générer » sur un commun qui a peut-être déjà un projet.
    expect(screen.getByTestId("action-bar")).toHaveAttribute("data-project-loading", "true");
  });

  it("phase résolue sans projet lié : les deux sections disparaissent, le sommaire est arrêté", () => {
    isFundingLoading = false;
    render(<AacCommunDetailPage />);

    expect(screen.queryByText("detail.toc.actions")).toBeNull();
    expect(screen.queryByText("detail.toc.contributors")).toBeNull();
    expect(screen.getByTestId("toc").getAttribute("data-loading")).toBe("false");
    expect(screen.getByTestId("action-bar")).toHaveAttribute("data-project-loading", "false");
  });

  it("blocs déclarés en vol : le sommaire attend, sans changer de longueur ensuite", () => {
    isDetailSectionsLoading = true;
    render(<AacCommunDetailPage />);

    expect(screen.getByTestId("toc").getAttribute("data-loading")).toBe("true");
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

/**
 * Un AAP n'a pas de `choose` (non déclaré en config ⇒ `fields.choose` nul), mais
 * il a une étape d'ÉVALUATION — les votes `decide` du form OCECO d'Open Atlas.
 * Le masquage à l'édition dépendait de `choose` : couper l'un rouvrait l'autre,
 * et l'auteur pouvait voter sur sa propre proposition.
 */
describe("AacCommunDetailPage — l'étape d'évaluation reste masquée à l'auteur", () => {
  const hiddenSteps = () => screen.getByTestId("edit-modal").getAttribute("data-hidden-steps");
  const withEvalStep = (
    evalStepKey: string | null,
    evalStepKeyFound: string | null = evalStepKey,
  ): AacResolvedConfig => {
    const base = makeConfig(false);
    return { ...base, roles: { ...base.roles, evalStepKey, evalStepKeyFound } };
  };

  it("AAP (pas de `choose`) : l'étape d'évaluation résolue est masquée au non-admin", () => {
    config = withEvalStep("aapStep2");
    render(<AacCommunDetailPage />);

    expect(hiddenSteps()).toBe("aapStep2");
  });

  it("ni `choose` ni étape d'évaluation : rien n'est masqué", () => {
    config = withEvalStep(null);
    render(<AacCommunDetailPage />);

    expect(hiddenSteps()).toBe("");
  });

  it("étape d'évaluation devinée par POSITION (aucune question de vote) : rien n'est masqué", () => {
    // Ce que produit le résolveur pour un AAP [identité, projet, budget] : `evalStepKey` vaut la
    // 2e étape par dispatch, mais rien ne l'a trouvée — c'est l'étape « projet » de l'auteur.
    config = withEvalStep("aapStep2", null);
    render(<AacCommunDetailPage />);

    expect(hiddenSteps()).toBe("");
  });
});

/**
 * Contributeurs à l'édition (`links.canEdit`) : ils MODIFIENT le commun — la modale d'édition est
 * montée pour eux —, mais le BOUTON qui gère la liste est réservé à l'auteur et aux admins (par la
 * question « Référent », ils la changent : parité legacy, décision du 30/09).
 * Identifiants au format Mongo : `editorIdsOf` écarte toute autre clé.
 */
describe("AacCommunDetailPage — contributeurs à l'édition", () => {
  const CONTRIB = "57618d6640bb4ece776308aa";
  const TIERS = "64785065919b8815ad72cf94";

  it("la sélection s'écrit sous le contexte de L'ANNUAIRE — la clé que son filtre lit", () => {
    render(<AacCommunDetailPage />);
    expect(screen.getByTestId("action-bar")).toHaveAttribute("data-context-id", "ctx");
  });

  it("l'auteur gère la liste ; un tiers connecté, non", () => {
    render(<AacCommunDetailPage />);
    expect(screen.getByTestId("action-bar")).toHaveAttribute("data-can-manage-editors", "true");
    cleanup();

    me = { id: TIERS, isConnected: true };
    render(<AacCommunDetailPage />);
    expect(screen.getByTestId("action-bar")).toHaveAttribute("data-can-manage-editors", "false");
  });

  it("un contributeur listé obtient « Modifier » sans le bouton de gestion de la liste ; un tiers, rien", () => {
    ANSWER = { ...BASE_ANSWER, links: { canEdit: { [CONTRIB]: { name: "Contrib", type: "citoyens" } } } };
    me = { id: CONTRIB, isConnected: true };
    render(<AacCommunDetailPage />);
    expect(screen.getByTestId("edit-modal")).toBeInTheDocument();
    expect(screen.getByTestId("action-bar")).toHaveAttribute("data-can-edit", "true");
    expect(screen.getByTestId("action-bar")).toHaveAttribute("data-can-manage-editors", "false");
    cleanup();

    me = { id: TIERS, isConnected: true };
    render(<AacCommunDetailPage />);
    expect(screen.queryByTestId("edit-modal")).not.toBeInTheDocument();
    expect(screen.getByTestId("action-bar")).toHaveAttribute("data-can-edit", "false");
  });
});
