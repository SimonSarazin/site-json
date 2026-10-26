// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import Cocolight from "@communecter/cocolight-api-client";

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
  useSearchParams: () => [new URLSearchParams(`mode=${mode}`), vi.fn()],
  useNavigate: () => vi.fn(),
  // La lecture seule passe par `FormQuestionDiscussions`, qui demande s'il est sous un routeur.
  useInRouterContext: () => true,
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

const FORM_DATA = { id: "f1", name: "Formulaire test", inputs: {} };

/** Réponse serveur du test courant — `canEdit` pour que le mode édition tienne. */
type TestAnswer = { canEdit: boolean; editDeniedReason?: string; created?: number; updated?: number };
let answer: TestAnswer | null = { canEdit: true };
/** Son champ `answers` : `null` quand le serveur n'en rend pas (réponse jamais remplie). */
let answerData: Record<string, unknown> | null = { step1: {} };
/** L'erreur de sa lecture : le SDK lève un 404 pour une réponse absente. */
let answerError: Error | null = null;
let mode: "edit" | "readonly" = "edit";

vi.mock("../hooks/useCoFormQuery", () => ({
  useCoFormQuery: () => ({ formData: FORM_DATA, isLoading: false, error: null, refetch: vi.fn() }),
  useCoFormAnswerQuery: () => ({
    answer,
    answerData,
    isLoading: false,
    error: answerError,
  }),
  useCoFormFinalMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Le formulaire expose la lignée qu'il reçoit : c'est elle que sa garde
// `enableDraft` exige, et qu'il grave dans l'entrée localStorage du brouillon.
vi.mock("../components/SmartCoForm", () => ({
  SmartCoForm: (props: { baseUpdatedAt?: number | null; defaultValues?: unknown }) => (
    <div
      data-testid="smart-coform"
      data-base-updated-at={String(props.baseUpdatedAt ?? "null")}
      data-default-values={JSON.stringify(props.defaultValues ?? null)}
    />
  ),
}));
// La lecture seule rend son emplacement `emptyState` À LA PLACE des étapes — son propre test le
// prouve sur le vrai composant (`CoFormReadOnly.test.tsx`) ; ici, la page décide de le remplir.
vi.mock("../components/CoFormReadOnly", () => ({
  CoFormReadOnly: (props: { emptyState?: ReactNode; submittedAt?: number; updatedAt?: number }) => (
    <div
      data-testid="readonly"
      data-submitted-at={String(props.submittedAt ?? "aucune")}
      data-updated-at={String(props.updatedAt ?? "aucune")}
    >
      {props.emptyState ?? <span data-testid="readonly-steps" />}
    </div>
  ),
}));
vi.mock("../components/CoFormThankYou", () => ({ CoFormThankYou: () => null }));
vi.mock("../contexts/CommonTableCatalogsLoader", () => ({
  CommonTableCatalogsLoader: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: CoFormAnswerPage } = await import("./CoFormAnswerPage");

const baseUpdatedAt = () => screen.getByTestId("smart-coform").getAttribute("data-base-updated-at");

beforeEach(() => {
  answer = { canEdit: true };
  answerData = { step1: {} };
  answerError = null;
  mode = "edit";
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

/**
 * Une réponse peut exister sans contenu — un dossier ouvert puis jamais rempli, une réponse sur
 * quatre en base de dev. La page la disait « introuvable », même en édition : on ne pouvait pas la
 * remplir. Décision de l'user (14/10) : en lecture, un encart le dit et propose de la remplir ; en
 * édition, le formulaire s'ouvre vide ; « Réponse introuvable » reste aux réponses ABSENTES.
 */
describe("CoFormAnswerPage — réponse sans contenu, réponse absente", () => {
  const encart = () => document.querySelector("[data-answer-empty]");

  it("sans champ `answers`, en lecture : l'encart à la place des étapes, sans barre d'actions ni dates", () => {
    mode = "readonly";
    answer = { canEdit: true, created: 1_700_000_000, updated: 1_700_000_500 };
    answerData = null;
    render(<CoFormAnswerPage />);

    expect(encart()).not.toBeNull();
    expect(screen.getByText("coform.answer.empty.title")).toBeTruthy();
    expect(screen.getByText("coform.answer.empty.descriptionCanFill")).toBeTruthy();
    expect(screen.queryByText("coform.answer.notFound")).toBeNull();
    expect(screen.queryByTestId("readonly-steps")).toBeNull();
    // La barre d'actions s'efface : son « Modifier » doublerait « Remplir ».
    expect(screen.queryByText("coform.answer.viewingAnswer")).toBeNull();
    expect(screen.queryByText("coform.answer.switchToEdit")).toBeNull();
    expect(screen.getByTestId("readonly").getAttribute("data-submitted-at")).toBe("aucune");
    expect(screen.getByTestId("readonly").getAttribute("data-updated-at")).toBe("aucune");
  });

  it("« Remplir » ouvre le formulaire, vide, et la barre d'actions revient pour en sortir", () => {
    mode = "readonly";
    answer = { canEdit: true, created: 1_700_000_000 };
    answerData = null;
    render(<CoFormAnswerPage />);

    const remplir = screen.getByRole("button", { name: "coform.answer.empty.fill" });
    remplir.focus();
    fireEvent.click(remplir);

    expect(screen.getByTestId("smart-coform").getAttribute("data-default-values")).toBe("null");
    expect(encart()).toBeNull();
    expect(screen.getByText("coform.answer.switchToReadonly")).toBeTruthy();
    // Le bouton a disparu avec l'encart : le focus passe au bandeau d'édition, pas à la page.
    expect(document.activeElement?.textContent).toBe("coform.access.editMode.description");
  });

  it("« Modifier », lui, ne déplace pas le focus vers le bandeau", () => {
    mode = "readonly";
    answerData = { step1: { titre: "Un titre" } };
    render(<CoFormAnswerPage />);

    fireEvent.click(screen.getByText("coform.answer.switchToEdit"));

    expect(document.activeElement?.textContent).not.toBe("coform.access.editMode.description");
  });

  it("des étapes sans aucune valeur (`{ aapStep1: {} }`) : vide aussi", () => {
    mode = "readonly";
    answerData = { aapStep1: {}, action: { x: { y: "" } } };
    render(<CoFormAnswerPage />);

    expect(encart()).not.toBeNull();
  });

  it("qui ne peut pas la modifier voit l'encart, sans bouton", () => {
    mode = "readonly";
    answer = { canEdit: false, editDeniedReason: "not_owner" };
    answerData = null;
    render(<CoFormAnswerPage />);

    expect(screen.getByText("coform.answer.empty.description")).toBeTruthy();
    expect(screen.queryByText("coform.answer.empty.descriptionCanFill")).toBeNull();
    expect(screen.queryByRole("button", { name: "coform.answer.empty.fill" })).toBeNull();
  });

  it("`?mode=edit` sans droit sur une réponse vide : le bandeau de refus, puis l'encart sans bouton", () => {
    mode = "edit";
    answer = { canEdit: false, editDeniedReason: "not_owner" };
    answerData = null;
    render(<CoFormAnswerPage />);

    expect(screen.getByText("coform.answer.editDenied.not_owner")).toBeTruthy();
    expect(encart()).not.toBeNull();
    expect(screen.queryByRole("button", { name: "coform.answer.empty.fill" })).toBeNull();
    expect(screen.queryByTestId("smart-coform")).toBeNull();
  });

  it("en édition, une réponse vide ouvre directement le formulaire vide, sans encart", () => {
    mode = "edit";
    answerData = null;
    render(<CoFormAnswerPage />);

    expect(screen.getByTestId("smart-coform").getAttribute("data-default-values")).toBe("null");
    expect(encart()).toBeNull();
  });

  it("une réponse AVEC contenu s'affiche comme avant : étapes, barre d'actions, « Soumis le »", () => {
    mode = "readonly";
    answer = { canEdit: true, created: 1_700_000_000 };
    answerData = { step1: { titre: "Un titre" } };
    render(<CoFormAnswerPage />);

    expect(encart()).toBeNull();
    expect(screen.getByTestId("readonly-steps")).toBeTruthy();
    expect(screen.getByText("coform.answer.switchToEdit")).toBeTruthy();
    expect(screen.getByTestId("readonly").getAttribute("data-submitted-at")).toBe("1700000000");
  });

  it("en édition, une réponse avec contenu pré-remplit le formulaire", () => {
    mode = "edit";
    answerData = { step1: { titre: "Un titre" } };
    render(<CoFormAnswerPage />);

    expect(screen.getByTestId("smart-coform").getAttribute("data-default-values")).toBe(JSON.stringify(answerData));
  });

  it("une réponse ABSENTE (404 du SDK) est « introuvable », pas une erreur", () => {
    answer = null;
    answerData = null;
    answerError = new Cocolight.error.ApiError("Aucune réponse trouvée pour l'ID a1", 404);
    render(<CoFormAnswerPage />);

    expect(screen.getByText("coform.answer.notFound")).toBeTruthy();
    expect(screen.queryByText("coform.status.error")).toBeNull();
    expect(screen.queryByText("Aucune réponse trouvée pour l'ID a1")).toBeNull();
  });

  it("un 404 du TRANSPORT (route absente) reste une erreur : la panne ne se cache pas derrière « introuvable »", () => {
    answer = null;
    answerData = null;
    answerError = new Cocolight.error.ApiClientError("Endpoint introuvable", 404);
    render(<CoFormAnswerPage />);

    expect(screen.getByText("coform.status.error")).toBeTruthy();
    expect(screen.queryByText("coform.answer.notFound")).toBeNull();
  });

  it("une réponse supprimée depuis son chargement (404 au rechargement, ancienne donnée en cache) : introuvable", () => {
    // React Query garde la dernière donnée quand un rechargement échoue : sans regarder l'erreur,
    // la page montrerait une réponse qui n'existe plus.
    mode = "readonly";
    answer = { canEdit: true, created: 1_700_000_000 };
    answerData = { step1: { titre: "Un titre" } };
    answerError = new Cocolight.error.ApiError("Aucune réponse trouvée pour l'ID a1", 404);
    render(<CoFormAnswerPage />);

    expect(screen.getByText("coform.answer.notFound")).toBeTruthy();
    expect(screen.queryByTestId("readonly")).toBeNull();
  });

  it("toute autre erreur de lecture reste une erreur, avec son message", () => {
    answer = null;
    answerData = null;
    answerError = new Cocolight.error.ApiClientError("Le serveur ne répond pas", 500);
    render(<CoFormAnswerPage />);

    expect(screen.getByText("coform.status.error")).toBeTruthy();
    expect(screen.getByText("Le serveur ne répond pas")).toBeTruthy();
    expect(screen.queryByText("coform.answer.notFound")).toBeNull();
  });
});
