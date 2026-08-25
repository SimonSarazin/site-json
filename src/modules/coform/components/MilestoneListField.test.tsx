// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { FormFieldMapping } from "../types";
import type { DepenseEntry } from "../utils/depense";

/**
 * Ces tests verrouillent les DEUX défauts corrigés par le passage en
 * react-hook-form :
 *
 *  1. la saisie était impossible tant que la réponse n'existait pas
 *     (`if (!answerId)` → « enregistrez d'abord ») ;
 *  2. la valeur RHF n'était jamais réécrite alors qu'elle est soumise, si bien
 *     qu'ajouter une dépense puis soumettre effaçait l'ajout.
 *
 * Les deux se prouvent par le même point d'observation : `onChange`.
 *
 * S'y ajoute un troisième défaut, de permission : le champ empruntait celles de
 * la CAGNOTTE (`isAdmin` sur l'entité hôte du site) alors qu'il s'agit d'un
 * input de formulaire, dont le droit d'écriture est celui de la RÉPONSE.
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolightOptional: () => ({ api: null, entity: null }),
}));
vi.mock("@/modules/aac/hooks/useAacFundingResource", () => ({
  useAacFundingResource: () => ({ targetResource: undefined }),
}));

const permsMock = vi.fn();
vi.mock("@/modules/cagnotte/hooks/useCagnottePermissions", () => ({
  useCagnottePermissions: () => permsMock(),
}));

const { MilestoneListField } = await import("./MilestoneListField");

const champ = (): FormFieldMapping =>
  ({
    name: "depense",
    label: "Les étapes du projet et leur besoin financier",
    type: "tpls.forms.ocecoform.newDepenseList",
    componentType: "milestoneList",
    isRequired: false,
  }) as unknown as FormFieldMapping;

/** Ligne relevée en base : porte des clés que le champ n'édite pas. */
const LIGNE: DepenseEntry = {
  poste: "Développement",
  price: 5000,
  milestone: "m-abc",
  financer: [{ id: "u1", amount: 250 }],
  historique: [{ quand: "2026-01-15", avant: 4000, apres: 5000 }],
};

function poser(value: DepenseEntry[], answerId?: string, readOnly = false) {
  const onChange = vi.fn();
  render(
    <MilestoneListField
      field={champ()}
      errors={{}}
      value={value}
      onChange={onChange}
      answerId={answerId}
      readOnly={readOnly}
    />,
  );
  return onChange;
}

describe("MilestoneListField", () => {
  beforeEach(() => {
    permsMock.mockReturnValue({
      canCreateMilestone: true,
      canEditMilestone: () => true,
      canCloseMilestone: () => true,
      canRestoreMilestone: () => true,
      canDeleteMilestone: () => true,
      isConnected: true,
      isAdmin: true,
      currentUserId: "u-test",
    });
  });

  it("permet d'ajouter une dépense SANS réponse enregistrée", async () => {
    // Le défaut historique : sans `answerId`, le champ affichait
    // « enregistrez d'abord » et aucun bouton d'ajout.
    const onChange = poser([], undefined);
    const ajouter = screen.getByRole("button", { name: /addMilestone|Ajouter/i });
    fireEvent.click(ajouter);

    fireEvent.change(screen.getByLabelText("Intitulé"), { target: { value: "Hébergement" } });
    fireEvent.change(screen.getByLabelText("Montant cible"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const [liste] = onChange.mock.calls[0] as [DepenseEntry[]];
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ poste: "Hébergement", price: 300 });
    expect(liste[0].milestone).toBeTruthy();
  });

  it("affiche les dépenses existantes", () => {
    poser([LIGNE]);
    expect(screen.getByText("Développement")).toBeTruthy();
  });

  it("remonte TOUTE modification par onChange — c'est ce qui empêche le submit d'écraser", async () => {
    const onChange = poser([LIGNE], "answer-1");
    fireEvent.click(screen.getByText("Développement").closest("button")!);
    // On rouvre par le bouton d'ajout : le même dialogue sert les deux gestes.
    fireEvent.click(screen.getByRole("button", { name: /addMilestone|Ajouter/i }));
    fireEvent.change(screen.getByLabelText("Intitulé"), { target: { value: "Autre" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [liste] = onChange.mock.calls[onChange.mock.calls.length - 1] as [DepenseEntry[]];
    // La ligne d'origine est intacte, clés hors contrat comprises.
    expect(liste[0].financer).toEqual([{ id: "u1", amount: 250 }]);
    expect(liste[0].historique).toHaveLength(1);
  });

  it("refuse une dépense sans intitulé", async () => {
    const onChange = poser([]);
    fireEvent.click(screen.getByRole("button", { name: /addMilestone|Ajouter/i }));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    // Le message de validation apparaît, et rien n'est remonté au formulaire.
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("en lecture seule : pas de bouton d'ajout", () => {
    poser([LIGNE], "answer-1", true);
    expect(screen.getByText("Développement")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /addMilestone/i })).toBeNull();
  });

  it("la saisie suit les droits de la RÉPONSE, pas ceux de la cagnotte", async () => {
    // Le portage initial gardait le bouton derrière `canCreateMilestone`, qui
    // vaut `isAdmin` sur l'entité HÔTE DU SITE : il fallait être admin de
    // l'organisation porteuse pour saisir une dépense dans sa propre réponse.
    // Le legacy (`newDepenseList.php`) n'impose rien. Seul `readOnly` — le droit
    // d'éditer la réponse — doit fermer le champ (cf. le test précédent).
    permsMock.mockReturnValue({
      canCreateMilestone: false,
      canEditMilestone: () => false,
      canCloseMilestone: () => false,
      canRestoreMilestone: () => false,
      canDeleteMilestone: () => false,
      canCreateAction: () => false,
      canCandidateAction: () => false,
      canMarkActionDone: () => false,
      canEditAction: () => false,
      canDeleteAction: () => false,
      isConnected: true,
      isAdmin: false,
      currentUserId: "u-simple",
    });
    const onChange = poser([]);

    const ajouter = screen.getByRole("button", { name: /addMilestone|Ajouter/i });
    fireEvent.change(
      (fireEvent.click(ajouter), screen.getByLabelText("Intitulé")),
      { target: { value: "Matériel" } },
    );
    fireEvent.change(screen.getByLabelText("Montant cible"), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const [liste] = onChange.mock.calls[0] as [DepenseEntry[]];
    expect(liste[0]).toMatchObject({ poste: "Matériel", price: 120 });
  });
});
