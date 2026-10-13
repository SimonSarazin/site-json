// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { AacResolvedConfig } from "../../types";
import type { CommunObjectivesController } from "./CommunMilestoneDialogs";

/**
 * « Besoins financiers » sur la fiche d'un commun (review MR 53, lot 2).
 *
 * Le contrôleur est un STUB : ses handlers et ses permissions n'entrent pas
 * dans ce qui est vérifié ici — seul le rendu de la liste des paliers l'est.
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string, params?: Record<string, unknown>) => {
    const base = fallback ?? key;
    if (!params) return base;
    return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)), base);
  },
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

let depenses: Array<Record<string, unknown>> = [];
const useCommunRawDepenses = vi.fn(() => ({ data: depenses }));
vi.mock("@/modules/aac/hooks/useCommunRawDepenses", () => ({
  useCommunRawDepenses: (...args: unknown[]) => useCommunRawDepenses(...(args as [])),
}));

const { CommunFinancingSection } = await import("./CommunFinancingSection");

function makeConfig(depenseStepKey: string | null): AacResolvedConfig {
  return {
    formId: "f1",
    configId: null,
    aapType: "aac",
    steps: [],
    roles: { depenseStepKey, evalStepKey: null, financementStepKey: null, suiviStepKey: null },
    criteria: [],
    criteriaSource: "none",
    gates: {
      active: true,
      onlyMemberAccess: false,
      oneAnswerPerPers: false,
      canReadOtherAnswers: false,
      showAnswers: false,
      coremu: true,
      anyOnewithLinkCanAnswer: false,
    },
    campaigns: [],
    typeCoFinancer: null,
  };
}

/** Le strict nécessaire du contrôleur pour rendre la liste — aucun droit de gestion. */
function makeCtrl(): CommunObjectivesController {
  return {
    resolvedAnswerId: "a1",
    cagnottePerms: {
      canCreateMilestone: false,
      canEditMilestone: () => false,
      canCloseMilestone: () => false,
      canDeleteMilestone: () => false,
      // Restauration d'un palier clos (lot 2, G6/H7) : le composant la consulte aussi.
      canRestoreMilestone: () => false,
    },
    openCreateMilestoneModal: vi.fn(),
    openEditMilestoneModal: vi.fn(),
    handleCloseMilestone: vi.fn(),
    handleRestoreMilestone: vi.fn(),
    handleDeleteMilestone: vi.fn(),
    loadingIds: { deletingItemId: "", closingItemId: "", restoringItemId: "" },
  } as unknown as CommunObjectivesController;
}

function renderSection(over: Partial<Parameters<typeof CommunFinancingSection>[0]> = {}) {
  return render(
    <LocalizationProvider>
      <CommunFinancingSection
        formData={{ id: "f1", name: "Appel", inputs: {} } as never}
        aacConfig={makeConfig("etapeA")}
        funding={null}
        ctrl={makeCtrl()}
        {...over}
      />
    </LocalizationProvider>,
  );
}

beforeEach(() => {
  depenses = [];
  useCommunRawDepenses.mockClear();
});

describe("CommunFinancingSection — l'étape des dépenses est celle que la page a résolue (M13)", () => {
  it("passe `roles.depenseStepKey` à `useCommunRawDepenses`, jamais `aapStep1` en dur", () => {
    renderSection({ aacConfig: makeConfig("etapeA") });
    expect(useCommunRawDepenses).toHaveBeenCalledWith("a1", "etapeA");
  });
});

describe("CommunFinancingSection — un palier clos est marqué comme tel (M17)", () => {
  /**
   * La carte et la table des cofinanceurs excluent les paliers clos de leurs
   * totaux ; la liste, elle, les gardait sans aucun marqueur — le lecteur
   * additionnait « 900 € / 900 € » absents du « 0 € sur 100 € » annoncé au-dessus.
   * Le palier reste listé (c'est là qu'on le restaure), mais badgé.
   */
  it("badge « clos » sur le palier `include: false`, aucun sur le palier ouvert", () => {
    depenses = [
      { poste: "Ouvert", priceInt: 100 },
      { poste: "Clos", priceInt: 900, include: false, financer: [{ id: "u1", amount: 900 }] },
    ];
    renderSection();

    expect(screen.getByText("Ouvert")).toBeTruthy();
    expect(screen.getByText("Clos")).toBeTruthy();
    const badges = screen.getAllByText("detail.objectives.closedBadge");
    expect(badges).toHaveLength(1);
    // Le badge est dans la carte du palier CLOS, pas dans celle du palier ouvert.
    expect(badges[0].closest("button")?.textContent).toContain("Clos");
    expect(badges[0].closest("button")?.textContent).not.toContain("Ouvert");
  });
});

describe("CommunFinancingSection — description du palier", () => {
  const toggleOf = (title: string) => screen.getByText(title).closest("button") as HTMLButtonElement;
  const panelOf = (title: string) =>
    document.getElementById(toggleOf(title).getAttribute("aria-controls") ?? "") as HTMLElement;

  beforeEach(() => {
    depenses = [
      { poste: "Avec", priceInt: 100, description: "Achat du matériel" },
      { poste: "Sans", priceInt: 200, description: "  " },
    ];
  });

  it("replié : aperçu sous le titre, tronqué et hors du nom accessible du bouton", () => {
    renderSection();

    const preview = screen.getByText("Achat du matériel");
    expect(toggleOf("Avec").contains(preview)).toBe(true);
    expect(preview.getAttribute("aria-hidden")).toBe("true");
    expect(preview.className).toContain("line-clamp-2");
    // `display: block` annulerait le `-webkit-box` dont dépend la troncature.
    expect(preview.className).not.toMatch(/\bblock\b/);
  });

  it("déplié : texte complet dans le panneau que contrôle le bouton, plus dans le bouton", () => {
    renderSection();
    fireEvent.click(toggleOf("Avec"));

    const full = screen.getByText("Achat du matériel");
    expect(toggleOf("Avec").contains(full)).toBe(false);
    expect(panelOf("Avec").contains(full)).toBe(true);
    expect(full.getAttribute("aria-hidden")).toBeNull();
  });

  it("description vide : ni aperçu ni paragraphe dans le panneau", () => {
    renderSection();

    // Libellé du palier + titre, rien d'autre.
    expect(screen.getByText("Sans").parentElement?.children).toHaveLength(2);
    expect(screen.getByText("Avec").parentElement?.children).toHaveLength(3);

    fireEvent.click(toggleOf("Sans"));
    expect(panelOf("Sans").querySelector("p")).toBeNull();
  });
});

/**
 * Un fil de discussion par palier (parité de « Commenter » sur chaque carte de la liste des
 * dépenses du legacy). La section ne connaît pas l'espace de discussion : elle demande le bouton à
 * la page, en lui donnant ce qui désigne le fil — la CLÉ de la ligne dans le document.
 */
describe("CommunFinancingSection — le bouton de discussion d'un palier", () => {
  const bouton = vi.fn(({ lineKey, name }: { lineKey: string; name: string }) => (
    <button type="button" data-discussion-de={lineKey}>{`discuter:${name}`}</button>
  ));
  const demandes = () => bouton.mock.calls.map(([palier]) => palier);
  const bascule = (titre: string) => screen.getByText(titre).closest("button") as HTMLButtonElement;
  // La fiche lit ici ses dépenses à `aapStep1` : la liste que l'espace de discussion connaît. Et le
  // contrôleur porte le DOCUMENT des dépenses, comme en vrai : c'est en lui que se lit la clé.
  const avecDocument = (document: unknown) => ({ ...makeCtrl(), depensesDocument: document }) as unknown as CommunObjectivesController;
  const monter = (over: Partial<Parameters<typeof CommunFinancingSection>[0]> = {}) =>
    renderSection({
      aacConfig: makeConfig("aapStep1"), renderMilestoneDiscussion: bouton,
      ctrl: avecDocument([{ poste: "Local" }, { poste: "Matériel" }]), ...over,
    });

  beforeEach(() => {
    bouton.mockClear();
    depenses = [{ poste: "Local", priceInt: 100 }, { poste: "Matériel", priceInt: 200 }];
  });

  it("demande à la page le bouton de CHAQUE palier, par la clé de sa ligne et par son nom", () => {
    monter();
    expect(demandes()).toEqual([{ lineKey: "0", name: "Local" }, { lineKey: "1", name: "Matériel" }]);
  });

  it("document pas encore là : la position sert de clé, faute de mieux", () => {
    monter({ ctrl: makeCtrl() });
    expect(demandes().map(palier => palier.lineKey)).toEqual(["0", "1"]);
  });

  it("la clé se lit dans le DOCUMENT : des dépenses en objet à clés creuses ne se numérotent pas par position", () => {
    const ctrl = { ...makeCtrl(), depensesDocument: { "0": { poste: "Local" }, "3": { poste: "Matériel" } } } as unknown as CommunObjectivesController;
    monter({ ctrl });
    expect(demandes()).toEqual([{ lineKey: "0", name: "Local" }, { lineKey: "3", name: "Matériel" }]);
  });

  it("un tableau à trou garde ses rangs : la ligne d'après un trou ne recule pas", () => {
    depenses = [{ poste: "Local", priceInt: 100 }, {}, { poste: "Matériel", priceInt: 200 }];
    const ctrl = { ...makeCtrl(), depensesDocument: [{ poste: "Local" }, null, { poste: "Matériel" }] } as unknown as CommunObjectivesController;
    monter({ ctrl });
    expect(demandes().map(palier => palier.lineKey)).toEqual(["0", "1", "2"]);
  });

  it("le pose dans l'en-tête de la carte, HORS du bouton qui la déplie — un bouton ne s'imbrique pas dans un autre", () => {
    monter();
    const discuter = screen.getByText("discuter:Local");
    expect(bascule("Local").contains(discuter)).toBe(false);
    expect(discuter.closest("[data-milestone-discussion-slot]")).not.toBeNull();
    // Même ligne d'en-tête : l'emplacement est le voisin immédiat du bouton qui déplie.
    expect(discuter.closest("[data-milestone-discussion-slot]")!.previousElementSibling).toBe(bascule("Local"));
  });

  it("cliquer « discuter » ne déplie pas la carte, et la déplier ne retire pas le bouton", () => {
    monter();
    fireEvent.click(screen.getByText("discuter:Local"));
    expect(bascule("Local").getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(bascule("Local"));
    expect(bascule("Local").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("discuter:Local")).toBeTruthy();
  });

  it("sans étape résolue, c'est `aapStep1` : le bouton est demandé", () => {
    monter({ aacConfig: makeConfig(null) });
    expect(demandes().map(palier => palier.lineKey)).toEqual(["0", "1"]);
  });

  it("dépenses lues à une AUTRE étape : aucun bouton n'est demandé — par la clé seule, il ouvrirait le fil d'une autre ligne", () => {
    monter({ aacConfig: makeConfig("etapeA") });
    expect(bouton).not.toHaveBeenCalled();
    for (const emplacement of document.querySelectorAll("[data-milestone-discussion-slot]")) {
      expect(emplacement.childNodes).toHaveLength(0);
    }
    // … et la liste, elle, s'affiche toujours.
    expect(screen.getByText("Local")).toBeTruthy();
  });

  it("l'emplacement réservé suit la taille du bouton : étroit sous 80 rem, large au-delà", () => {
    monter();
    const classes = document.querySelector("[data-milestone-discussion-slot]")!.className.split(/\s+/);
    const reserve = "group-has-[[data-milestone-discussion-slot]:not(:empty)]/paliers:";
    expect(classes).toContain(`sm:${reserve}min-w-20`);
    expect(classes).toContain(`xl:${reserve}min-w-40`);
    expect(classes).not.toContain(`sm:${reserve}min-w-40`);
  });

  it.each([
    ["la page n'en demande pas", undefined],
    ["le bouton n'a rien à montrer", () => null],
  ])("quand %s, l'emplacement reste VIDE — c'est ce qui le fait s'effacer", (_cas, rendu) => {
    renderSection({ aacConfig: makeConfig("aapStep1"), renderMilestoneDiscussion: rendu });
    const emplacements = [...document.querySelectorAll("[data-milestone-discussion-slot]")];
    expect(emplacements).toHaveLength(2);
    for (const emplacement of emplacements) {
      expect(emplacement.childNodes).toHaveLength(0);
      expect(emplacement.className).toContain("empty:hidden");
    }
  });
});
