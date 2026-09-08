// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { AacResolvedConfig } from "../types";

/**
 * La fiche d'un commun ne monte ses trois blocs financement — la carte, « Besoins
 * financiers », « Cofinanceurs » — que si l'appel a levé le gate MAÎTRE `coremu`
 * (review MR 53, C3 ; parité `detailProposal.php:105`). Avant : montés sans
 * condition, et le calculateur de droits appelé SANS les gates du form — aucune
 * permission de financement n'aurait jamais pu être vraie.
 *
 * Le hook de permissions et son calculateur sont RÉELS : c'est le câblage
 * page → `config.gates` → calculateur → rendu qui est sous test, pas un stub.
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

const ANSWER = { _id: { $id: "a1" }, form: "f1", user: "u1", answers: {}, documents: [] };
const FORM = { id: "f1", name: "Appel test", inputs: {} };
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: queryKey[0] === "aac-commun-detail" ? ANSWER : FORM,
    isLoading: false,
    isSuccess: true,
    error: null,
    refetch: vi.fn(),
  }),
}));

/** Un objet STABLE par test : `useAacPermissions` mémoïse sur l'identité de `gates`. */
function makeConfig(coremu: boolean): AacResolvedConfig {
  return {
    formId: "f1",
    configId: null,
    aapType: "aac",
    steps: [],
    roles: { depenseStepKey: "aapStep1", evalStepKey: null, financementStepKey: null, suiviStepKey: null },
    criteria: [],
    criteriaSource: "none",
    gates: {
      active: true,
      onlyMemberAccess: false,
      oneAnswerPerPers: false,
      canReadOtherAnswers: false,
      showAnswers: false,
      coremu,
      anyOnewithLinkCanAnswer: false,
    },
    campaigns: [],
    typeCoFinancer: null,
  };
}
let config: AacResolvedConfig = makeConfig(false);
vi.mock("../hooks/useAacConfig", () => ({
  useAacConfig: () => ({ config, isLoading: false, error: null }),
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
vi.mock("../hooks/useAacDetailSections", () => ({
  useAacDetailSections: () => [],
  useAacGallerySubKey: () => null,
}));
vi.mock("@/modules/coform/components/CoFormModal", () => ({ CoFormModal: () => null }));

// Les blocs eux-mêmes ont leurs propres dépendances (cagnotte, React Query) hors
// du périmètre de CE test : on ne vérifie que leur PRÉSENCE dans l'arbre.
vi.mock("../components/pageDetail/CommunSelectionControl.tsx", () => ({ CommunSelectionControl: () => null }));
vi.mock("../components/pageDetail/CommunProjectControl.tsx", () => ({ CommunProjectControl: () => null }));
vi.mock("../components/pageDetail/CommunHero.tsx", () => ({ CommunHero: () => <div data-testid="hero" /> }));
vi.mock("../components/pageDetail/CommunFinancingCard.tsx", () => ({
  CommunFinancingCard: () => <div data-testid="financing-card" />,
}));
vi.mock("../components/pageDetail/CommunTocNav.tsx", () => ({
  CommunTocNav: ({ sections }: { sections: Array<{ id: string }> }) => (
    <nav>
      {sections.map((s) => (
        <span key={s.id} data-testid={`toc-${s.id}`} />
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

describe("AacCommunDetailPage — le financement suit le gate `coremu`", () => {
  beforeEach(() => {
    me = CONNECTED;
  });

  it("sans `coremu` : ni carte, ni « Besoins financiers », ni « Cofinanceurs » — et pas d'entrée de sommaire", () => {
    config = makeConfig(false);
    render(<AacCommunDetailPage />);

    expect(screen.getByTestId("hero")).toBeTruthy();
    for (const id of [...FUNDING_IDS, ...FUNDING_TOC]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  it("avec `coremu` : les trois blocs et leurs entrées de sommaire sont montés", () => {
    config = makeConfig(true);
    render(<AacCommunDetailPage />);

    for (const id of [...FUNDING_IDS, ...FUNDING_TOC]) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
  });

  /**
   * L'affichage suit `coremu` SEUL : le legacy montre l'onglet Contributions aux
   * anonymes (`detailProposal.php:105` ne teste pas la session). La connexion ne
   * conditionne que l'ACTION de financer, à l'intérieur de la carte.
   */
  it("avec `coremu`, un visiteur non connecté voit aussi les blocs financement", () => {
    config = makeConfig(true);
    me = ANONYMOUS;
    render(<AacCommunDetailPage />);

    for (const id of FUNDING_IDS) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
  });
});
