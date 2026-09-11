// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "@/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { FormFieldMapping } from "../types";
import type { DepenseEntry } from "../utils/depense";

/**
 * Verrouille l'ENREGISTREMENT des bundles i18n que ce champ consomme.
 *
 * `MilestoneListField` traduit dans « modules/aac » et, via
 * `MilestoneManageActions`, dans « modules/cagnotte » — deux namespaces
 * qu'aucun import de son graphe n'enregistrait. Or `src/i18n.ts` n'a AUCUN
 * backend (`ns: []`) : un bundle ne vient que d'un `addResourceBundle` déclenché
 * par l'import d'effet de bord d'un `i18n.ts`, et `useLoadNamespace` ne peut
 * rien charger de lui-même. Rendu depuis coform (`DynamicCoForm`,
 * `MultiStepCoForm`, `CoFormReadOnly`) sur une page SANS section AAC, le champ
 * affichait donc ses clés brutes : « detail.objectives.addMilestone »,
 * « MilestoneManageActions.edit »…
 *
 * D'où ce test SANS mock de `useT` (contrairement à `MilestoneListField.test.tsx`)
 * et SANS import d'un `i18n.ts` de module : seul le composant doit apporter ses
 * bundles, comme lorsqu'il est le seul consommateur de la page.
 */

vi.mock("@/hooks/useCocolight", () => ({
  useCocolightOptional: () => ({ api: null, entity: null }),
}));
vi.mock("@/modules/aac/hooks/useAacFundingResource", () => ({
  useAacFundingResource: () => ({ targetResource: undefined }),
}));
vi.mock("@/modules/cagnotte/hooks/useCagnottePermissions", () => ({
  useCagnottePermissions: () => ({
    canCreateMilestone: true,
    canEditMilestone: () => true,
    canCloseMilestone: () => true,
    canRestoreMilestone: () => true,
    canDeleteMilestone: () => true,
    isConnected: true,
    isAdmin: true,
    currentUserId: "u-test",
  }),
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

const LIGNE: DepenseEntry = { poste: "Développement", price: 5000, milestone: "m-abc" };

function poser(value: DepenseEntry[]) {
  return render(
    <LocalizationProvider>
      <MilestoneListField field={champ()} errors={{}} value={value} onChange={() => {}} answerId="answer-1" />
    </LocalizationProvider>,
  );
}

describe("MilestoneListField — bundles i18n apportés par le champ lui-même", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("« modules/aac » : les libellés du champ sont traduits, pas des clés brutes", () => {
    poser([LIGNE]);
    expect(screen.getByRole("button", { name: /Ajouter un palier/ })).toBeTruthy();
    expect(screen.getByText("Palier 1")).toBeTruthy();

    // L'historique des montants ne se rend qu'une fois la ligne dépliée.
    fireEvent.click(screen.getByText("Développement").closest("button")!);
    expect(screen.getByText("Historique des montants")).toBeTruthy();
    expect(screen.getByText("Aucune modification de montant enregistrée.")).toBeTruthy();

    expect(document.body.textContent).not.toMatch(/detail\.objectives\./);
  });

  it("« modules/cagnotte » : les boutons de gestion d'un palier sont traduits", () => {
    poser([LIGNE]);
    expect(screen.getByRole("button", { name: "Modifier" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clôturer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeTruthy();

    expect(document.body.textContent).not.toMatch(/MilestoneManageActions\./);
  });
});
