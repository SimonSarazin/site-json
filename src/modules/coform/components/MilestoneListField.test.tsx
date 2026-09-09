// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { formatCurrency } from "@/modules/cagnotte/utils/format";
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
// Paramétrable : la photo serveur (`targetResource.items`) est ce qui se
// FUSIONNE avec la valeur RHF — les tests de fusion, plus bas, la font parler.
const fundingMock = vi.fn();
vi.mock("@/modules/aac/hooks/useAacFundingResource", () => ({
  useAacFundingResource: () => fundingMock(),
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
  const arbre = (v: DepenseEntry[]) => (
    <MilestoneListField
      field={champ()}
      errors={{}}
      value={v}
      onChange={onChange}
      answerId={answerId}
      readOnly={readOnly}
    />
  );
  const vue = render(arbre(value));
  // `rerender` : ce que fait le formulaire hôte quand `onChange` a remonté une
  // nouvelle valeur (RHF la redonne au champ), ou quand une source vive bouge.
  return Object.assign(onChange, { rerender: (v: DepenseEntry[]) => vue.rerender(arbre(v)) });
}

describe("MilestoneListField", () => {
  beforeEach(() => {
    fundingMock.mockReset();
    fundingMock.mockReturnValue({ targetResource: undefined });
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

  /** Photo serveur d'une ligne, telle que `useCagnotteAdapter` la produit. */
  const itemServeur = (over: Record<string, unknown> = {}) => ({
    fromType: "depense" as const,
    itemId: "0",
    milestoneId: "m-abc",
    depenseIndex: 0,
    name: "Développement",
    description: "",
    price: 5000,
    status: "open",
    actions: [],
    funding: [],
    currentFunding: 0,
    unpaidFunding: 0,
    userPledge: 0,
    allFunding: [],
    ...over,
  });
  const ressource = (items: ReturnType<typeof itemServeur>[]) => ({
    targetResource: {
      fromType: "proposition" as const,
      id: "answer-1",
      name: "Mon commun",
      answerId: "answer-1",
      projectId: "",
      resourceTotalAmount: 0,
      resourceFinancedAmount: 0,
      items,
    },
  });

  /**
   * Régression (M28) : la modale de modification réinitialisait la saisie à
   * chaque rendu du champ. `valeursInitiales` est un littéral reconstruit à
   * chaque rendu ; l'effet de resemage du dialogue dépendait de son identité ;
   * et ce champ se rerend hors de tout geste — il s'abonne à l'enveloppe
   * (`useAacFundingResource`), dont la réparation automatique de l'adaptateur
   * invalide le cache. L'utilisateur tape 6000 ; le refetch arrive ; le montant
   * repasse à 5000 sous ses doigts, sans message.
   */
  it("un refetch de l'enveloppe pendant la modification ne réinitialise PAS la saisie", async () => {
    fundingMock.mockReturnValue(ressource([itemServeur()]));
    const onChange = poser([LIGNE], "answer-1");

    fireEvent.click(screen.getByRole("button", { name: /MilestoneManageActions\.edit/ }));
    const montant = screen.getByLabelText("Montant cible") as HTMLInputElement;
    expect(montant.value).toBe("5000");
    fireEvent.change(montant, { target: { value: "6000" } });

    // Le refetch : même contenu, AUTRE identité — la liste dérivée et
    // `valeursInitiales` changent d'identité avec lui.
    fundingMock.mockReturnValue(ressource([itemServeur()]));
    onChange.rerender([LIGNE]);

    expect(montant.value).toBe("6000");

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const [liste] = onChange.mock.calls[0] as [DepenseEntry[]];
    expect(liste[0]).toMatchObject({ poste: "Développement", price: 6000, milestone: "m-abc" });
  });

  /**
   * Fusion avec la photo serveur (bloquant B3 du rapport, résiduel de couverture).
   *
   * Sur un site AAC — le cas nominal, la réponse étant dans l'enveloppe du site —
   * `targetResource.items` est une photo serveur FIGÉE jusqu'à la soumission,
   * tandis que la valeur RHF est déjà modifiée par le geste. Avant le correctif,
   * `buildItemsFromRawDepenses` appariait par POSITION et rendait l'item enrichi
   * tel quel : la ligne supprimée restait affichée et la survivante disparaissait,
   * un palier clôturé restait « open », un montant édité gardait l'ancienne
   * valeur — et « Modifier » ouvrait la modale sur une AUTRE ligne.
   *
   * Les tests précédents laissaient `targetResource` vide : la fusion n'y était
   * jamais exercée. Ici, la photo serveur est TOUJOURS en retard d'un geste, et
   * la saisie locale doit gagner.
   */
  describe("fusion avec la photo serveur — la saisie locale gagne", () => {
    const LIGNE2: DepenseEntry = { poste: "Hébergement", price: 300, milestone: "m-def" };
    const itemServeur2 = () =>
      itemServeur({ itemId: "1", milestoneId: "m-def", depenseIndex: 1, name: "Hébergement", price: 300 });
    // Le matcher texte de testing-library normalise les espaces du DOM (insécables
    // compris), pas ceux de la chaîne attendue : on aligne les deux.
    const montant = (n: number) => formatCurrency(n).replace(/\s+/g, " ");

    it("édition : le nouveau montant s'affiche, pas celui de la photo serveur", async () => {
      fundingMock.mockReturnValue(ressource([itemServeur()]));
      const onChange = poser([LIGNE], "answer-1");
      expect(screen.getByText(montant(5000))).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: /MilestoneManageActions\.edit/ }));
      fireEvent.change(screen.getByLabelText("Montant cible"), { target: { value: "6000" } });
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
      const [liste] = onChange.mock.calls[0] as [DepenseEntry[]];

      // RHF redonne la valeur au champ ; la photo serveur, elle, dit encore 5000.
      onChange.rerender(liste);
      expect(screen.getByText(montant(6000))).toBeTruthy();
      expect(screen.queryByText(montant(5000))).toBeNull();
      // Les agrégats de financement viennent bien de l'enrichi (fusion, pas remplacement).
      expect(liste[0].financer).toEqual([{ id: "u1", amount: 250 }]);
    });

    it("clôture : la ligne passe dans les archivés alors que la photo serveur la dit ouverte", () => {
      fundingMock.mockReturnValue(ressource([itemServeur()]));
      const onChange = poser([LIGNE], "answer-1");

      fireEvent.click(screen.getByRole("button", { name: /MilestoneManageActions\.close/ }));
      expect(onChange).toHaveBeenCalledTimes(1);
      const [liste] = onChange.mock.calls[0] as [DepenseEntry[]];
      expect(liste[0]).toMatchObject({ milestone: "m-abc", include: false });

      onChange.rerender(liste);
      // Plus dans la liste active ; repliée derrière le bouton des archivés.
      expect(screen.queryByText("Développement")).toBeNull();
      const archives = screen.getByRole("button", { expanded: false });
      fireEvent.click(archives);
      expect(screen.getByText("Développement")).toBeTruthy();
      expect(screen.getByRole("button", { name: /MilestoneManageActions\.restore/ })).toBeTruthy();
    });

    it("suppression : la ligne retirée disparaît, la survivante reste — et « Modifier » l'ouvre, elle", async () => {
      fundingMock.mockReturnValue(ressource([itemServeur(), itemServeur2()]));
      const onChange = poser([LIGNE, LIGNE2], "answer-1");

      fireEvent.click(screen.getAllByRole("button", { name: /MilestoneManageActions\.delete/ })[0]);
      fireEvent.click(
        screen.getByRole("button", { name: /deleteMilestoneConfirm\.confirm/ }),
      );
      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
      const [liste] = onChange.mock.calls[0] as [DepenseEntry[]];
      expect(liste).toEqual([LIGNE2]);

      // La photo serveur porte encore les DEUX items, « Développement » en position 0.
      onChange.rerender(liste);
      expect(screen.queryByText("Développement")).toBeNull();
      expect(screen.getByText("Hébergement")).toBeTruthy();

      // `depenseIndex` est l'index LOCAL : la modale s'ouvre sur la survivante,
      // en modification — pas en ajout sur une ligne fantôme.
      fireEvent.click(screen.getByRole("button", { name: /MilestoneManageActions\.edit/ }));
      expect(screen.getByText("Modifier la dépense")).toBeTruthy();
      expect((screen.getByLabelText("Intitulé") as HTMLInputElement).value).toBe("Hébergement");
    });
  });
});
