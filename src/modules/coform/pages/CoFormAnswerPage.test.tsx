// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * Régression du lot 2 (H19) : `SmartCoForm` refuse d'ouvrir un brouillon
 * d'édition sans lignée de péremption (`answerId` fourni + `baseUpdatedAt ==
 * null`), faute de quoi « Reprendre » écraserait un jour, sans avertir, une
 * réponse modifiée entre-temps par quelqu'un d'autre.
 *
 * Mais cette page ne passait que `answer.updated` — champ OPTIONNEL sur
 * `CoFormAnswer` (`types.ts`), absent de toute réponse jamais modifiée depuis
 * son dépôt. Le brouillon d'édition, que le lot 1 venait d'activer, se
 * retrouvait donc coupé en silence sur tout ce sous-ensemble.
 *
 * `created` est une lignée équivalente : `computeDraftState` ne compare que
 * cette valeur à elle-même dans le temps, et la première modification serveur
 * pose un `updated` strictement supérieur au `created` gravé dans le brouillon.
 */

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("../i18n/i18n", () => ({}));
vi.mock("@/components/layout/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/layout/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("@dr.pogodin/react-helmet", () => ({ Helmet: () => null }));
vi.mock("@/lib/toastUtils", () => ({ showErrorToast: vi.fn() }));

vi.mock("react-router", () => ({
  useLoaderData: () => null,
  useParams: () => ({ formId: "f1", answerId: "a1" }),
  useSearchParams: () => [new URLSearchParams("mode=edit"), vi.fn()],
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

const FORM_DATA = { id: "f1", name: "Formulaire test", inputs: {} };

/** Réponse serveur du test courant — `canEdit` pour que le mode édition tienne. */
type TestAnswer = { canEdit: boolean; created?: number; updated?: number };
let answer: TestAnswer = { canEdit: true };

vi.mock("../hooks/useCoFormQuery", () => ({
  useCoFormQuery: () => ({ formData: FORM_DATA, isLoading: false, error: null, refetch: vi.fn() }),
  useCoFormAnswerQuery: () => ({
    answer,
    answerData: { step1: {} },
    isLoading: false,
    error: null,
  }),
  useCoFormFinalMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Le formulaire expose la lignée qu'il reçoit : c'est elle que sa garde
// `enableDraft` exige, et qu'il grave dans l'entrée localStorage du brouillon.
vi.mock("../components/SmartCoForm", () => ({
  SmartCoForm: (props: { baseUpdatedAt?: number | null }) => (
    <div data-testid="smart-coform" data-base-updated-at={String(props.baseUpdatedAt ?? "null")} />
  ),
}));
vi.mock("../components/CoFormReadOnly", () => ({ CoFormReadOnly: () => null }));
vi.mock("../components/CoFormThankYou", () => ({ CoFormThankYou: () => null }));
vi.mock("../contexts/CommonTableCatalogsLoader", () => ({
  CommonTableCatalogsLoader: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: CoFormAnswerPage } = await import("./CoFormAnswerPage");

const baseUpdatedAt = () => screen.getByTestId("smart-coform").getAttribute("data-base-updated-at");

beforeEach(() => {
  answer = { canEdit: true };
});

describe("CoFormAnswerPage — lignée de péremption du brouillon d'édition", () => {
  it("réponse jamais modifiée (pas d'`updated`) : `created` sert de lignée", () => {
    answer = { canEdit: true, created: 1_700_000_000 };
    render(<CoFormAnswerPage />);

    expect(baseUpdatedAt()).toBe("1700000000");
  });

  it("réponse déjà modifiée : `updated` l'emporte, comportement inchangé", () => {
    answer = { canEdit: true, created: 1_700_000_000, updated: 1_700_009_999 };
    render(<CoFormAnswerPage />);

    expect(baseUpdatedAt()).toBe("1700009999");
  });

  it("ni l'un ni l'autre : `null`, la garde de `SmartCoForm` coupe le brouillon", () => {
    answer = { canEdit: true };
    render(<CoFormAnswerPage />);

    expect(baseUpdatedAt()).toBe("null");
  });
});
