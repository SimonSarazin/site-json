// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { FormFieldMapping, TagsValue } from "../types";

/**
 * Tests de RENDU et d'INTERACTION. La logique de filtrage/ajout est couverte
 * contre les données réelles dans `utils/tags.test.ts` ; ici on vérifie ce que
 * les helpers ne peuvent pas prouver — ce que l'utilisateur voit et déclenche.
 *
 * Le hook de suggestions est mocké : sa bascule vocabulaire-local ↔ index global
 * dépend du SDK, hors sujet pour le rendu.
 */

const mockSuggestions = vi.fn<() => { suggestions: string[]; isLoading: boolean; isRemote: boolean }>();

vi.mock("../hooks/useTagSuggestions", () => ({
  useTagSuggestions: () => mockSuggestions(),
}));

// Le mock interpole `{{param}}` comme le vrai `useT` : sans ça, un libellé
// paramétré (l'aria-label de suppression) serait testé dans une forme que
// l'utilisateur ne voit jamais.
vi.mock("@/hooks/useT", () => ({
  useT:
    () =>
    (key: string, fallback?: string, params?: Record<string, unknown>) => {
      const base = fallback ?? key;
      if (!params) return base;
      return base.replace(/\{\{(\w+)\}\}/g, (m, name) =>
        params[name] === undefined ? m : String(params[name]),
      );
    },
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const { TagsField } = await import("./TagsField");

const champ = (over: Partial<FormFieldMapping> = {}): FormFieldMapping =>
  ({
    name: "tags",
    label: "Tags",
    type: "tpls.forms.tags",
    componentType: "tags",
    isRequired: false,
    placeholder: "Ajoutez les tags qui facilitent l'identification du commun",
    tagsConfig: { list: ["Commun", "coopération"] },
    ...over,
  }) as unknown as FormFieldMapping;

function poser(value: TagsValue, onChange = vi.fn(), readOnly = false, over = {}) {
  render(
    <TagsField field={champ(over)} errors={{}} value={value} onChange={onChange} readOnly={readOnly} />,
  );
  return onChange;
}

describe("TagsField", () => {
  beforeEach(() => {
    mockSuggestions.mockReturnValue({ suggestions: [], isLoading: false, isRemote: false });
  });

  it("affiche les tags enregistrés et le placeholder du formulaire réel", () => {
    poser(["open source", "peertube"]);
    expect(screen.getByText("open source")).toBeTruthy();
    expect(screen.getByText("peertube")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Ajoutez les tags qui facilitent l'identification du commun"),
    ).toBeTruthy();
  });

  it("ajoute un tag libre à la validation par Entrée", () => {
    const onChange = poser([]);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "open source" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["open source"]);
  });

  it("découpe une saisie collée sur les virgules", () => {
    const onChange = poser(["a"]);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "b, c" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("retire le dernier tag au retour arrière sur un champ vide", () => {
    const onChange = poser(["a", "b"]);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith(["a"]);
  });

  it("ne retire rien au retour arrière si la saisie n'est pas vide", () => {
    const onChange = poser(["a"]);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("retire un tag par son bouton", () => {
    const onChange = poser(["open source", "peertube"]);
    fireEvent.click(screen.getByLabelText("Retirer le tag open source"));
    expect(onChange).toHaveBeenCalledWith(["peertube"]);
  });

  it("propose les suggestions au focus et en pose une au clic", () => {
    mockSuggestions.mockReturnValue({
      suggestions: ["Commun", "coopération"],
      isLoading: false,
      isRemote: false,
    });
    const onChange = poser([]);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Commun", "coopération"]);

    // `mouseDown` et non `click` : c'est l'événement que le composant écoute,
    // pour devancer le blur de l'input qui refermerait la liste.
    fireEvent.mouseDown(options[1]);
    expect(onChange).toHaveBeenCalledWith(["coopération"]);
  });

  it("navigue au clavier et valide la suggestion surlignée", () => {
    mockSuggestions.mockReturnValue({
      suggestions: ["Commun", "coopération"],
      isLoading: false,
      isRemote: false,
    });
    const onChange = poser([]);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["coopération"]);
  });

  it("laisse créer un tag libre même quand une suggestion est affichée", () => {
    mockSuggestions.mockReturnValue({
      suggestions: ["Commun"],
      isLoading: false,
      isRemote: false,
    });
    const onChange = poser([]);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    // Aucune suggestion surlignée (activeIndex === -1) → c'est la saisie qui part.
    fireEvent.change(input, { target: { value: "commun a moi" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["commun a moi"]);
  });

  it("en lecture seule : des badges, aucun contrôle de saisie", () => {
    poser(["peertube"], vi.fn(), true);
    expect(screen.getByText("peertube")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByLabelText("Retirer le tag peertube")).toBeNull();
  });

  it("en lecture seule et sans valeur : un tiret, pas un vide", () => {
    poser([], vi.fn(), true);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("marque le champ requis et le signale à l'assistance technique", () => {
    poser([], vi.fn(), false, { isRequired: true });
    expect(screen.getByRole("combobox").getAttribute("aria-required")).toBe("true");
  });

  it("la virgule valide la SAISIE, pas la suggestion surlignée", () => {
    mockSuggestions.mockReturnValue({
      suggestions: ["coopération"],
      isLoading: false,
      isRemote: false,
    });
    const onChange = poser([]);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "coop" } });
    fireEvent.keyDown(input, { key: "ArrowDown" }); // surligne « coopération »
    fireEvent.keyDown(input, { key: "," });
    expect(onChange).toHaveBeenCalledWith(["coop"]);
  });
});
