// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import "@/modules/ampli/i18n";
import i18n from "@/i18n";
import { renderWithProviders, screen } from "../../../../../tests/test-utils-ui";
import type { AmpliDataResponse } from "../../helpers/summary";

/**
 * Tests de la section bicolonne « Proposez votre idée ».
 *
 * Le formulaire est mocké (testé dans `parts/AmpliIdeaForm.test.tsx`) : ce qui
 * compte ici est qu'il soit RENDU dans la colonne gauche avec le bon coform, et
 * que le chargement des réponses ne fasse plus disparaître toute la section.
 */

const ideaFormProps = vi.fn();
vi.mock("./parts/AmpliIdeaForm", () => ({
  default: (props: Record<string, unknown>) => {
    ideaFormProps(props);
    return <div data-testid="idea-form" />;
  },
}));

const AmpliFeatures = (await import("./AmpliFeatures")).default;

/** Réponse minimale au format attendu par `getSummaryData`. */
function makeAnswer(userId: string, liked = false): AmpliDataResponse {
  return {
    answer: {
      serverData: {
        user: { serverData: { _id: userId } },
        ...(liked ? { voteCount: { like: 1 } } : {}),
      },
    },
    data: {},
  } as unknown as AmpliDataResponse;
}

describe("AmpliFeatures", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  beforeEach(() => {
    ideaFormProps.mockClear();
  });

  it("rend le formulaire de proposition dans la colonne gauche", async () => {
    renderWithProviders(<AmpliFeatures props={undefined} coform="coform-1" data={[]} />);

    expect(await screen.findByTestId("idea-form")).toBeInTheDocument();
    expect(ideaFormProps).toHaveBeenCalledWith(
      expect.objectContaining({ coformId: "coform-1", submitLabel: "Soumettre à la communauté" }),
    );
  });

  it("passe le libellé de bouton de la config au formulaire", async () => {
    renderWithProviders(
      <AmpliFeatures
        props={{ button: { fr: "Envoyer mon idée", en: "Send my idea" } }}
        coform="coform-1"
        data={[]}
      />,
    );

    await screen.findByTestId("idea-form");
    expect(ideaFormProps).toHaveBeenCalledWith(
      expect.objectContaining({ submitLabel: "Envoyer mon idée" }),
    );
  });

  // Régression : la section retournait `null` pendant le chargement des
  // réponses, ce qui laissait la zone du formulaire vide alors que le
  // formulaire, lui, ne dépend pas de ces données.
  it("reste montée pendant le chargement des réponses", async () => {
    renderWithProviders(
      <AmpliFeatures props={undefined} coform="coform-1" isLoading data={[]} />,
    );

    expect(screen.getByText("Proposez votre idée")).toBeInTheDocument();
    expect(await screen.findByTestId("idea-form")).toBeInTheDocument();
  });

  it("met les compteurs en squelette pendant le chargement, puis les affiche", async () => {
    const data = [makeAnswer("u1", true), makeAnswer("u2")];
    const { container, rerender } = renderWithProviders(
      <AmpliFeatures props={undefined} coform="coform-1" isLoading data={data} />,
    );
    await screen.findByTestId("idea-form");

    // 4 compteurs en squelette (le squelette du chunk formulaire a déjà disparu).
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(4);

    rerender(<AmpliFeatures props={undefined} coform="coform-1" data={data} />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(0);
    // 2 réponses, 2 auteurs distincts, 1 « amplifiée », 0 discussion.
    expect(screen.getByText("Idées soumises").parentElement).toHaveTextContent("2");
    expect(screen.getByText("Idées amplifiées").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Discussions générées").parentElement).toHaveTextContent("0");
  });
});
