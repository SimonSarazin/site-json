// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { CommunDeletionPlan } from "../../lib/communDeletion";

/**
 * Le dialogue porte une RÈGLE, pas seulement un affichage : il refuse la
 * suppression d'un commun financé. Ce qui est vérifié ici, c'est surtout
 * l'absence de porte de sortie — pas de bouton de validation quand c'est refusé,
 * ni tant qu'on ignore ce qui serait détruit.
 */

// Les libellés réels vivent dans les bundles i18n ; ici on rend la CLÉ suivie de
// ses paramètres, pour pouvoir vérifier à la fois quel message est choisi et
// avec quelles valeurs il est nourri.
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string, params?: Record<string, unknown>) => {
    const base = fallback ?? key;
    if (!params) return base;
    return `${base} ${Object.values(params).join(" ")}`;
  },
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const { CommunDeleteDialog } = await import("./CommunDeleteDialog");

type Props = Parameters<typeof CommunDeleteDialog>[0];

const plan = (over: Partial<CommunDeletionPlan> = {}): CommunDeletionPlan => ({
  projectId: null,
  actionIds: [],
  paymentCount: 0,
  paymentAmount: 0,
  isBlocked: false,
  ...over,
});

const onConfirm = vi.fn();

function poser(over: Partial<Props> = {}) {
  return render(
    <CommunDeleteDialog
      open
      onOpenChange={() => {}}
      communTitle="Grainothèque partagée"
      plan={plan()}
      onConfirm={onConfirm}
      {...over}
    />
  );
}

const valider = () => screen.queryByRole("button", { name: /delete\.confirm\.confirm/ });

beforeEach(() => onConfirm.mockReset());

describe("CommunDeleteDialog — commun supprimable", () => {
  it("nomme le commun et propose de valider", () => {
    poser();
    expect(screen.getByText(/delete\.confirm\.description Grainothèque partagée/)).toBeInTheDocument();
    expect(valider()).toBeInTheDocument();
  });

  it("bascule sur une phrase sans titre quand le commun n'en a pas", () => {
    poser({ communTitle: "   " });
    expect(screen.getByText(/descriptionNoTitle/)).toBeInTheDocument();
  });

  it("sans projet lié, aucune option de cascade n'est proposée", () => {
    poser();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("valide SANS cascade par défaut, même lorsqu'un projet est lié", () => {
    poser({ plan: plan({ projectId: "p1", actionIds: ["a1", "a2"] }) });

    // Emporter le projet est un second geste destructif : il se demande.
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(valider()!);
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it("coché, transmet la demande de cascade", () => {
    poser({ plan: plan({ projectId: "p1", actionIds: ["a1", "a2"] }) });

    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).toBeChecked();
    fireEvent.click(valider()!);
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it("annonce le nombre d'actions emportées", () => {
    poser({ plan: plan({ projectId: "p1", actionIds: ["a1", "a2", "a3"] }) });
    expect(screen.getByText(/delete\.withProject\.label 3/)).toBeInTheDocument();
  });
});

describe("CommunDeleteDialog — commun financé", () => {
  const finance = plan({ isBlocked: true, paymentCount: 2, paymentAmount: 4400 });

  /** LA règle : aucune porte de sortie, pas même un bouton désactivé. */
  it("ne propose AUCUN bouton de validation", () => {
    poser({ plan: finance });
    expect(valider()).toBeNull();
    expect(
      screen.queryByRole("button", { name: /delete\.confirm\.confirmWithProject/ })
    ).toBeNull();
  });

  it("motive le refus par le montant et le nombre de financements", () => {
    poser({ plan: finance });
    const texte = screen.getByText(/delete\.blocked\.description/).textContent ?? "";
    expect(texte).toContain("2");
    expect(texte).toContain("4");
  });

  /** Un refus sans issue est une impasse : on nomme le geste réversible. */
  it("oriente vers le retrait de l'annuaire", () => {
    poser({ plan: finance });
    expect(screen.getByText(/delete\.blocked\.hint/)).toBeInTheDocument();
  });

  it("n'offre pas non plus la cascade, même si un projet est lié", () => {
    poser({ plan: { ...finance, projectId: "p1", actionIds: ["a1"] } });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

describe("CommunDeleteDialog — plan inconnu", () => {
  /**
   * Le pire n'est pas l'attente, c'est le clic : sans le plan, on ignore si de
   * l'argent a été versé.
   */
  it("ne laisse pas valider tant que les financements ne sont pas connus", () => {
    poser({ isPlanLoading: true });
    expect(valider()).toBeNull();
    expect(screen.getByText(/delete\.checking/)).toBeInTheDocument();
  });

  it("ne propose pas la cascade non plus pendant la vérification", () => {
    poser({ isPlanLoading: true, plan: plan({ projectId: "p1", actionIds: ["a1"] }) });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
