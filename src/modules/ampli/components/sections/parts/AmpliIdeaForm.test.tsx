// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import "@/modules/ampli/i18n";
import "@/modules/coform/i18n/i18n";
import i18n from "@/i18n";
import { renderWithProviders, screen, userEvent } from "../../../../../../tests/test-utils-ui";
import { AMPLI_QUERY_KEYS } from "../../../constants/queryKeys";

/**
 * Tests du formulaire de proposition EN LIGNE (colonne gauche d'AmpliFeatures).
 *
 * Ce qui est vérifié ici est l'ORCHESTRATION propre à ampli — états de
 * chargement/erreur, arbitrage du garde d'accès, accusé de réception,
 * invalidation du cache ampli, passage en édition. Le moteur de formulaire
 * (`SmartCoForm`) est mocké : son rendu et sa soumission sont testés côté
 * module coform.
 */

const openLogin = vi.fn();
const refetch = vi.fn();
/** Props reçues par `SmartCoForm` — c'est le contrat qu'on vérifie. */
const smartCoFormProps = vi.fn();

interface QueryState {
  formData: Record<string, unknown> | null;
  access: Record<string, unknown> | null;
  isLoading: boolean;
  error: Error | null;
}
let queryState: QueryState;

vi.mock("@/modules/auth/hooks/useAuthModal", () => ({ useAuthModal: () => ({ openLogin }) }));
vi.mock("@/modules/coform/hooks/useCoFormQuery", () => ({
  useCoFormQuery: () => ({ ...queryState, refetch, stepsCount: 1, isMultiStep: false }),
}));
vi.mock("@/modules/coform/components/SmartCoForm", () => ({
  SmartCoForm: (props: Record<string, unknown>) => {
    smartCoFormProps(props);
    return (
      <button type="button" onClick={() => (props.onAfterSubmit as () => void)?.()}>
        {String(props.submitButtonText ?? "Envoyer")}
      </button>
    );
  },
}));

const AmpliIdeaForm = (await import("./AmpliIdeaForm")).default;

const COFORM_ID = "coform-1";

let client: QueryClient;
let invalidateSpy: ReturnType<typeof vi.spyOn>;

function wrap(node: ReactNode) {
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

const render = (submitLabel = "Soumettre à la communauté") =>
  renderWithProviders(wrap(<AmpliIdeaForm coformId={COFORM_ID} submitLabel={submitLabel} />));

/** `dates` est toujours peuplé par le backend, et `CoFormAccessGuard` le lit
 *  sans garde pour afficher la période d'ouverture. */
const NO_DATES = { start: null, end: null, startNoConfirmation: null, endNoConfirmation: null };

/** Accès ouvert : le garde laisse passer. */
const openAccess = { canAnswer: true, reason: "ok", isOneAnswerPerPers: false, dates: NO_DATES };

/** Réponse unique déjà envoyée — le garde propose de la modifier. */
const alreadyAnswered = {
  canAnswer: false,
  reason: "already_answered",
  isOneAnswerPerPers: true,
  existingAnswerId: "answer-9",
  existingAnswer: { step1: { title: "Mon idée" } },
  dates: NO_DATES,
};

describe("AmpliIdeaForm", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  beforeEach(() => {
    openLogin.mockClear();
    refetch.mockClear();
    smartCoFormProps.mockClear();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = vi.spyOn(client, "invalidateQueries");
    queryState = { formData: { name: "Idées" }, access: openAccess, isLoading: false, error: null };
  });

  describe("états de chargement", () => {
    it("rend un squelette tant que la structure du formulaire n'est pas là", () => {
      queryState = { formData: null, access: null, isLoading: true, error: null };
      const { container } = render();

      expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
      expect(smartCoFormProps).not.toHaveBeenCalled();
    });

    it("annonce l'échec au lieu de laisser la colonne vide", () => {
      queryState = { formData: null, access: null, isLoading: false, error: new Error("boom") };
      render();

      expect(
        screen.getByText("Le formulaire de proposition n'a pas pu être chargé"),
      ).toBeInTheDocument();
    });

    // `useCoFormQuery` peut rendre `isLoading: false` sans donnée (query
    // désactivée tant que l'API n'est pas prête) : sans ce garde, `formData`
    // null partirait dans `SmartCoForm`.
    it("traite l'absence de données comme une erreur", () => {
      queryState = { formData: null, access: null, isLoading: false, error: null };
      render();

      expect(
        screen.getByText("Le formulaire de proposition n'a pas pu être chargé"),
      ).toBeInTheDocument();
    });
  });

  describe("formulaire ouvert", () => {
    it("rend le formulaire avec le libellé d'envoi de la config", () => {
      render("Soumettre à la communauté");

      expect(screen.getByRole("button", { name: "Soumettre à la communauté" })).toBeInTheDocument();
    });

    it("masque la bannière du coform (la section porte déjà son titre)", () => {
      render();

      expect(smartCoFormProps).toHaveBeenCalledWith(expect.objectContaining({ hideBanner: true }));
    });

    // Sans `formId`, la mutation de soumission de `SmartCoForm` partirait sur un
    // id vide — le formulaire s'afficherait mais rien ne serait enregistré.
    it("transmet l'id du formulaire ET sa structure", () => {
      render();

      expect(smartCoFormProps).toHaveBeenCalledWith(
        expect.objectContaining({ formId: COFORM_ID, formData: queryState.formData }),
      );
    });

    it("ouvre un formulaire VIERGE hors mode édition", () => {
      render();

      expect(smartCoFormProps).toHaveBeenCalledWith(
        expect.objectContaining({ answerId: undefined, defaultValues: undefined }),
      );
    });
  });

  describe("accès refusé", () => {
    it("affiche la carte de refus et ouvre la connexion", async () => {
      queryState.access = { canAnswer: false, reason: "not_logged_in", isOneAnswerPerPers: false, dates: NO_DATES };
      render();

      expect(screen.getByText("Connexion requise")).toBeInTheDocument();
      expect(smartCoFormProps).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole("button", { name: /Se connecter/ }));
      expect(openLogin).toHaveBeenCalledTimes(1);
    });

    it("recalcule l'accès après connexion (pas de rechargement de page)", async () => {
      queryState.access = { canAnswer: false, reason: "not_logged_in", isOneAnswerPerPers: false, dates: NO_DATES };
      render();

      await userEvent.click(screen.getByRole("button", { name: /Se connecter/ }));
      (openLogin.mock.calls[0][0] as { onSuccess: () => void }).onSuccess();
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("après soumission", () => {
    it("invalide le cache ampli — sinon l'idée n'apparaît nulle part", async () => {
      render();

      await userEvent.click(screen.getByRole("button", { name: "Soumettre à la communauté" }));

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: AMPLI_QUERY_KEYS.FETCH_ANSWERS_PREFIX(COFORM_ID),
      });
    });

    it("remplace le formulaire par un accusé de réception", async () => {
      render();

      await userEvent.click(screen.getByRole("button", { name: "Soumettre à la communauté" }));

      expect(screen.getByText("Votre réponse a été enregistrée")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Soumettre à la communauté" })).toBeNull();
    });

    it("propose d'en soumettre une autre, et le formulaire revient vierge", async () => {
      render();

      await userEvent.click(screen.getByRole("button", { name: "Soumettre à la communauté" }));
      await userEvent.click(screen.getByRole("button", { name: /Soumettre une autre réponse/ }));

      expect(screen.getByRole("button", { name: "Soumettre à la communauté" })).toBeInTheDocument();
      expect(smartCoFormProps).toHaveBeenLastCalledWith(
        expect.objectContaining({ answerId: undefined, defaultValues: undefined }),
      );
    });

    // Une seule réponse autorisée : proposer « une autre » mènerait à un refus.
    it("propose de MODIFIER quand le formulaire est à réponse unique", async () => {
      queryState.access = { ...alreadyAnswered, canAnswer: true, reason: "ok" };
      render();

      await userEvent.click(screen.getByRole("button", { name: "Soumettre à la communauté" }));

      expect(screen.queryByRole("button", { name: /Soumettre une autre réponse/ })).toBeNull();
      expect(screen.getByRole("button", { name: /Modifier ma réponse/ })).toBeInTheDocument();
    });

    // `access` est encore en cours de refetch juste après le premier envoi :
    // rouvrir le formulaire sans l'id remonterait une CRÉATION, donc un doublon.
    it("n'offre pas la modification tant que l'id de la réponse n'est pas revenu", async () => {
      queryState.access = { ...alreadyAnswered, canAnswer: true, reason: "ok", existingAnswerId: null };
      render();

      await userEvent.click(screen.getByRole("button", { name: "Soumettre à la communauté" }));

      expect(screen.getByText("Votre réponse a été enregistrée")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Modifier ma réponse/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /Soumettre une autre réponse/ })).toBeNull();
    });
  });

  describe("mode édition", () => {
    it("recharge SA réponse dans le formulaire", async () => {
      queryState.access = alreadyAnswered;
      render();

      expect(screen.getByText("Vous avez déjà répondu")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: /Modifier ma réponse/ }));

      expect(smartCoFormProps).toHaveBeenLastCalledWith(
        expect.objectContaining({
          answerId: "answer-9",
          defaultValues: { step1: { title: "Mon idée" } },
        }),
      );
    });

    it("annonce une mise à jour, pas un enregistrement, après édition", async () => {
      queryState.access = alreadyAnswered;
      render();

      await userEvent.click(screen.getByRole("button", { name: /Modifier ma réponse/ }));
      await userEvent.click(screen.getByRole("button", { name: "Soumettre à la communauté" }));

      expect(screen.getByText("Votre réponse a été mise à jour")).toBeInTheDocument();
    });
  });
});
