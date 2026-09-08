// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { CategorizedCheckboxOption, CategorizedCheckboxValue, FormFieldMapping } from "../types";

/**
 * Tests de RENDU du champ. Le hook de données (deux appels SDK réels) est mocké : la construction
 * de l'arbre est couverte par `utils/categorizedCheckbox.test.ts`, contre les données réelles.
 * Ici on vérifie ce que le hook ne peut pas prouver : ce que l'utilisateur voit et déclenche.
 */

const mockOptions = vi.fn<() => { options: CategorizedCheckboxOption[]; isLoading: boolean; error: Error | null }>();

vi.mock("../hooks/useCategorizedCheckboxOptions", () => ({
  useCategorizedCheckboxOptions: () => mockOptions(),
}));

// i18n : on renvoie le fallback français passé au call-site — c'est ce que voit l'utilisateur.
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const { CategorizedCheckboxField } = await import("./CategorizedCheckboxField");

const ARBRE: CategorizedCheckboxOption[] = [
  {
    key: "1_communication-externe",
    label: "Communication externe",
    fromSource: true,
    children: [
      { key: "3_plateforme-video", label: "Plateforme video", count: 4 },
      { key: "5_site-vitrine", label: "Site vitrine", count: 0 },
    ],
  },
  { key: "15_autres-metiers", label: "Autres métiers", fromSource: true, children: [] },
];

const champ = (): FormFieldMapping =>
  ({
    name: "monChamp",
    label: "Besoins outillés",
    type: "tpls.forms.cplx.categorizedCheckbox",
    componentType: "categorizedCheckbox",
    isRequired: false,
    categorizedCheckboxConfig: {
      dataSourceToUse: "distanceOnly",
      list: [],
      sublist: {},
      formParamsSource: ["6525865cdeaf281bbc7280e9"],
      questionsParamsSource: [],
    },
  }) as unknown as FormFieldMapping;

function poser(value: CategorizedCheckboxValue, onChange = vi.fn(), readOnly = false) {
  mockOptions.mockReturnValue({ options: ARBRE, isLoading: false, error: null });
  render(
    <CategorizedCheckboxField field={champ()} errors={{}} value={value} onChange={onChange} readOnly={readOnly} />,
  );
  return onChange;
}

describe("CategorizedCheckboxField", () => {
  it("rend les catégories, et les sous-options une fois la catégorie dépliée", () => {
    poser({ list: [], sublist: {} });
    expect(screen.getByText("Communication externe")).toBeTruthy();
    expect(screen.getByText("Autres métiers")).toBeTruthy();
    // Repliée par défaut tant que rien n'est coché.
    expect(screen.queryByText("Plateforme video")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Déplier" }));
    expect(screen.getByText("Plateforme video")).toBeTruthy();
  });

  it("déplie d'emblée une catégorie qui porte déjà une réponse", () => {
    poser({ list: ["1_communication-externe"], sublist: { "1_communication-externe": ["3_plateforme-video"] } });
    // Sans ce dépliage, l'utilisateur ne verrait pas ce qu'il a coché.
    expect(screen.getByText("Plateforme video")).toBeTruthy();
  });

  it("cocher une catégorie ouvre ses sous-options", () => {
    poser({ list: [], sublist: {} });
    expect(screen.queryByText("Plateforme video")).toBeNull();
    fireEvent.click(screen.getByLabelText("Communication externe"));
    // Cocher n'a de sens que pour préciser ensuite : laisser le bloc replié cacherait l'étape.
    expect(screen.getByText("Plateforme video")).toBeTruthy();
  });

  it("cocher une catégorie l'ouvre MÊME si elle avait été repliée à la main", () => {
    poser({ list: [], sublist: {} });
    // L'utilisateur déplie puis replie : `expanded` vaut désormais explicitement false, ce qui
    // court-circuite le repli automatique sur l'état coché.
    fireEvent.click(screen.getByRole("button", { name: "Déplier" }));
    fireEvent.click(screen.getByRole("button", { name: "Replier" }));
    expect(screen.queryByText("Plateforme video")).toBeNull();

    fireEvent.click(screen.getByLabelText("Communication externe"));
    expect(screen.getByText("Plateforme video")).toBeTruthy();
  });

  it("cocher une catégorie sans sous-option ne casse rien", () => {
    const onChange = poser({ list: [], sublist: {} });
    fireEvent.click(screen.getByLabelText("Autres métiers"));
    expect(onChange).toHaveBeenCalledWith({ list: ["15_autres-metiers"], sublist: {} });
  });

  it("cocher une sous-option coche aussi sa catégorie", () => {
    const onChange = poser({ list: ["1_communication-externe"], sublist: {} });
    fireEvent.click(screen.getByLabelText(/Site vitrine/));
    expect(onChange).toHaveBeenCalledWith({
      list: ["1_communication-externe"],
      sublist: { "1_communication-externe": ["5_site-vitrine"] },
    });
  });

  it("affiche le nombre de répondants d'un usage, et l'omet quand il est nul", () => {
    poser({ list: ["1_communication-externe"], sublist: {} });
    expect(screen.getByText("(4)")).toBeTruthy();
    expect(screen.queryByText("(0)")).toBeNull();
  });

  it("conserve et signale une réponse dont la clé ne correspond plus à aucune option", () => {
    // Cas réel : `0_gestion` date de l'époque où la liste était manuelle. L'escamoter ferait
    // disparaître, à la première ré-ouverture du formulaire, un choix que le legacy affiche.
    poser({ list: ["0_gestion"], sublist: { "0_gestion": ["0_test1"] } });
    expect(screen.getByText(/ne correspondant plus/)).toBeTruthy();
    expect(screen.getByText(/Gestion/)).toBeTruthy();
    expect(screen.getByText(/Test1/)).toBeTruthy();
  });

  describe("mode lecture", () => {
    it("n'affiche QUE les choix faits, sans case à cocher", () => {
      poser(
        { list: ["1_communication-externe"], sublist: { "1_communication-externe": ["3_plateforme-video"] } },
        vi.fn(),
        true,
      );
      expect(screen.getByText("Communication externe")).toBeTruthy();
      expect(screen.getByText(/Plateforme video/)).toBeTruthy();
      // Les 15 autres catégories n'ont pas à encombrer un récapitulatif de réponse.
      expect(screen.queryByText("Autres métiers")).toBeNull();
      expect(screen.queryByRole("checkbox")).toBeNull();
    });

    it("affiche un tiret quand rien n'a été coché", () => {
      poser({ list: [], sublist: {} }, vi.fn(), true);
      expect(screen.getByText("—")).toBeTruthy();
    });

    it("reprend une sous-liste orpheline de sa catégorie", () => {
      // Le legacy ne purgeait pas `sublist` en décochant le parent : la sous-réponse existe encore
      // en base, et reste visible côté legacy. Elle doit l'être ici aussi.
      poser({ list: [], sublist: { "1_communication-externe": ["3_plateforme-video"] } }, vi.fn(), true);
      expect(screen.getByText("Communication externe")).toBeTruthy();
      expect(screen.getByText(/Plateforme video/)).toBeTruthy();
    });

    it("relit une réponse dont la clé ne se résout plus", () => {
      poser({ list: ["0_gestion"], sublist: { "0_gestion": ["0_test1"] } }, vi.fn(), true);
      expect(screen.getByText("Gestion")).toBeTruthy();
      expect(screen.getByText(/Test1/)).toBeTruthy();
    });
  });

  it("montre un état de chargement plutôt qu'une liste vide trompeuse", () => {
    mockOptions.mockReturnValue({ options: [], isLoading: true, error: null });
    const { container } = render(
      <CategorizedCheckboxField field={champ()} errors={{}} value={{ list: [], sublist: {} }} onChange={vi.fn()} />,
    );
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });
});
