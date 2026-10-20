// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * L'ORDRE des gardes de la fiche, tenu par le contrôleur — et non par chaque
 * interface. Le test de page observe le rendu ; celui-ci grave la séquence :
 * réponse absente → chargement → erreur de données → erreur de config →
 * introuvable → prête. Une erreur de config ne masque pas une erreur de données.
 */

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("@/lib/constant/common", () => ({ getBaseUrl: () => "http://backend.test" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

let answerId: string | undefined = "a1";
vi.mock("react-router", () => ({
  useParams: () => ({ answerId }),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ api: {}, loading: false, entity: { id: "host", isAdmin: () => false }, me: { id: "u1" }, refreshMe: vi.fn() }),
}));

type Q = { data: unknown; isLoading: boolean; error: Error | null };
let answerQ: Q;
let formQ: Q;
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    ...(queryKey[0] === "aac-commun-detail" ? answerQ : formQ),
    refetch: vi.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), removeQueries: vi.fn() }),
}));

let configState: { config: unknown; isLoading: boolean; error: Error | null };
vi.mock("./useAacConfig", () => ({ useAacConfig: () => configState }));
// Référence stable, comme le contexte réel (`fields` mémoïsé).
const directory = { formId: "f1", fields: {}, contextId: "ctx", context: null, variants: { detail: "editorial" } };
vi.mock("./useAacDirectoryContext", () => ({
  useAacDirectoryContext: () => directory,
}));
vi.mock("./useCommunFundingContext", () => ({ useCommunFundingContext: () => ({ context: null }) }));
vi.mock("./useCommunFundingHost", () => ({ useCommunFundingHost: () => ({ hostEntity: null, isLoading: false }) }));
vi.mock("./useAacFundingResource", () => ({
  useAacFundingResource: () => ({ targetResource: null, projectSlug: null, isLoading: false }),
}));
vi.mock("./useCommunObjectivesController", () => ({ useCommunObjectivesController: () => ({}) }));
vi.mock("./useAacFormMeta", () => ({
  useAacFormMeta: () => ({ meta: null, isLoading: false, error: null }),
  useAacFormParams: () => undefined,
}));
vi.mock("./useAacDetailSections", () => ({
  useAacDetailSections: () => ({ sections: [], isLoading: false }),
  useAacGallerySubKey: () => null,
  useAacDemoBlocks: () => false,
}));

const { useCommunDetailController } = await import("./useCommunDetailController");

const ok = (data: unknown): Q => ({ data, isLoading: false, error: null });
const boom = new Error("boom");

beforeEach(() => {
  answerId = "a1";
  answerQ = ok({ _id: { $id: "a1" }, form: "f1", answers: {}, documents: [] });
  formQ = ok({ id: "f1", name: "Appel test" });
  configState = { config: null, isLoading: false, error: null };
});

const statusOf = () => {
  const { result } = renderHook(() => useCommunDetailController());
  const vm = result.current;
  return vm.status === "error" ? `error:${vm.kind}` : vm.status;
};

describe("useCommunDetailController — l'ordre des gardes", () => {
  it("sans answerId, rien d'autre ne compte", () => {
    answerId = undefined;
    configState = { config: null, isLoading: true, error: boom };
    expect(statusOf()).toBe("missing-answer");
  });

  it("le chargement passe avant toute erreur — config comprise", () => {
    configState = { config: null, isLoading: true, error: null };
    answerQ = { ...answerQ, error: boom };
    expect(statusOf()).toBe("loading");
  });

  it("une erreur de DONNÉES passe avant une erreur de config", () => {
    answerQ = { data: undefined, isLoading: false, error: boom };
    configState = { config: null, isLoading: false, error: boom };
    expect(statusOf()).toBe("error:data");
  });

  it("une erreur de config passe avant « introuvable »", () => {
    formQ = ok(undefined);
    configState = { config: null, isLoading: false, error: boom };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(statusOf()).toBe("error:config");
  });

  it("sans réponse ni formulaire : introuvable", () => {
    formQ = ok(undefined);
    expect(statusOf()).toBe("error:not-found");
  });

  it("l'interface choisie par le site est connue dès le chargement — la coquille en préchauffe le chunk", () => {
    configState = { config: null, isLoading: true, error: null };
    const { result } = renderHook(() => useCommunDetailController());
    expect(result.current.status).toBe("loading");
    expect(result.current.pageVariant).toBe("editorial");
  });

  it("sinon : prête, et le SEO est présent dans TOUS les états", () => {
    expect(statusOf()).toBe("ready");
    answerId = undefined;
    const { result } = renderHook(() => useCommunDetailController());
    expect(result.current.seo.path).toBe("/aac");
  });
});

describe("useCommunDetailController — lectures de la réponse mémoïsées", () => {
  const readyVM = (vm: ReturnType<typeof useCommunDetailController>) => {
    if (vm.status !== "ready") throw new Error(`fiche non prête : ${vm.status}`);
    return vm;
  };

  it("un re-rendu garde la même carte et les mêmes libellés : les mémos des vues ne repartent pas", () => {
    const { result, rerender } = renderHook(() => useCommunDetailController());
    const first = readyVM(result.current);
    rerender();
    const second = readyVM(result.current);

    expect(second.summary.card).toBe(first.summary.card);
    expect(second.summary.usageLabels).toBe(first.summary.usageLabels);
  });

  it("une nouvelle réponse donne une nouvelle carte", () => {
    const { result, rerender } = renderHook(() => useCommunDetailController());
    const first = readyVM(result.current);
    answerQ = ok({ _id: { $id: "a1" }, form: "f1", answers: { aapStep1: { titre: "Renommé" } }, documents: [] });
    rerender();

    expect(readyVM(result.current).summary.card).not.toBe(first.summary.card);
  });
});
