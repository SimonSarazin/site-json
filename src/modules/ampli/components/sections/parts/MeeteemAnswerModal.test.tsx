// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import "@/modules/ampli/i18n";
import i18n from "@/i18n";
import { renderWithProviders, screen, userEvent } from "../../../../../../tests/test-utils-ui";
import { AMPLI_QUERY_KEYS } from "../../../constants/queryKeys";
import { COFORM_QUERY_KEYS } from "@/modules/coform/constants";

/**
 * Tests du détail d'une réponse Meeteem (lecture seule, et édition de SA
 * propre réponse).
 *
 * `CoFormModal` est mocké : ce qui est vérifié ici est le CONTRAT passé à la
 * modale coform (quoi afficher, en lecture ou en édition), pas le rendu du
 * moteur de formulaire.
 */

const coFormModalProps = vi.fn();
vi.mock("@/modules/coform/components/CoFormModal", () => ({
  default: (props: Record<string, unknown>) => {
    coFormModalProps(props);
    return (
      <div data-testid="coform-modal" data-readonly={String(props.readOnly)}>
        {props.headerActions as ReactNode}
        <button type="button" onClick={() => (props.onAfterSubmit as () => void)?.()}>
          enregistrer
        </button>
      </div>
    );
  },
}));

let answerQuery: {
  answer: { canEdit?: boolean } | null;
  answerData: unknown;
  isLoading: boolean;
  error: Error | null;
};
vi.mock("@/modules/coform/hooks/useCoFormQuery", () => ({
  useCoFormAnswerQuery: () => answerQuery,
}));

const { MeeteemAnswerModal } = await import("./MeeteemAnswerModal");

const COFORM_ID = "coform-1";
let client: QueryClient;
let invalidateSpy: ReturnType<typeof vi.spyOn>;

const modal = (answerId: string | null, title?: string) => (
  <QueryClientProvider client={client}>
    <MeeteemAnswerModal coformId={COFORM_ID} answerId={answerId} onClose={() => {}} title={title} />
  </QueryClientProvider>
);
const render = (answerId: string | null, title?: string) => renderWithProviders(modal(answerId, title));

const editButton = () => screen.queryByRole("button", { name: "Modifier" });
const isReadOnly = () => screen.getByTestId("coform-modal").getAttribute("data-readonly");

describe("MeeteemAnswerModal", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  beforeEach(() => {
    coFormModalProps.mockClear();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = vi.spyOn(client, "invalidateQueries");
    answerQuery = {
      answer: { canEdit: false },
      answerData: { step1: { titre: "Francki" } },
      isLoading: false,
      error: null,
    };
  });

  it("ne monte rien tant qu'aucune réponse n'est ouverte", () => {
    render(null);

    expect(screen.queryByTestId("coform-modal")).toBeNull();
  });

  it("affiche un squelette pendant le chargement de la réponse", () => {
    answerQuery = { answer: null, answerData: null, isLoading: true, error: null };
    render("answer-1", "Francki");

    expect(screen.getByText("Francki")).toBeInTheDocument();
    // La modale coform ne se monte pas sans donnée : elle rendrait une fiche vide.
    expect(coFormModalProps).not.toHaveBeenCalled();
  });

  it("annonce l'échec du chargement", () => {
    answerQuery = { answer: null, answerData: null, isLoading: false, error: new Error("boom") };
    render("answer-1");

    expect(screen.getByText("Impossible de charger cette réponse.")).toBeInTheDocument();
  });

  describe("réponse ouverte", () => {
    it("transmet la réponse en lecture seule", async () => {
      render("answer-1", "Francki");
      await screen.findByTestId("coform-modal");

      expect(coFormModalProps).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: COFORM_ID,
          answerId: "answer-1",
          defaultValues: answerQuery.answerData,
          readOnly: true,
        }),
      );
    });

    // Régression : la bannière peignait le nom du FORMULAIRE (« Sinistre ») en
    // `<h1>` 4xl, au-dessus du titre de la RÉPONSE laissé en `text-lg`.
    it("masque la bannière du formulaire et met le titre de la réponse en avant", async () => {
      render("answer-1", "Francki");
      await screen.findByTestId("coform-modal");

      const props = coFormModalProps.mock.calls[0][0];
      expect(props.hideBanner).toBe(true);
      expect(props.title).toBe("Francki");
      expect(String(props.titleClassName)).toContain("text-2xl");
    });

    it("retombe sur un titre générique quand la carte n'en fournit pas", async () => {
      render("answer-1");
      await screen.findByTestId("coform-modal");

      expect(coFormModalProps).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Détail de la réponse" }),
      );
    });
  });

  describe("édition de sa propre réponse", () => {
    // Le droit vient du BACKEND (propriété + formulaire encore ouvert) : rien
    // ne doit être proposé sur la réponse de quelqu'un d'autre.
    it("ne propose rien quand la réponse n'est pas la sienne", async () => {
      render("answer-1", "Francki");
      await screen.findByTestId("coform-modal");

      expect(editButton()).toBeNull();
      expect(isReadOnly()).toBe("true");
    });

    it("ouvre en lecture, et bascule en édition au clic", async () => {
      answerQuery.answer = { canEdit: true };
      render("answer-1", "Francki");
      await screen.findByTestId("coform-modal");
      expect(isReadOnly()).toBe("true");

      await userEvent.click(editButton()!);

      expect(isReadOnly()).toBe("false");
      // Plus rien à proposer : on y est déjà.
      expect(editButton()).toBeNull();
    });

    it("pré-remplit avec la réponse COMPLÈTE re-fetchée", async () => {
      answerQuery.answer = { canEdit: true };
      render("answer-1", "Francki");
      await screen.findByTestId("coform-modal");

      await userEvent.click(editButton()!);

      // La sauvegarde envoie le payload ENTIER : partir de la projection
      // partielle de la carte effacerait les champs absents.
      expect(coFormModalProps).toHaveBeenLastCalledWith(
        expect.objectContaining({ answerId: "answer-1", defaultValues: answerQuery.answerData }),
      );
    });

    it("rafraîchit l'annuaire ET le détail après enregistrement", async () => {
      answerQuery.answer = { canEdit: true };
      render("answer-1", "Francki");
      await screen.findByTestId("coform-modal");

      await userEvent.click(editButton()!);
      await userEvent.click(screen.getByRole("button", { name: "enregistrer" }));

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: AMPLI_QUERY_KEYS.FETCH_ANSWERS_PREFIX(COFORM_ID),
      });
      // Sans celle-ci, rouvrir le détail servirait la version d'avant (cache 2 min).
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: COFORM_QUERY_KEYS.FORM_ANSWER_PREFIX(COFORM_ID, "answer-1"),
      });
    });

    // La modale n'est pas démontée entre deux réponses : sans état dérivé de
    // l'id, la suivante s'ouvrirait directement en édition.
    it("rouvre en LECTURE sur une autre réponse", async () => {
      answerQuery.answer = { canEdit: true };
      const { rerender } = render("answer-1", "Francki");
      await screen.findByTestId("coform-modal");
      await userEvent.click(editButton()!);
      expect(isReadOnly()).toBe("false");

      rerender(modal("answer-2", "Autre"));

      expect(isReadOnly()).toBe("true");
      expect(editButton()).not.toBeNull();
    });
  });
});
